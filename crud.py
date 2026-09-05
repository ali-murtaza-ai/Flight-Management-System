import os
from datetime import datetime, timezone, timedelta
from typing import List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import func, cast, Date, select
from fastapi import HTTPException, status

from models import (
    Flight, SeatAllocation, SeatHold, Booking, Waitlist, FareRule,
    SeatClass, FlightStatus, HoldStatus, BookingStatus, WaitlistStatus, utc_now
)
from schemas import (
    FlightCreate, FlightUpdate, FlightSearchFilter,
    SeatHoldCreate, BookingCreate, WaitlistCreate, FareRuleCreate
)

HOLD_DURATION_MINUTES = int(os.getenv("SEAT_HOLD_DURATION_MINUTES", "10"))

# =========================================================================================
# WHY ATOMIC TRANSACTIONS & ROW LOCKS ARE CRITICAL HERE:
# In high-concurrency flight booking applications, multiple users try to book/hold seats 
# at the exact same millisecond. 
# Without `with_for_update()` row-level database locks, two parallel threads can read 
# `available_seats = 1`, both validate that a seat is available, and both commit 
# decrements—resulting in overbooking (negative seat inventory).
#
# Using PostgreSQL `SELECT ... FOR UPDATE` forces concurrent DB transactions to queue up 
# serially at the database engine level, guaranteeing true linearizability and ledger accuracy.
# =========================================================================================

# --- ADMIN & FLIGHT OPERATIONS ---

def create_flight(db: Session, flight_data: FlightCreate) -> Flight:
    """
    Creates a flight and its associated seat class allocations.
    Enforces duplicate flight number detection for the same departure date.
    """
    departure_date = flight_data.departure_time.date()
    
    # 1. Duplicate flight detection check for same route & departure date
    existing_flight = db.query(Flight).filter(
        Flight.flight_number == flight_data.flight_number,
        Flight.origin == flight_data.origin,
        Flight.destination == flight_data.destination,
        func.date(Flight.departure_time) == departure_date,
        Flight.status != FlightStatus.CANCELLED
    ).first()

    if existing_flight:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Flight {flight_data.flight_number} from {flight_data.origin} to {flight_data.destination} "
                   f"is already scheduled on date {departure_date}."
        )

    # 2. Instantiate Flight object
    new_flight = Flight(
        flight_number=flight_data.flight_number,
        origin=flight_data.origin,
        destination=flight_data.destination,
        departure_time=flight_data.departure_time,
        arrival_time=flight_data.arrival_time,
        capacity=flight_data.capacity,
        status=FlightStatus.SCHEDULED
    )
    db.add(new_flight)
    db.flush()  # Populates new_flight.id

    # 3. Create Seat Allocations
    for alloc_data in flight_data.allocations:
        seat_alloc = SeatAllocation(
            flight_id=new_flight.id,
            seat_class=alloc_data.seat_class,
            total_seats=alloc_data.total_seats,
            available_seats=alloc_data.total_seats,
            held_seats=0
        )
        db.add(seat_alloc)

    db.commit()
    db.refresh(new_flight)
    return new_flight


def get_flight_by_id(db: Session, flight_id: str) -> Optional[Flight]:
    return db.query(Flight).filter(Flight.id == flight_id).first()


def update_flight(db: Session, flight_id: str, update_data: FlightUpdate) -> Flight:
    flight = get_flight_by_id(db, flight_id)
    if not flight:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Flight not found.")

    update_dict = update_data.model_dump(exclude_unset=True)
    for key, value in update_dict.items():
        setattr(flight, key, value)

    db.commit()
    db.refresh(flight)
    return flight


def cancel_flight(db: Session, flight_id: str) -> Flight:
    """
    Cancels a flight, releases all seat holds, and cancels bookings with 100% full refund.
    """
    flight = db.query(Flight).filter(Flight.id == flight_id).with_for_update().first()
    if not flight:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Flight not found.")

    flight.status = FlightStatus.CANCELLED

    # Release active seat holds
    db.query(SeatHold).filter(
        SeatHold.flight_id == flight_id,
        SeatHold.status == HoldStatus.HELD
    ).update({"status": HoldStatus.RELEASED}, synchronize_session=False)

    # Cancel confirmed bookings with 100% full refund
    bookings = db.query(Booking).filter(
        Booking.flight_id == flight_id,
        Booking.status == BookingStatus.CONFIRMED
    ).all()

    for booking in bookings:
        booking.status = BookingStatus.CANCELLED
        booking.refund_amount = booking.total_fare
        booking.cancellation_fee = 0.0

    db.commit()
    db.refresh(flight)
    return flight


# --- SEARCH OPERATIONS ---

