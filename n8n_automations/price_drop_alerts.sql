-- =========================================================================================
-- N8N AUTOMATION WORKFLOW: PRICE-DROP ALERTS & FARE MONITORING
-- Dual-Writer Pattern: n8n queries current base prices against registered waitlist/user queries.
-- =========================================================================================

SELECT 
    f.id AS flight_id,
    f.flight_number,
    f.origin,
    f.destination,
    f.departure_time,
    fr.seat_class,
    fr.base_price,
    w.passenger_email
FROM fare_rules fr
JOIN seat_allocations sa ON sa.seat_class = fr.seat_class
JOIN flights f ON f.id = sa.flight_id
JOIN waitlist w ON w.flight_id = f.id AND w.seat_class = sa.seat_class
WHERE f.status = 'SCHEDULED'
  AND w.status = 'WAITING'
ORDER BY fr.base_price ASC;
