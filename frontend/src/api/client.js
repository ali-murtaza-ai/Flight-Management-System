import { INITIAL_FLIGHTS, INITIAL_BOOKINGS, INITIAL_WAITLIST, INITIAL_FARE_RULES } from './mockData';

const API_BASE_URL = 'http://127.0.0.1:8000';

// In-Memory State for Offline / Hybrid fallback
let localFlights = [...INITIAL_FLIGHTS];
let localBookings = [...INITIAL_BOOKINGS];
let localWaitlist = [...INITIAL_WAITLIST];
let localHolds = [];
let localFareRules = [...INITIAL_FARE_RULES];

// Helper to check backend health
export async function checkBackendHealth() {
  try {
    const res = await fetch(`${API_BASE_URL}/`, { method: 'GET' });
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    // Silent fallback to mock state
  }
  return null;
}

// 1. FLIGHTS API
export async function getFlights(searchParams = {}) {
  try {
    const query = new URLSearchParams();
    if (searchParams.origin) query.append('origin', searchParams.origin);
    if (searchParams.destination) query.append('destination', searchParams.destination);
    if (searchParams.travel_date) query.append('travel_date', searchParams.travel_date);
    if (searchParams.seat_class) query.append('seat_class', searchParams.seat_class);

    const res = await fetch(`${API_BASE_URL}/flights/search?${query.toString()}`);
    if (res.ok) {
      return await res.json();
    }
  } catch (e) {
    // Fallback to local memory
  }

  // Filter local flights
  return localFlights.filter(f => {
    if (f.status === 'CANCELLED') return false;
    if (searchParams.origin && f.origin !== searchParams.origin.toUpperCase()) return false;
    if (searchParams.destination && f.destination !== searchParams.destination.toUpperCase()) return false;
    if (searchParams.seat_class) {
      const alloc = f.allocations.find(a => a.seat_class === searchParams.seat_class);
      if (!alloc || alloc.available_seats <= 0) return false;
    }
    return true;
  });
}

export async function createFlight(flightData) {
  try {
    const res = await fetch(`${API_BASE_URL}/admin/flights`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(flightData)
    });
    if (res.ok) {
      return await res.json();
    }
    const errData = await res.json();
    throw new Error(errData.detail || 'Failed to create flight');
  } catch (err) {
    if (err.message && !err.message.includes('fetch')) {
      throw err;
    }
  }

  // Local fallback logic with strict capacity validation check
  const totalAllocated = flightData.allocations.reduce((sum, a) => sum + Number(a.total_seats), 0);
  if (totalAllocated !== Number(flightData.capacity)) {
    throw new Error(`Allocated seats sum (${totalAllocated}) must EXACTLY match aircraft capacity (${flightData.capacity})`);
  }

  // Check duplicate
  const isDuplicate = localFlights.some(
    f => f.flight_number === flightData.flight_number &&
         f.origin === flightData.origin &&
         f.destination === flightData.destination &&
         f.status !== 'CANCELLED'
  );
  if (isDuplicate) {
    throw new Error(`Flight ${flightData.flight_number} is already scheduled on this route!`);
  }

  const newFlight = {
    id: `flt-${Date.now()}`,
    flight_number: flightData.flight_number,
    origin: flightData.origin.toUpperCase(),
    destination: flightData.destination.toUpperCase(),
    departure_time: flightData.departure_time,
    arrival_time: flightData.arrival_time,
    capacity: Number(flightData.capacity),
    status: 'SCHEDULED',
    created_at: new Date().toISOString(),
    allocations: flightData.allocations.map((a, idx) => ({
      id: `alloc-${Date.now()}-${idx}`,
      seat_class: a.seat_class,
      total_seats: Number(a.total_seats),
      available_seats: Number(a.total_seats),
      held_seats: 0
    }))
  };

  localFlights.unshift(newFlight);
  return newFlight;
}

export async function cancelFlight(flightId) {
  try {
    const res = await fetch(`${API_BASE_URL}/admin/flights/${flightId}/cancel`, { method: 'POST' });
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    // Fallback
  }

  const flt = localFlights.find(f => f.id === flightId);
  if (flt) {
    flt.status = 'CANCELLED';
    localBookings.forEach(b => {
      if (b.flight_id === flightId && b.status === 'CONFIRMED') {
        b.status = 'CANCELLED';
        b.refund_amount = b.total_fare;
        b.cancellation_fee = 0.0;
      }
    });
  }
  return flt;
}

// 2. SEAT HOLDS & BOOKINGS
export async function createSeatHold(holdData) {
  try {
    const res = await fetch(`${API_BASE_URL}/holds`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(holdData)
    });
    if (res.ok) {
      return await res.json();
    }
    const errData = await res.json();
    throw new Error(errData.detail || 'Failed to create seat hold');
  } catch (err) {
    if (err.message && !err.message.includes('fetch')) throw err;
  }

  const flt = localFlights.find(f => f.id === holdData.flight_id);
  if (!flt) throw new Error('Flight not found');

  const alloc = flt.allocations.find(a => a.seat_class === holdData.seat_class);
  if (!alloc || alloc.available_seats < holdData.seat_count) {
    throw new Error(`Insufficient seats available in ${holdData.seat_class} class.`);
  }

  // Atomic state mutation
  alloc.available_seats -= holdData.seat_count;
  alloc.held_seats += holdData.seat_count;

  const newHold = {
    id: `hold-${Date.now()}`,
    flight_id: holdData.flight_id,
    seat_class: holdData.seat_class,
    seat_count: holdData.seat_count,
    user_id: holdData.user_id,
    status: 'HELD',
    created_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 600000).toISOString() // 10 minutes hold
  };

  localHolds.push(newHold);
  return newHold;
}

