from contextlib import asynccontextmanager
from typing import List, Optional
from datetime import date
from fastapi import FastAPI, Depends, HTTPException, Query, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from database import engine, Base, get_db
import models
import schemas
import crud

# Automatic schema creation & default fare rules seeding on app startup
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize database tables
    Base.metadata.create_all(bind=engine)

    # Seed initial default fare rules if database is empty
    db = next(get_db())
    try:
        existing_rules = crud.get_all_fare_rules(db)
        if not existing_rules:
            default_rules = [
                schemas.FareRuleCreate(
                    seat_class=models.SeatClass.FIRST,
                    base_price=1200.0,
                    cancellation_fee_percent=0.0,
                    is_refundable=True,
                    policy_description="First Class Policy: 100% refundable up to departure. Premium lounge access included."
                ),
                schemas.FareRuleCreate(
                    seat_class=models.SeatClass.BUSINESS,
                    base_price=600.0,
                    cancellation_fee_percent=10.0,
                    is_refundable=True,
                    policy_description="Business Class Policy: Refundable with 10% cancellation fee. Priority boarding included."
                ),
                schemas.FareRuleCreate(
                    seat_class=models.SeatClass.ECONOMY,
                    base_price=250.0,
                    cancellation_fee_percent=25.0,
                    is_refundable=True,
                    policy_description="Economy Class Policy: Refundable with 25% cancellation fee up to 24h prior to flight."
                ),
            ]
            for rule in default_rules:
                crud.create_or_update_fare_rule(db, rule)
    finally:
        db.close()

    yield


app = FastAPI(
    title="Flight Management System API",
    description="Dual-Writer Flight Booking Engine & Supabase PostgreSQL Ledger",
    version="1.0.0",
    lifespan=lifespan
)

from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import os

# Enable CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health", tags=["Health"])
def health_check():
    return {
        "status": "online",
        "service": "Flight Management System API",
        "dual_writer": "FastAPI (Synchronous API) + n8n (Background Automation Engine)",
        "ledger": "Supabase PostgreSQL"
    }


# Mount React static assets from frontend/dist
frontend_dist_path = os.path.join(os.path.dirname(__file__), "frontend", "dist")
if os.path.exists(frontend_dist_path):
    assets_path = os.path.join(frontend_dist_path, "assets")
    if os.path.exists(assets_path):
        app.mount("/assets", StaticFiles(directory=assets_path), name="assets")

    @app.get("/", include_in_schema=False)
    def serve_frontend_index():
        return FileResponse(os.path.join(frontend_dist_path, "index.html"))


# ==========================================
# 1. ADMIN & FLIGHT MANAGEMENT
# ==========================================

@app.post("/admin/flights", response_model=schemas.FlightResponse, status_code=status.HTTP_201_CREATED, tags=["Admin"])
def create_flight(flight_data: schemas.FlightCreate, db: Session = Depends(get_db)):
    """
    Creates a new flight with specified seat class allocations.
    Validation: Sum of seat class allocations must sum EXACTLY to declared aircraft capacity.
    Rejects duplicate flight numbers for the same route and departure date.
    """
    return crud.create_flight(db, flight_data)


@app.put("/admin/flights/{flight_id}", response_model=schemas.FlightResponse, tags=["Admin"])
def update_flight(flight_id: str, update_data: schemas.FlightUpdate, db: Session = Depends(get_db)):
    """
    Updates flight departure, arrival times, capacity, or status.
    """
    return crud.update_flight(db, flight_id, update_data)


@app.post("/admin/flights/{flight_id}/cancel", response_model=schemas.FlightResponse, tags=["Admin"])
def cancel_flight(flight_id: str, db: Session = Depends(get_db)):
    """
    Cancels a flight, releases active holds, and refunds all confirmed passenger bookings 100%.
    """
    return crud.cancel_flight(db, flight_id)


# ==========================================
# 2. SEARCH & FARE RULES
# ==========================================

