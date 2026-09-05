-- =========================================================================================
-- N8N AUTOMATION WORKFLOW: 24-HOUR CHECK-IN REMINDERS
-- Dual-Writer Pattern: n8n queries Supabase Postgres directly to send Gmail alerts.
-- =========================================================================================

SELECT 
    b.id AS booking_id,
    b.passenger_name,
    b.passenger_email,
    b.seat_class,
    b.seat_count,
    f.flight_number,
    f.origin,
    f.destination,
    f.departure_time,
    f.arrival_time
FROM bookings b
JOIN flights f ON b.flight_id = f.id
WHERE b.status = 'CONFIRMED'
  AND f.status = 'SCHEDULED'
  -- Filter flights departing between 23 and 24 hours from now
  AND f.departure_time >= NOW() + INTERVAL '23 hours'
  AND f.departure_time <= NOW() + INTERVAL '25 hours';
