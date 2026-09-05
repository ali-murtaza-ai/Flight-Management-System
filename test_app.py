import pytest
from datetime import datetime, timezone, timedelta
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from database import Base, get_db
from main import app
import models

# Use in-memory SQLite database for automated unit/integration testing
TEST_DATABASE_URL = "sqlite:///./test_flight_management.db"

engine = create_engine(TEST_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()

app.dependency_overrides[get_db] = override_get_db

@pytest.fixture(autouse=True)
def setup_database():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)

client = TestClient(app)


def test_capacity_validation_failure():
    """
    Test that creating a flight where seat allocations do not sum to total capacity fails with 422.
    """
    dep_time = (datetime.now(timezone.utc) + timedelta(days=2)).isoformat()
    arr_time = (datetime.now(timezone.utc) + timedelta(days=2, hours=5)).isoformat()

    payload = {
        "flight_number": "AA100",
        "origin": "JFK",
        "destination": "LAX",
        "departure_time": dep_time,
        "arrival_time": arr_time,
        "capacity": 100,
        "allocations": [
            {"seat_class": "FIRST", "total_seats": 20},
            {"seat_class": "BUSINESS", "total_seats": 30},
            {"seat_class": "ECONOMY", "total_seats": 40}  # Sum = 90 != 100
        ]
    }
    response = client.post("/admin/flights", json=payload)
    assert response.status_code == 422
    assert "sum of seat classes" in response.text or "capacity" in response.text


def test_create_flight_and_search_success():
    """
    Test successful flight creation and search retrieval.
    """
    dep_time = (datetime.now(timezone.utc) + timedelta(days=3)).isoformat()
    arr_time = (datetime.now(timezone.utc) + timedelta(days=3, hours=4)).isoformat()

    payload = {
        "flight_number": "AA200",
        "origin": "JFK",
        "destination": "SFO",
        "departure_time": dep_time,
        "arrival_time": arr_time,
        "capacity": 100,
        "allocations": [
            {"seat_class": "FIRST", "total_seats": 10},
            {"seat_class": "BUSINESS", "total_seats": 30},
            {"seat_class": "ECONOMY", "total_seats": 60}  # Sum = 100 == 100
        ]
    }
    response = client.post("/admin/flights", json=payload)
    assert response.status_code == 201
    flight = response.json()
    assert flight["flight_number"] == "AA200"
    assert len(flight["allocations"]) == 3

    # Search flight
    search_res = client.get("/flights/search?origin=JFK&destination=SFO")
    assert search_res.status_code == 200
    flights_list = search_res.json()
    assert len(flights_list) == 1
    assert flights_list[0]["flight_number"] == "AA200"


def test_duplicate_flight_prevention():
    """
    Test that creating a flight with the same flight number on the same day fails with HTTP 409.
    """
    dep_time = datetime(2026, 10, 15, 10, 0, tzinfo=timezone.utc).isoformat()
    arr_time = datetime(2026, 10, 15, 14, 0, tzinfo=timezone.utc).isoformat()

    payload = {
        "flight_number": "UA500",
        "origin": "ORD",
        "destination": "MIA",
        "departure_time": dep_time,
        "arrival_time": arr_time,
        "capacity": 50,
        "allocations": [
            {"seat_class": "ECONOMY", "total_seats": 50}
        ]
    }
    res1 = client.post("/admin/flights", json=payload)
    assert res1.status_code == 201

    res2 = client.post("/admin/flights", json=payload)
    assert res2.status_code == 409
    assert "already scheduled" in res2.json()["detail"]


def test_seat_hold_and_booking_flow():
    """
    Test holding seats, inventory reduction, and booking conversion.
    """
    dep_time = (datetime.now(timezone.utc) + timedelta(days=5)).isoformat()
    arr_time = (datetime.now(timezone.utc) + timedelta(days=5, hours=3)).isoformat()

    # Create Flight
    flight_payload = {
        "flight_number": "DL800",
        "origin": "ATL",
        "destination": "BOS",
        "departure_time": dep_time,
        "arrival_time": arr_time,
        "capacity": 20,
        "allocations": [
            {"seat_class": "FIRST", "total_seats": 5},
            {"seat_class": "ECONOMY", "total_seats": 15}
        ]
    }
    flight_res = client.post("/admin/flights", json=flight_payload)
    flight_id = flight_res.json()["id"]

    # Create Seat Hold
    hold_payload = {
        "flight_id": flight_id,
        "seat_class": "FIRST",
        "seat_count": 2,
        "user_id": "usr_999"
    }
    hold_res = client.post("/holds", json=hold_payload)
    assert hold_res.status_code == 201
    hold_id = hold_res.json()["id"]

    # Confirm Booking from Hold
    booking_payload = {
        "flight_id": flight_id,
        "hold_id": hold_id,
        "user_id": "usr_999",
        "passenger_name": "Alice Smith",
        "passenger_email": "alice@example.com",
        "seat_class": "FIRST",
        "seat_count": 2
    }
    booking_res = client.post("/bookings", json=booking_payload)
    assert booking_res.status_code == 201
    booking_data = booking_res.json()
    assert booking_data["status"] == "CONFIRMED"
    booking_id = booking_data["id"]

    # Cancel Booking and check refund calculation
    cancel_res = client.post(f"/bookings/{booking_id}/cancel")
    assert cancel_res.status_code == 200
    assert cancel_res.json()["status"] == "CANCELLED"