def search_flights(db: Session, filter_params: FlightSearchFilter) -> List[Flight]:
    """
    Returns available scheduled flights with available seats per class.
    """
    query = db.query(Flight).filter(Flight.status == FlightStatus.SCHEDULED)

    if filter_params.origin:
        query = query.filter(Flight.origin == filter_params.origin.upper())

    if filter_params.destination:
        query = query.filter(Flight.destination == filter_params.destination.upper())

    if filter_params.travel_date:
        query = query.filter(func.date(Flight.departure_time) == filter_params.travel_date)

    flights = query.all()

    # Filter flights that have available seats matching requested seat_class & count
    matching_flights = []
    for flight in flights:
        has_matching_class = False
        for alloc in flight.allocations:
            if filter_params.seat_class and alloc.seat_class != filter_params.seat_class:
                continue
            if alloc.available_seats >= filter_params.min_available_seats:
                has_matching_class = True
                break
        if has_matching_class:
            matching_flights.append(flight)

    return matching_flights


# --- SEAT HOLDS & BOOKING (ATOMIC CONCURRENCY CONTROL) ---

def create_seat_hold(db: Session, hold_data: SeatHoldCreate) -> SeatHold:
    """
    ATOMIC SEAT HOLD:
    Uses `SELECT ... FOR UPDATE` to lock the seat_allocations row.
    Decrements available_seats and increments held_seats atomically.
    Guarantees group booking atomicity (all seats hold or transaction fails).
    """
    # 1. Row Lock on Seat Allocation
    allocation = db.query(SeatAllocation).filter(
        SeatAllocation.flight_id == hold_data.flight_id,
        SeatAllocation.seat_class == hold_data.seat_class
    ).with_for_update().first()

    if not allocation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Seat class '{hold_data.seat_class}' not found for specified flight."
        )

    # 2. Atomic Inventory Check
    if allocation.available_seats < hold_data.seat_count:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Requested {hold_data.seat_count} seats unavailable. "
                   f"Only {allocation.available_seats} seats remaining in {hold_data.seat_class} class."
        )

    # 3. State Mutations
    allocation.available_seats -= hold_data.seat_count
    allocation.held_seats += hold_data.seat_count

    expires_at = utc_now() + timedelta(minutes=HOLD_DURATION_MINUTES)
    seat_hold = SeatHold(
        flight_id=hold_data.flight_id,
        seat_class=hold_data.seat_class,
        seat_count=hold_data.seat_count,
        user_id=hold_data.user_id,
        status=HoldStatus.HELD,
        expires_at=expires_at
    )
    db.add(seat_hold)
    db.commit()
    db.refresh(seat_hold)
    return seat_hold


def confirm_booking(db: Session, booking_data: BookingCreate) -> Booking:
    """
    ATOMIC BOOKING CONFIRMATION:
    Converts a valid hold into a confirmed booking, or performs a direct booking.
    Calculates total fare dynamically based on registered FareRules.
    """
    # Determine base price per seat from FareRule table
    fare_rule = db.query(FareRule).filter(FareRule.seat_class == booking_data.seat_class).first()
    base_price = float(fare_rule.base_price) if fare_rule else 100.0
    calculated_total_fare = base_price * booking_data.seat_count

    if booking_data.hold_id:
        # Case A: Booking from active SeatHold
        hold = db.query(SeatHold).filter(
            SeatHold.id == booking_data.hold_id,
            SeatHold.user_id == booking_data.user_id,
            SeatHold.status == HoldStatus.HELD
        ).with_for_update().first()

        if not hold:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Active seat hold not found or expired."
            )

        hold_expires = hold.expires_at if hold.expires_at.tzinfo else hold.expires_at.replace(tzinfo=timezone.utc)
        if hold_expires < utc_now():
            hold.status = HoldStatus.EXPIRED
            db.commit()
            raise HTTPException(
                status_code=status.HTTP_410_GONE,
                detail="Seat hold has expired. Please create a new seat hold."
            )

        # Lock allocation row
        allocation = db.query(SeatAllocation).filter(
            SeatAllocation.flight_id == hold.flight_id,
            SeatAllocation.seat_class == hold.seat_class
        ).with_for_update().first()

        # Update allocation & hold state
        allocation.held_seats -= hold.seat_count
        hold.status = HoldStatus.CONFIRMED

        new_booking = Booking(
            hold_id=hold.id,
            flight_id=hold.flight_id,
            user_id=booking_data.user_id,
            passenger_name=booking_data.passenger_name,
            passenger_email=booking_data.passenger_email,
            seat_class=hold.seat_class,
            seat_count=hold.seat_count,
            total_fare=calculated_total_fare,
            status=BookingStatus.CONFIRMED
        )
    else:
        # Case B: Direct booking without hold
        allocation = db.query(SeatAllocation).filter(
            SeatAllocation.flight_id == booking_data.flight_id,
            SeatAllocation.seat_class == booking_data.seat_class
        ).with_for_update().first()

        if not allocation or allocation.available_seats < booking_data.seat_count:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Requested {booking_data.seat_count} seats unavailable in {booking_data.seat_class} class."
            )

        allocation.available_seats -= booking_data.seat_count

        new_booking = Booking(
            flight_id=booking_data.flight_id,
            user_id=booking_data.user_id,
            passenger_name=booking_data.passenger_name,
            passenger_email=booking_data.passenger_email,
            seat_class=booking_data.seat_class,
            seat_count=booking_data.seat_count,
            total_fare=calculated_total_fare,
            status=BookingStatus.CONFIRMED
        )

    db.add(new_booking)
    db.commit()
    db.refresh(new_booking)
    return new_booking


