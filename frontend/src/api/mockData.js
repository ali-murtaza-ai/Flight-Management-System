export const INITIAL_FARE_RULES = [
  {
    id: "fr-1",
    seat_class: "FIRST",
    base_price: 1200.0,
    cancellation_fee_percent: 0.0,
    is_refundable: true,
    policy_description: "First Class Suite: 100% full refund up to 2 hours before flight. 2 free checked bags & lounge access."
  },
  {
    id: "fr-2",
    seat_class: "BUSINESS",
    base_price: 650.0,
    cancellation_fee_percent: 10.0,
    is_refundable: true,
    policy_description: "Business Class: Refundable with 10% fee. Priority check-in, legroom suite & meal service."
  },
  {
    id: "fr-3",
    seat_class: "ECONOMY",
    base_price: 250.0,
    cancellation_fee_percent: 25.0,
    is_refundable: true,
    policy_description: "Economy Class: Refundable with 25% fee up to 24h before departure. 1 standard carry-on item."
  }
];

export const INITIAL_FLIGHTS = [
  {
    id: "flt-101",
    flight_number: "SK-101",
    origin: "JFK",
    destination: "LAX",
    departure_time: new Date(Date.now() + 86400000 * 2).toISOString(),
    arrival_time: new Date(Date.now() + 86400000 * 2 + 18000000).toISOString(),
    capacity: 180,
    status: "SCHEDULED",
    created_at: new Date().toISOString(),
    allocations: [
      { id: "alloc-1", seat_class: "FIRST", total_seats: 12, available_seats: 4, held_seats: 1 },
      { id: "alloc-2", seat_class: "BUSINESS", total_seats: 36, available_seats: 12, held_seats: 2 },
      { id: "alloc-3", seat_class: "ECONOMY", total_seats: 132, available_seats: 45, held_seats: 5 }
    ]
  },
  {
    id: "flt-202",
    flight_number: "SK-202",
    origin: "SFO",
    destination: "ORD",
    departure_time: new Date(Date.now() + 86400000 * 3).toISOString(),
    arrival_time: new Date(Date.now() + 86400000 * 3 + 14400000).toISOString(),
    capacity: 150,
    status: "SCHEDULED",
    created_at: new Date().toISOString(),
    allocations: [
      { id: "alloc-4", seat_class: "FIRST", total_seats: 10, available_seats: 0, held_seats: 0 },
      { id: "alloc-5", seat_class: "BUSINESS", total_seats: 30, available_seats: 2, held_seats: 1 },
      { id: "alloc-6", seat_class: "ECONOMY", total_seats: 110, available_seats: 8, held_seats: 0 }
    ]
  },
  {
    id: "flt-303",
    flight_number: "SK-303",
    origin: "MIA",
    destination: "LHR",
    departure_time: new Date(Date.now() + 86400000 * 4).toISOString(),
    arrival_time: new Date(Date.now() + 86400000 * 4 + 28800000).toISOString(),
    capacity: 220,
    status: "SCHEDULED",
    created_at: new Date().toISOString(),
    allocations: [
      { id: "alloc-7", seat_class: "FIRST", total_seats: 20, available_seats: 8, held_seats: 0 },
      { id: "alloc-8", seat_class: "BUSINESS", total_seats: 50, available_seats: 15, held_seats: 0 },
      { id: "alloc-9", seat_class: "ECONOMY", total_seats: 150, available_seats: 80, held_seats: 0 }
    ]
  }
];

export const INITIAL_BOOKINGS = [
  {
    id: "bkg-1001",
    flight_id: "flt-101",
    user_id: "usr-alpha",
    passenger_name: "Sarah Connor",
    passenger_email: "sarah.connor@skyledger.com",
    seat_class: "FIRST",
    seat_count: 1,
    total_fare: 1200.0,
    cancellation_fee: 0.0,
    refund_amount: 0.0,
    status: "CONFIRMED",
    created_at: new Date(Date.now() - 3600000 * 5).toISOString()
  },
  {
    id: "bkg-1002",
    flight_id: "flt-101",
    user_id: "usr-beta",
    passenger_name: "Marcus Aurelius",
    passenger_email: "marcus@rome.org",
    seat_class: "BUSINESS",
    seat_count: 2,
    total_fare: 1300.0,
    cancellation_fee: 0.0,
    refund_amount: 0.0,
    status: "CONFIRMED",
    created_at: new Date(Date.now() - 3600000 * 2).toISOString()
  }
];

export const INITIAL_WAITLIST = [
  {
    id: "wt-901",
    flight_id: "flt-202",
    user_id: "usr-gamma",
    passenger_email: "alex.tech@domain.com",
    seat_class: "FIRST",
    seat_count: 1,
    status: "WAITING",
    created_at: new Date(Date.now() - 3600000 * 12).toISOString()
  },
  {
    id: "wt-902",
    flight_id: "flt-202",
    user_id: "usr-delta",
    passenger_email: "clara.oswald@tardis.uk",
    seat_class: "BUSINESS",
    seat_count: 2,
    status: "WAITING",
    created_at: new Date(Date.now() - 3600000 * 4).toISOString()
  }
];
