-- name: GetSlotForUpdate :one
SELECT * FROM consultation_slots
WHERE (id::text = $1 OR external_id = $1)
FOR UPDATE;

-- name: UpdateSlotStatus :one
UPDATE consultation_slots
SET status = $2, reserved_until = $3, booking_id = $4, updated_at = NOW()
WHERE id = $1
RETURNING *;

-- name: GetBookingForUpdate :one
SELECT * FROM bookings
WHERE (id::text = $1 OR external_id = $1)
FOR UPDATE;

-- name: CreateBookingHold :one
INSERT INTO bookings (
    external_id, client_id, lawyer_id, firm_id,
    original_slot_id, final_slot_id, mode,
    consultation_fee, platform_fee, tax_amount, total_amount, currency,
    booking_status, hold_expires_at, client_notes, office_location, timeline
) VALUES (
    $1, $2, $3, $4,
    $5, $6, $7,
    $8, $9, $10, $11, $12,
    'PAYMENT_PENDING', $13, $14, $15, $16
) RETURNING *;

-- name: CreatePaymentOrder :one
INSERT INTO payments (
    external_id, booking_id, client_id, lawyer_id,
    amount, currency, provider, provider_order_id, status
) VALUES (
    $1, $2, $3, $4,
    $5, $6, $7, $8, 'PENDING'
) RETURNING *;

-- name: CreateRefundRecord :one
INSERT INTO refunds (
    external_id, booking_id, payment_id, client_id, lawyer_id,
    amount, currency, reason, provider_refund_id, status
) VALUES (
    $1, $2, $3, $4, $5,
    $6, $7, $8, $9, 'REFUND_INITIATED'
)
ON CONFLICT (booking_id) DO UPDATE SET reason = EXCLUDED.reason
RETURNING *;

-- name: InsertOutboxEvent :one
INSERT INTO outbox_events (aggregate_type, aggregate_id, event_type, payload)
VALUES ($1, $2, $3, $4)
RETURNING *;

-- name: PollPendingOutboxEvents :many
SELECT * FROM outbox_events
WHERE status IN ('PENDING', 'FAILED') AND next_attempt_at <= NOW() AND attempts < 5
ORDER BY created_at ASC
LIMIT $1
FOR UPDATE SKIP LOCKED;