def release_expired_holds(db: Session) -> int:
    """
    Cleans up expired seat holds and restores held_seats back to available_seats.
    Returns the count of released hold records.
    """
    active_holds = db.query(SeatHold).filter(
        SeatHold.status == HoldStatus.HELD
    ).all()

    now = utc_now()
    released_count = 0
    for hold in active_holds:
        hold_expires = hold.expires_at if hold.expires_at.tzinfo else hold.expires_at.replace(tzinfo=timezone.utc)
        if hold_expires <= now:
            allocation = db.query(SeatAllocation).filter(
                SeatAllocation.flight_id == hold.flight_id,
                SeatAllocation.seat_class == hold.seat_class
            ).with_for_update().first()

            if allocation:
                allocation.held_seats = max(0, allocation.held_seats - hold.seat_count)
                allocation.available_seats += hold.seat_count

            hold.status = HoldStatus.EXPIRED
            released_count += 1

    db.commit()
    return released_count


# --- CANCELLATIONS, REFUNDS & WAITLIST ---

def cancel_booking(db: Session, booking_id: str) -> dict:
    """
    Cancels a confirmed booking, calculates refund according to FareRule penalty %,
    and restores available seats back to the flight allocation table.
    """
    booking = db.query(Booking).filter(
        Booking.id == booking_id,
        Booking.status == BookingStatus.CONFIRMED
    ).with_for_update().first()

    if not booking:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Active booking not found or already cancelled."
        )

    # Fetch fare policy
    fare_rule = db.query(FareRule).filter(FareRule.seat_class == booking.seat_class).first()
    
    if fare_rule and not fare_rule.is_refundable:
        cancellation_fee = float(booking.total_fare)
        refund_amount = 0.0
    elif fare_rule:
        fee_percent = float(fare_rule.cancellation_fee_percent)
        cancellation_fee = (fee_percent / 100.0) * float(booking.total_fare)
        refund_amount = float(booking.total_fare) - cancellation_fee
    else:
        # Default policy fallback: 10% fee
        cancellation_fee = 0.10 * float(booking.total_fare)
        refund_amount = float(booking.total_fare) - cancellation_fee

    booking.status = BookingStatus.CANCELLED
    booking.cancellation_fee = cancellation_fee
    booking.refund_amount = refund_amount

    # Restore available seats
    allocation = db.query(SeatAllocation).filter(
        SeatAllocation.flight_id == booking.flight_id,
        SeatAllocation.seat_class == booking.seat_class
    ).with_for_update().first()

    if allocation:
        allocation.available_seats += booking.seat_count

    db.commit()

    return {
        "booking_id": booking.id,
        "status": BookingStatus.CANCELLED,
        "refund_amount": refund_amount,
        "cancellation_fee": cancellation_fee,
        "message": f"Booking successfully cancelled. Refund of ${refund_amount:.2f} processed."
    }


def add_to_waitlist(db: Session, waitlist_data: WaitlistCreate) -> Waitlist:
    """
    Adds a passenger to the waitlist when a flight class is fully booked.
    """
    flight = get_flight_by_id(db, waitlist_data.flight_id)
    if not flight:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Flight not found.")

    waitlist_entry = Waitlist(
        flight_id=waitlist_data.flight_id,
        user_id=waitlist_data.user_id,
        passenger_email=waitlist_data.passenger_email,
        seat_class=waitlist_data.seat_class,
        seat_count=waitlist_data.seat_count,
        status=WaitlistStatus.WAITING
    )
    db.add(waitlist_entry)
    db.commit()
    db.refresh(waitlist_entry)
    return waitlist_entry


# --- FARE RULES MANAGEMENT ---

def create_or_update_fare_rule(db: Session, rule_data: FareRuleCreate) -> FareRule:
    existing_rule = db.query(FareRule).filter(FareRule.seat_class == rule_data.seat_class).first()
    if existing_rule:
        existing_rule.base_price = rule_data.base_price
        existing_rule.cancellation_fee_percent = rule_data.cancellation_fee_percent
        existing_rule.is_refundable = rule_data.is_refundable
        existing_rule.policy_description = rule_data.policy_description
        db.commit()
        db.refresh(existing_rule)
        return existing_rule

    new_rule = FareRule(
        seat_class=rule_data.seat_class,
        base_price=rule_data.base_price,
        cancellation_fee_percent=rule_data.cancellation_fee_percent,
        is_refundable=rule_data.is_refundable,
        policy_description=rule_data.policy_description
    )
    db.add(new_rule)
    db.commit()
    db.refresh(new_rule)
    return new_rule


def get_all_fare_rules(db: Session) -> List[FareRule]:
    return db.query(FareRule).all()
