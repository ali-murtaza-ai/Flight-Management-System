import uuid
from datetime import datetime, timezone
import enum
from sqlalchemy import (
    Column, String, Integer, Numeric, Boolean, DateTime, Enum, 
    ForeignKey, UniqueConstraint, CheckConstraint, Text
)
from sqlalchemy.orm import relationship, Mapped, mapped_column
from database import Base

def generate_uuid() -> str:
    """Helper to generate string representation of UUID4."""
    return str(uuid.uuid4())

def utc_now() -> datetime:
    """Helper to generate timezone-aware UTC timestamp."""
    return datetime.now(timezone.utc)


class SeatClass(str, enum.Enum):
    FIRST = "FIRST"
    BUSINESS = "BUSINESS"
    ECONOMY = "ECONOMY"


class FlightStatus(str, enum.Enum):
    SCHEDULED = "SCHEDULED"
    CANCELLED = "CANCELLED"
    COMPLETED = "COMPLETED"


class HoldStatus(str, enum.Enum):
    HELD = "HELD"
    CONFIRMED = "CONFIRMED"
    EXPIRED = "EXPIRED"
    RELEASED = "RELEASED"


class BookingStatus(str, enum.Enum):
    CONFIRMED = "CONFIRMED"
    CANCELLED = "CANCELLED"
    REFUNDED = "REFUNDED"


class WaitlistStatus(str, enum.Enum):
    WAITING = "WAITING"
    PROMOTED = "PROMOTED"
    EXPIRED = "EXPIRED"
    CANCELLED = "CANCELLED"


# =====================================================================
# TABLE OWNERSHIP & CONCURRENCY CONSTRAINTS
# FastAPI: Sole writer for live user holds, bookings, and flight setup.
# n8n: Reads live tables, writes to waitlist promotions & notifications.
# Ledger of Truth: Supabase PostgreSQL database.
# =====================================================================

class Flight(Base):
    __tablename__ = "flights"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    flight_number: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    origin: Mapped[str] = mapped_column(String(3), nullable=False, index=True)
    destination: Mapped[str] = mapped_column(String(3), nullable=False, index=True)
    departure_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    arrival_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    capacity: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[FlightStatus] = mapped_column(Enum(FlightStatus), default=FlightStatus.SCHEDULED, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)

    # Relationships
    allocations = relationship("SeatAllocation", back_populates="flight", cascade="all, delete-orphan")
    holds = relationship("SeatHold", back_populates="flight", cascade="all, delete-orphan")
    bookings = relationship("Booking", back_populates="flight", cascade="all, delete-orphan")
    waitlist_entries = relationship("Waitlist", back_populates="flight", cascade="all, delete-orphan")

    __table_args__ = (
        # Reject duplicate flights operating with the same flight number at the exact departure time
        UniqueConstraint("flight_number", "departure_time", name="uq_flight_number_departure"),
        CheckConstraint("capacity > 0", name="chk_flight_capacity_positive"),
    )


class SeatAllocation(Base):
    """
    Tracks seat class inventory per flight.
    FastAPI performs SELECT FOR UPDATE on this row during seat hold requests
    to guarantee zero overbooking under high concurrency.
    """
    __tablename__ = "seat_allocations"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    flight_id: Mapped[str] = mapped_column(String(36), ForeignKey("flights.id", ondelete="CASCADE"), nullable=False, index=True)
    seat_class: Mapped[SeatClass] = mapped_column(Enum(SeatClass), nullable=False)
    total_seats: Mapped[int] = mapped_column(Integer, nullable=False)
    available_seats: Mapped[int] = mapped_column(Integer, nullable=False)
    held_seats: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    flight = relationship("Flight", back_populates="allocations")

    __table_args__ = (
        UniqueConstraint("flight_id", "seat_class", name="uq_flight_seat_class"),
        CheckConstraint("total_seats > 0", name="chk_total_seats_positive"),
        CheckConstraint("available_seats >= 0", name="chk_available_seats_non_negative"),
        CheckConstraint("held_seats >= 0", name="chk_held_seats_non_negative"),
    )


