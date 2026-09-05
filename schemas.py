from datetime import datetime, date
from typing import List, Optional
from pydantic import BaseModel, Field, field_validator, model_validator, ConfigDict
from models import SeatClass, FlightStatus, HoldStatus, BookingStatus, WaitlistStatus

# --- SEAT ALLOCATION SCHEMAS ---

class SeatAllocationBase(BaseModel):
    seat_class: SeatClass
    total_seats: int = Field(..., gt=0, description="Total seat capacity allocated to this class. Must be strictly positive.")

    @field_validator("total_seats")
    @classmethod
    def validate_positive_seats(cls, v: int) -> int:
        if v <= 0:
            raise ValueError("Seat allocation count must be greater than zero.")
        return v


class SeatAllocationCreate(SeatAllocationBase):
    pass


class SeatAllocationResponse(SeatAllocationBase):
    id: str
    flight_id: str
    available_seats: int
    held_seats: int

    model_config = ConfigDict(from_attributes=True)


# --- FLIGHT SCHEMAS ---

class FlightBase(BaseModel):
    flight_number: str = Field(..., min_length=2, max_length=20, json_schema_extra={"example": "AA123"})
    origin: str = Field(..., min_length=3, max_length=3, json_schema_extra={"example": "JFK"})
    destination: str = Field(..., min_length=3, max_length=3, json_schema_extra={"example": "LAX"})
    departure_time: datetime
    arrival_time: datetime
    capacity: int = Field(..., gt=0, description="Declared total aircraft passenger capacity.")

    @field_validator("origin", "destination")
    @classmethod
    def uppercase_airport_code(cls, v: str) -> str:
        return v.upper()

    @field_validator("flight_number")
    @classmethod
    def uppercase_flight_number(cls, v: str) -> str:
        return v.upper().strip()


class FlightCreate(FlightBase):
    allocations: List[SeatAllocationCreate]

    @model_validator(mode="after")
    def validate_flight_capacity_and_dates(self) -> "FlightCreate":
        # 1. Origin and destination check
        if self.origin == self.destination:
            raise ValueError("Flight origin and destination airport codes cannot be identical.")

        # 2. Schedule date check
        if self.departure_time >= self.arrival_time:
            raise ValueError("Departure time must occur before arrival time.")

        # 3. CRITICAL SPECIFICATION CHECK:
        # Seat class totals MUST sum EXACTLY to declared aircraft capacity.
        allocated_sum = sum(alloc.total_seats for alloc in self.allocations)
        if allocated_sum != self.capacity:
            raise ValueError(
                f"Invalid allocation total: sum of seat classes ({allocated_sum}) "
                f"must EXACTLY match declared total aircraft capacity ({self.capacity})."
            )

        # 4. Check for duplicate seat classes in allocation list
        classes_seen = set()
        for alloc in self.allocations:
            if alloc.seat_class in classes_seen:
                raise ValueError(f"Duplicate seat class allocation submitted for {alloc.seat_class}.")
            classes_seen.add(alloc.seat_class)

        return self


class FlightUpdate(BaseModel):
    origin: Optional[str] = Field(None, min_length=3, max_length=3)
    destination: Optional[str] = Field(None, min_length=3, max_length=3)
    departure_time: Optional[datetime] = None
    arrival_time: Optional[datetime] = None
    capacity: Optional[int] = Field(None, gt=0)
    status: Optional[FlightStatus] = None


class FlightResponse(FlightBase):
    id: str
    status: FlightStatus
    created_at: datetime
    allocations: List[SeatAllocationResponse] = []

    model_config = ConfigDict(from_attributes=True)


class FlightSearchFilter(BaseModel):
    origin: Optional[str] = None
    destination: Optional[str] = None
    travel_date: Optional[date] = None
    seat_class: Optional[SeatClass] = None
    min_available_seats: int = Field(default=1, gt=0)


# --- SEAT HOLD SCHEMAS ---

class SeatHoldCreate(BaseModel):
    flight_id: str
    seat_class: SeatClass
    seat_count: int = Field(..., gt=0, description="Number of seats to hold.")
    user_id: str = Field(..., min_length=1)

    @field_validator("seat_count")
    @classmethod
    def validate_positive_seats(cls, v: int) -> int:
        if v <= 0:
            raise ValueError("Seat count for hold must be greater than zero.")
        return v


class SeatHoldResponse(BaseModel):
    id: str
    flight_id: str
    seat_class: SeatClass
    seat_count: int
    user_id: str
    status: HoldStatus
    created_at: datetime
    expires_at: datetime

    model_config = ConfigDict(from_attributes=True)


# --- BOOKING SCHEMAS ---

class BookingCreate(BaseModel):
    flight_id: str
    hold_id: Optional[str] = Field(None, description="Optional seat hold ID if converted from temporary hold.")
    user_id: str
    passenger_name: str = Field(..., min_length=1)
    passenger_email: str = Field(..., min_length=3)
    seat_class: SeatClass
    seat_count: int = Field(..., gt=0)


class BookingResponse(BaseModel):
    id: str
    hold_id: Optional[str] = None
    flight_id: str
    user_id: str
    passenger_name: str
    passenger_email: str
    seat_class: SeatClass
    seat_count: int
    total_fare: float
    cancellation_fee: float
    refund_amount: float
    status: BookingStatus
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class BookingCancelResponse(BaseModel):
    booking_id: str
    status: BookingStatus
    refund_amount: float
    cancellation_fee: float
    message: str


# --- WAITLIST SCHEMAS ---

class WaitlistCreate(BaseModel):
    flight_id: str
    user_id: str
    passenger_email: str
    seat_class: SeatClass
    seat_count: int = Field(..., gt=0)


class WaitlistResponse(BaseModel):
    id: str
    flight_id: str
    user_id: str
    passenger_email: str
    seat_class: SeatClass
    seat_count: int
    status: WaitlistStatus
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# --- FARE RULE SCHEMAS ---

class FareRuleCreate(BaseModel):
    seat_class: SeatClass
    base_price: float = Field(..., ge=0)
    cancellation_fee_percent: float = Field(..., ge=0, le=100)
    is_refundable: bool = True
    policy_description: str


class FareRuleResponse(FareRuleCreate):
    id: str

    model_config = ConfigDict(from_attributes=True)