export async function confirmBooking(bookingData) {
  try {
    const res = await fetch(`${API_BASE_URL}/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bookingData)
    });
    if (res.ok) {
      return await res.json();
    }
    const errData = await res.json();
    throw new Error(errData.detail || 'Failed to confirm booking');
  } catch (err) {
    if (err.message && !err.message.includes('fetch')) throw err;
  }

  const fareRule = localFareRules.find(r => r.seat_class === bookingData.seat_class);
  const basePrice = fareRule ? fareRule.base_price : 200.0;
  const totalFare = basePrice * bookingData.seat_count;

  if (bookingData.hold_id) {
    const hold = localHolds.find(h => h.id === bookingData.hold_id);
    if (hold) {
      hold.status = 'CONFIRMED';
      const flt = localFlights.find(f => f.id === hold.flight_id);
      if (flt) {
        const alloc = flt.allocations.find(a => a.seat_class === hold.seat_class);
        if (alloc) alloc.held_seats = Math.max(0, alloc.held_seats - hold.seat_count);
      }
    }
  } else {
    const flt = localFlights.find(f => f.id === bookingData.flight_id);
    if (flt) {
      const alloc = flt.allocations.find(a => a.seat_class === bookingData.seat_class);
      if (alloc) alloc.available_seats -= bookingData.seat_count;
    }
  }

  const newBooking = {
    id: `bkg-${Date.now()}`,
    hold_id: bookingData.hold_id || null,
    flight_id: bookingData.flight_id,
    user_id: bookingData.user_id,
    passenger_name: bookingData.passenger_name,
    passenger_email: bookingData.passenger_email,
    seat_class: bookingData.seat_class,
    seat_count: bookingData.seat_count,
    total_fare: totalFare,
    cancellation_fee: 0.0,
    refund_amount: 0.0,
    status: 'CONFIRMED',
    created_at: new Date().toISOString()
  };

  localBookings.unshift(newBooking);
  return newBooking;
}

export async function cancelBooking(bookingId) {
  try {
    const res = await fetch(`${API_BASE_URL}/bookings/${bookingId}/cancel`, { method: 'POST' });
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    // Fallback
  }

  const bkg = localBookings.find(b => b.id === bookingId);
  if (!bkg || bkg.status !== 'CONFIRMED') throw new Error('Active booking not found.');

  const fareRule = localFareRules.find(r => r.seat_class === bkg.seat_class);
  let fee = 0.10 * bkg.total_fare;
  if (fareRule) {
    fee = (fareRule.cancellation_fee_percent / 100.0) * bkg.total_fare;
  }
  const refund = bkg.total_fare - fee;

  bkg.status = 'CANCELLED';
  bkg.cancellation_fee = fee;
  bkg.refund_amount = refund;

  // Restore inventory
  const flt = localFlights.find(f => f.id === bkg.flight_id);
  if (flt) {
    const alloc = flt.allocations.find(a => a.seat_class === bkg.seat_class);
    if (alloc) alloc.available_seats += bkg.seat_count;
  }

  return {
    booking_id: bkg.id,
    status: 'CANCELLED',
    refund_amount: refund,
    cancellation_fee: fee,
    message: `Booking cancelled successfully. Refund of $${refund.toFixed(2)} issued.`
  };
}

// 3. WAITLIST & N8N SIMULATION
export async function addToWaitlist(waitlistData) {
  try {
    const res = await fetch(`${API_BASE_URL}/waitlist`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(waitlistData)
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    // Fallback
  }

  const newEntry = {
    id: `wt-${Date.now()}`,
    flight_id: waitlistData.flight_id,
    user_id: waitlistData.user_id,
    passenger_email: waitlistData.passenger_email,
    seat_class: waitlistData.seat_class,
    seat_count: waitlistData.seat_count,
    status: 'WAITING',
    created_at: new Date().toISOString()
  };

  localWaitlist.push(newEntry);
  return newEntry;
}

export async function getWaitlist() {
  return localWaitlist;
}

export async function getBookings() {
  return localBookings;
}

export async function getFareRules() {
  return localFareRules;
}

// SIMULATE N8N AUTO-PROMOTION ENGINE (SELECT ... FOR UPDATE SKIP LOCKED)
export async function simulateN8nPromotion() {
  let promotedCount = 0;
  const promotedEntries = [];

  for (const wt of localWaitlist) {
    if (wt.status !== 'WAITING') continue;

    const flt = localFlights.find(f => f.id === wt.flight_id);
    if (!flt || flt.status === 'CANCELLED') continue;

    const alloc = flt.allocations.find(a => a.seat_class === wt.seat_class);
    if (alloc && alloc.available_seats >= wt.seat_count) {
      // Execute non-blocking promotion
      alloc.available_seats -= wt.seat_count;
      wt.status = 'PROMOTED';
      promotedCount++;
      promotedEntries.push(wt);

      // Create booking for promoted passenger
      localBookings.unshift({
        id: `bkg-p-${Date.now()}`,
        flight_id: wt.flight_id,
        user_id: wt.user_id,
        passenger_name: 'Promoted Passenger',
        passenger_email: wt.passenger_email,
        seat_class: wt.seat_class,
        seat_count: wt.seat_count,
        total_fare: 0.0,
        cancellation_fee: 0.0,
        refund_amount: 0.0,
        status: 'CONFIRMED',
        created_at: new Date().toISOString()
      });
    }
  }

  return { promotedCount, promotedEntries };
}