class SeatHold(Base):
    """
    Temporary seat holds created during checkout flow.
    If payment/booking is confirmed, seat moves from held to booked.
    If hold expires, n8n or FastAPI release job increments available_seats back.
    """
    __tablename__ = "seat_holds"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    flight_id: Mapped[str] = mapped_column(String(36), ForeignKey("flights.id", ondelete="CASCADE"), nullable=False, index=True)
    seat_class: Mapped[SeatClass] = mapped_column(Enum(SeatClass), nullable=False)
    seat_count: Mapped[int] = mapped_column(Integer, nullable=False)
    user_id: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    status: Mapped[HoldStatus] = mapped_column(Enum(HoldStatus), default=HoldStatus.HELD, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)

    flight = relationship("Flight", back_populates="holds")
    booking = relationship("Booking", back_populates="hold", uselist=False)

    __table_args__ = (
        CheckConstraint("seat_count > 0", name="chk_hold_seat_count_positive"),
    )


class Booking(Base):
    """
    Confirmed booking ledger. FastAPI is sole creator upon payment execution.
    """
    __tablename__ = "bookings"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    hold_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("seat_holds.id"), nullable=True)
    flight_id: Mapped[str] = mapped_column(String(36), ForeignKey("flights.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    passenger_name: Mapped[str] = mapped_column(String(150), nullable=False)
    passenger_email: Mapped[str] = mapped_column(String(150), nullable=False, index=True)
    seat_class: Mapped[SeatClass] = mapped_column(Enum(SeatClass), nullable=False)
    seat_count: Mapped[int] = mapped_column(Integer, nullable=False)
    total_fare: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    cancellation_fee: Mapped[float] = mapped_column(Numeric(10, 2), default=0.0, nullable=False)
    refund_amount: Mapped[float] = mapped_column(Numeric(10, 2), default=0.0, nullable=False)
    status: Mapped[BookingStatus] = mapped_column(Enum(BookingStatus), default=BookingStatus.CONFIRMED, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)

    flight = relationship("Flight", back_populates="bookings")
    hold = relationship("SeatHold", back_populates="booking")

    __table_args__ = (
        CheckConstraint("seat_count > 0", name="chk_booking_seat_count_positive"),
        CheckConstraint("total_fare >= 0", name="chk_total_fare_non_negative"),
    )


class Waitlist(Base):
    """
    Waitlist table shared with n8n background worker.
    When seats free up, n8n queries WAITING records using SELECT ... FOR UPDATE SKIP LOCKED
    to safely promote waitlisted passengers without locking FastAPI traffic.
    """
    __tablename__ = "waitlist"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    flight_id: Mapped[str] = mapped_column(String(36), ForeignKey("flights.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    passenger_email: Mapped[str] = mapped_column(String(150), nullable=False)
    seat_class: Mapped[SeatClass] = mapped_column(Enum(SeatClass), nullable=False)
    seat_count: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[WaitlistStatus] = mapped_column(Enum(WaitlistStatus), default=WaitlistStatus.WAITING, nullable=False, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)

    flight = relationship("Flight", back_populates="waitlist_entries")

    __table_args__ = (
        CheckConstraint("seat_count > 0", name="chk_waitlist_seat_count_positive"),
    )


class FareRule(Base):
    """
    Fare rules, prices, and cancellation terms per seat class.
    Indexed in Pinecone Vector DB for n8n policy RAG support.
    """
    __tablename__ = "fare_rules"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    seat_class: Mapped[SeatClass] = mapped_column(Enum(SeatClass), unique=True, nullable=False)
    base_price: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    cancellation_fee_percent: Mapped[float] = mapped_column(Numeric(5, 2), nullable=False)  # e.g. 20.00 for 20%
    is_refundable: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    policy_description: Mapped[str] = mapped_column(Text, nullable=False)
