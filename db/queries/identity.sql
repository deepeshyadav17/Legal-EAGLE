-- name: GetUserByEmail :one
SELECT * FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1;

-- name: GetUserByID :one
SELECT * FROM users WHERE id = $1 OR external_id = $2 LIMIT 1;

-- name: CreateUser :one
INSERT INTO users (external_id, email, password_hash, role, name, profile_id, representative)
VALUES ($1, $2, $3, $4, $5, $6, $7)
RETURNING *;

-- name: CreateRefreshSession :one
INSERT INTO refresh_sessions (user_id, token_hash, user_agent, ip_address, expires_at)
VALUES ($1, $2, $3, $4, $5)
RETURNING *;

-- name: GetActiveRefreshSession :one
SELECT * FROM refresh_sessions
WHERE token_hash = $1 AND revoked_at IS NULL AND expires_at > NOW()
LIMIT 1;

-- name: RevokeRefreshSession :exec
UPDATE refresh_sessions
SET revoked_at = NOW(), replaced_by_id = $2
WHERE id = $1;

