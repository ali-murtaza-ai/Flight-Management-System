-- =========================================================================================
-- N8N AUTOMATION WORKFLOW: WAITLIST AUTO-PROMOTION
-- Dual-Writer Pattern: n8n connects directly to Supabase PostgreSQL ledger.
--
-- Why SELECT ... FOR UPDATE SKIP LOCKED is mandatory:
-- 1. FastAPI is servicing live user web traffic using `SELECT ... FOR UPDATE` locks.
-- 2. If n8n used a standard `FOR UPDATE` lock, it could block live FastAPI requests.
-- 3. `SKIP LOCKED` tells PostgreSQL: "Lock available waitlist rows for promotion processing. 
--    If FastAPI or another worker is currently touching a row, skip it instantly without waiting!"
-- =========================================================================================

-- STEP 1: Find flights with available seats and matching waitlisted passengers
WITH AvailableInventory AS (
    SELECT 
        sa.flight_id,
        sa.seat_class,
        sa.available_seats
    FROM seat_allocations sa
    JOIN flights f ON f.id = sa.flight_id
    WHERE sa.available_seats > 0
      AND f.status = 'SCHEDULED'
),
CandidateWaitlist AS (
    SELECT 
        w.id AS waitlist_id,
        w.flight_id,
        w.user_id,
        w.passenger_email,
        w.seat_class,
        w.seat_count,
        ai.available_seats
    FROM waitlist w
    JOIN AvailableInventory ai 
      ON w.flight_id = ai.flight_id 
     AND w.seat_class = ai.seat_class
    WHERE w.status = 'WAITING'
      AND w.seat_count <= ai.available_seats
    ORDER BY w.created_at ASC
    -- Lock candidate waitlist rows without blocking live FastAPI queries
    FOR UPDATE OF w SKIP LOCKED
)
-- Select top candidates for n8n cron iteration
SELECT 
    waitlist_id,
    flight_id,
    user_id,
    passenger_email,
    seat_class,
    seat_count
FROM CandidateWaitlist;


-- STEP 2: Atomic State Updates (Executed per promoted waitlist entry in n8n PostgreSQL node)
-- Transaction Block:
BEGIN;

-- A. Decrement available seats in inventory
UPDATE seat_allocations
SET available_seats = available_seats - :seat_count
WHERE flight_id = :flight_id 
  AND seat_class = :seat_class;

-- B. Update waitlist status to PROMOTED
UPDATE waitlist
SET status = 'PROMOTED'
WHERE id = :waitlist_id;

-- C. Create confirmed booking entry for promoted passenger
INSERT INTO bookings (
    id, hold_id, flight_id, user_id, passenger_name, passenger_email, 
    seat_class, seat_count, total_fare, cancellation_fee, refund_amount, 
    status, created_at
) VALUES (
    gen_random_uuid(), NULL, :flight_id, :user_id, 'Promoted Waitlist Passenger', :passenger_email,
    :seat_class, :seat_count, 0.00, 0.00, 0.00,
    'CONFIRMED', CURRENT_TIMESTAMP
);

COMMIT;