@app.get("/flights/search", response_model=List[schemas.FlightResponse], tags=["Search & Fare Rules"])
def search_flights(
    origin: Optional[str] = Query(None, min_length=3, max_length=3, description="3-letter airport code (e.g. JFK)"),
    destination: Optional[str] = Query(None, min_length=3, max_length=3, description="3-letter airport code (e.g. LAX)"),
    travel_date: Optional[date] = Query(None, description="Departure date YYYY-MM-DD"),
    seat_class: Optional[models.SeatClass] = Query(None, description="Filter by seat class"),
    min_available_seats: int = Query(1, gt=0, description="Minimum available seats required"),
    db: Session = Depends(get_db)
):
    """
    Search available flights and available seat counts per class for a given route and date.
    """
    filter_params = schemas.FlightSearchFilter(
        origin=origin,
        destination=destination,
        travel_date=travel_date,
        seat_class=seat_class,
        min_available_seats=min_available_seats
    )
    return crud.search_flights(db, filter_params)


@app.get("/fare-rules", response_model=List[schemas.FareRuleResponse], tags=["Search & Fare Rules"])
def get_fare_rules(db: Session = Depends(get_db)):
    """
    Returns cancellation penalties, prices, and refund rules per seat class.
    """
    return crud.get_all_fare_rules(db)


@app.post("/admin/fare-rules", response_model=schemas.FareRuleResponse, tags=["Admin"])
def create_or_update_fare_rule(rule_data: schemas.FareRuleCreate, db: Session = Depends(get_db)):
    """
    Creates or updates fare policy rules per seat class.
    """
    return crud.create_or_update_fare_rule(db, rule_data)


# ==========================================
# 3. SEAT HOLDS & BOOKING (ATOMIC CONCURRENCY)
# ==========================================

@app.post("/holds", response_model=schemas.SeatHoldResponse, status_code=status.HTTP_201_CREATED, tags=["Seat Holds & Bookings"])
def create_seat_hold(hold_data: schemas.SeatHoldCreate, db: Session = Depends(get_db)):
    """
    Temporary seat hold during checkout.
    Uses PostgreSQL SELECT ... FOR UPDATE row-level locks on seat_allocations table.
    Guarantees atomic seat decrement to prevent overselling under parallel concurrent requests.
    """
    return crud.create_seat_hold(db, hold_data)


@app.post("/holds/cleanup", tags=["Seat Holds & Bookings"])
def release_expired_holds(db: Session = Depends(get_db)):
    """
    Manually or programmatically releases expired seat holds back into available inventory.
    """
    count = crud.release_expired_holds(db)
    return {"status": "success", "released_holds_count": count}


@app.post("/bookings", response_model=schemas.BookingResponse, status_code=status.HTTP_201_CREATED, tags=["Seat Holds & Bookings"])
def confirm_booking(booking_data: schemas.BookingCreate, db: Session = Depends(get_db)):
    """
    Confirms booking from an active seat hold or executes direct booking.
    Calculates total fare based on class fare rules.
    """
    return crud.confirm_booking(db, booking_data)


# ==========================================
# 4. CANCELLATIONS, REFUNDS & WAITLIST
# ==========================================

@app.post("/bookings/{booking_id}/cancel", response_model=schemas.BookingCancelResponse, tags=["Cancellations & Waitlist"])
def cancel_booking(booking_id: str, db: Session = Depends(get_db)):
    """
    Cancels a booking according to class fare policy, calculates cancellation fee & refund,
    and returns available seats back to the flight inventory.
    """
    return crud.cancel_booking(db, booking_id)


@app.post("/waitlist", response_model=schemas.WaitlistResponse, status_code=status.HTTP_201_CREATED, tags=["Cancellations & Waitlist"])
def add_to_waitlist(waitlist_data: schemas.WaitlistCreate, db: Session = Depends(get_db)):
    """
    Adds a passenger to the flight waitlist when a seat class or flight is fully booked.
    n8n will periodically poll waitlisted passengers using SELECT ... FOR UPDATE SKIP LOCKED.
    """
    return crud.add_to_waitlist(db, waitlist_data)
