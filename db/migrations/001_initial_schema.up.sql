-- ============================================================================
-- Legal Eagle — PostgreSQL Initial Schema (001_initial_schema.up.sql)
-- Single source of truth for Identity, Profiles, Firms, Discovery,
-- Availability, Consultation Bookings, Payments/Refunds, Notifications,
-- Transactional Outbox, Idempotency Keys, and Audit Logs.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "btree_gist";

-- ----------------------------------------------------------------------------
-- 1. users & refresh_sessions
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    external_id     VARCHAR(64) UNIQUE,
    email           VARCHAR(255) NOT NULL UNIQUE,
    password_hash   TEXT NOT NULL,
    role            VARCHAR(32) NOT NULL CHECK (role IN ('CLIENT', 'LAWYER', 'FIRM_ADMIN', 'PLATFORM_ADMIN')),
    name            VARCHAR(255) NOT NULL,
    profile_id      VARCHAR(64) NOT NULL,
    representative  VARCHAR(255),
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users (LOWER(email));
CREATE INDEX IF NOT EXISTS idx_users_role_profile ON users (role, profile_id);

CREATE TABLE IF NOT EXISTS refresh_sessions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash      TEXT NOT NULL UNIQUE,
    user_agent      TEXT,
    ip_address      VARCHAR(64),
    expires_at      TIMESTAMPTZ NOT NULL,
    revoked_at      TIMESTAMPTZ,
    replaced_by_id  UUID REFERENCES refresh_sessions(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_refresh_sessions_user_id ON refresh_sessions (user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_sessions_expires_at ON refresh_sessions (expires_at);

-- ----------------------------------------------------------------------------
-- 2. practice_areas
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS practice_areas (
    slug            VARCHAR(64) PRIMARY KEY,
    name            VARCHAR(128) NOT NULL,
    description     TEXT NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 3. client_profiles
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS client_profiles (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    external_id     VARCHAR(64) NOT NULL UNIQUE,
    user_id         UUID REFERENCES users(id) ON DELETE SET NULL,
    name            VARCHAR(255) NOT NULL,
    email           VARCHAR(255) NOT NULL,
    city            VARCHAR(128) NOT NULL DEFAULT '',
    saved_lawyers   TEXT[] NOT NULL DEFAULT '{}',
    saved_firms     TEXT[] NOT NULL DEFAULT '{}',
    recent_views    JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 4. lawyer_profiles & portfolio tables
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS lawyer_profiles (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    external_id         VARCHAR(64) NOT NULL UNIQUE,
    user_id             UUID REFERENCES users(id) ON DELETE SET NULL,
    name                VARCHAR(255) NOT NULL,
    headline            VARCHAR(255) NOT NULL DEFAULT 'Advocate',
    city                VARCHAR(128) NOT NULL,
    experience_years    INT NOT NULL DEFAULT 0 CHECK (experience_years >= 0),
    about               TEXT NOT NULL DEFAULT '',
    photo_url           TEXT NOT NULL DEFAULT '',
    languages           TEXT[] NOT NULL DEFAULT '{English}',
    contact_email       VARCHAR(255) NOT NULL DEFAULT '',
    contact_phone       VARCHAR(64) NOT NULL DEFAULT '',
    contact_visibility  VARCHAR(32) NOT NULL DEFAULT 'clients' CHECK (contact_visibility IN ('clients', 'hidden')),
    consultation_fee    NUMERIC(12, 2) NOT NULL DEFAULT 1500.00 CHECK (consultation_fee >= 200.00),
    currency            CHAR(3) NOT NULL DEFAULT 'INR',
    available_modes     TEXT[] NOT NULL DEFAULT '{ONLINE,IN_PERSON}',
    booking_lead_hours  INT NOT NULL DEFAULT 2 CHECK (booking_lead_hours >= 0),
    office_location     TEXT NOT NULL DEFAULT '',
    is_active           BOOLEAN NOT NULL DEFAULT TRUE,
    joined_at           DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lawyer_profiles_city ON lawyer_profiles (city);
CREATE INDEX IF NOT EXISTS idx_lawyer_profiles_exp ON lawyer_profiles (experience_years);

CREATE TABLE IF NOT EXISTS lawyer_practice_areas (
    lawyer_id       UUID NOT NULL REFERENCES lawyer_profiles(id) ON DELETE CASCADE,
    practice_slug   VARCHAR(64) NOT NULL REFERENCES practice_areas(slug) ON DELETE CASCADE,
    is_primary      BOOLEAN NOT NULL DEFAULT FALSE,
    PRIMARY KEY (lawyer_id, practice_slug)
);

CREATE INDEX IF NOT EXISTS idx_lawyer_practice_slug ON lawyer_practice_areas (practice_slug);

CREATE TABLE IF NOT EXISTS lawyer_education (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    external_id     VARCHAR(64) UNIQUE,
    lawyer_id       UUID NOT NULL REFERENCES lawyer_profiles(id) ON DELETE CASCADE,
    institution     VARCHAR(255) NOT NULL,
    degree          VARCHAR(255) NOT NULL,
    field           VARCHAR(255) NOT NULL DEFAULT 'Law',
    start_year      INT,
    end_year        INT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS lawyer_experience (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    external_id     VARCHAR(64) UNIQUE,
    lawyer_id       UUID NOT NULL REFERENCES lawyer_profiles(id) ON DELETE CASCADE,
    organization    VARCHAR(255) NOT NULL,
    designation     VARCHAR(255) NOT NULL,
    start_date      VARCHAR(32) NOT NULL,
    end_date        VARCHAR(32) NOT NULL DEFAULT '',
    description     TEXT NOT NULL DEFAULT '',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS lawyer_achievements (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    external_id     VARCHAR(64) UNIQUE,
    lawyer_id       UUID NOT NULL REFERENCES lawyer_profiles(id) ON DELETE CASCADE,
    section_type    VARCHAR(32) NOT NULL DEFAULT 'achievements' CHECK (section_type IN ('achievements', 'qualifications')),
    title           VARCHAR(255) NOT NULL,
    issuer          VARCHAR(255) NOT NULL DEFAULT '',
    description     TEXT NOT NULL DEFAULT '',
    record_date     VARCHAR(32) NOT NULL DEFAULT '',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 5. firms & firm_memberships
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS firms (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    external_id     VARCHAR(64) NOT NULL UNIQUE,
    name            VARCHAR(255) NOT NULL,
    city            VARCHAR(128) NOT NULL,
    address         TEXT NOT NULL DEFAULT '',
    established     INT NOT NULL DEFAULT 2020,
    practice_areas  TEXT[] NOT NULL DEFAULT '{}',
    about           TEXT NOT NULL DEFAULT '',
    email           VARCHAR(255) NOT NULL DEFAULT '',
    phone           VARCHAR(64) NOT NULL DEFAULT '',
    website         VARCHAR(255) NOT NULL DEFAULT '',
    logo_url        TEXT NOT NULL DEFAULT '',
    cover_url       TEXT NOT NULL DEFAULT '',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_firms_city ON firms (city);

CREATE TABLE IF NOT EXISTS firm_memberships (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    external_id     VARCHAR(64) NOT NULL UNIQUE,
    firm_id         UUID NOT NULL REFERENCES firms(id) ON DELETE CASCADE,
    lawyer_id       UUID NOT NULL REFERENCES lawyer_profiles(id) ON DELETE CASCADE,
    member_role     VARCHAR(64) NOT NULL DEFAULT 'MEMBER',
    status          VARCHAR(32) NOT NULL CHECK (status IN ('active', 'pending', 'rejected', 'declined', 'removed', 'withdrawn', 'left', 'cancelled')),
    initiated_by    VARCHAR(32) NOT NULL CHECK (initiated_by IN ('firm', 'lawyer')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enforce at most ONE active firm affiliation per lawyer in PostgreSQL
CREATE UNIQUE INDEX IF NOT EXISTS uq_firm_memberships_one_active_per_lawyer
    ON firm_memberships (lawyer_id)
    WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_firm_memberships_firm_status ON firm_memberships (firm_id, status);

-- ----------------------------------------------------------------------------
-- 6. availability_rules, availability_exceptions, consultation_slots
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS availability_rules (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lawyer_id       UUID NOT NULL UNIQUE REFERENCES lawyer_profiles(id) ON DELETE CASCADE,
    working_days    TEXT[] NOT NULL DEFAULT '{MON,TUE,WED,THU,FRI,SAT}',
    start_time      VARCHAR(8) NOT NULL DEFAULT '10:00',
    end_time        VARCHAR(8) NOT NULL DEFAULT '18:00',
    timezone        VARCHAR(64) NOT NULL DEFAULT 'Asia/Kolkata',
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS availability_exceptions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lawyer_id       UUID NOT NULL REFERENCES lawyer_profiles(id) ON DELETE CASCADE,
    exception_date  DATE NOT NULL,
    is_blocked      BOOLEAN NOT NULL DEFAULT TRUE,
    reason          TEXT NOT NULL DEFAULT 'Holiday / Leave',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (lawyer_id, exception_date)
);

-- Every consultation slot is exactly 60 minutes.
-- Canonical slot rows + unique (lawyer_id, slot_date, start_time) + GiST exclusion constraint
CREATE TABLE IF NOT EXISTS consultation_slots (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    external_id     VARCHAR(128) NOT NULL UNIQUE,
    lawyer_id       UUID NOT NULL REFERENCES lawyer_profiles(id) ON DELETE CASCADE,
    slot_date       DATE NOT NULL,
    start_time      VARCHAR(8) NOT NULL,
    end_time        VARCHAR(8) NOT NULL,
    starts_at_utc   TIMESTAMPTZ NOT NULL,
    ends_at_utc     TIMESTAMPTZ NOT NULL,
    timezone        VARCHAR(64) NOT NULL DEFAULT 'Asia/Kolkata',
    status          VARCHAR(32) NOT NULL DEFAULT 'AVAILABLE'
                    CHECK (status IN ('AVAILABLE', 'HELD', 'AWAITING_LAWYER', 'PROPOSED', 'CONFIRMED', 'BLOCKED')),
    reserved_until  TIMESTAMPTZ,
    booking_id      UUID,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_slot_one_hour CHECK (ends_at_utc = starts_at_utc + INTERVAL '60 minutes'),
    UNIQUE (lawyer_id, slot_date, start_time),
    EXCLUDE USING gist (
        lawyer_id WITH =,
        tstzrange(starts_at_utc, ends_at_utc, '[)') WITH &&
    )
);

CREATE INDEX IF NOT EXISTS idx_slots_lawyer_date ON consultation_slots (lawyer_id, slot_date);
CREATE INDEX IF NOT EXISTS idx_slots_status_reserved_until ON consultation_slots (status, reserved_until)
    WHERE status = 'HELD';

-- ----------------------------------------------------------------------------
-- 7. bookings & reschedule_proposals
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS bookings (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    external_id         VARCHAR(64) NOT NULL UNIQUE,
    client_id           UUID NOT NULL REFERENCES client_profiles(id) ON DELETE RESTRICT,
    lawyer_id           UUID NOT NULL REFERENCES lawyer_profiles(id) ON DELETE RESTRICT,
    firm_id             UUID REFERENCES firms(id) ON DELETE SET NULL,
    original_slot_id    UUID NOT NULL REFERENCES consultation_slots(id) ON DELETE RESTRICT,
    final_slot_id       UUID NOT NULL REFERENCES consultation_slots(id) ON DELETE RESTRICT,
    mode                VARCHAR(32) NOT NULL CHECK (mode IN ('ONLINE', 'IN_PERSON')),
    consultation_fee    NUMERIC(12, 2) NOT NULL CHECK (consultation_fee >= 0),
    platform_fee        NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (platform_fee >= 0),
    tax_amount          NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (tax_amount >= 0),
    total_amount        NUMERIC(12, 2) NOT NULL CHECK (total_amount >= 0),
    currency            CHAR(3) NOT NULL DEFAULT 'INR',
    booking_status      VARCHAR(32) NOT NULL
                        CHECK (booking_status IN (
                            'PAYMENT_PENDING',
                            'AWAITING_LAWYER',
                            'RESCHEDULE_PROPOSED',
                            'CONFIRMED',
                            'COMPLETED',
                            'DECLINED',
                            'PAYMENT_FAILED',
                            'EXPIRED',
                            'REFUND_PENDING',
                            'REFUNDED'
                        )),
    payment_id          UUID,
    hold_expires_at     TIMESTAMPTZ,
    response_deadline   TIMESTAMPTZ,
    client_notes        TEXT NOT NULL DEFAULT '',
    decline_reason      TEXT,
    meeting_link        TEXT,
    office_location     TEXT NOT NULL DEFAULT '',
    timeline            JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bookings_client_id ON bookings (client_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bookings_lawyer_id ON bookings (lawyer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bookings_status_deadlines ON bookings (booking_status, response_deadline, hold_expires_at);

CREATE TABLE IF NOT EXISTS reschedule_proposals (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    external_id         VARCHAR(64) NOT NULL UNIQUE,
    booking_id          UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    lawyer_id           UUID NOT NULL REFERENCES lawyer_profiles(id) ON DELETE CASCADE,
    original_slot_id    UUID NOT NULL REFERENCES consultation_slots(id),
    proposed_slot_id    UUID NOT NULL REFERENCES consultation_slots(id),
    reason              TEXT NOT NULL DEFAULT '',
    status              VARCHAR(32) NOT NULL DEFAULT 'PENDING'
                        CHECK (status IN ('PENDING', 'ACCEPTED', 'REJECTED', 'EXPIRED')),
    expires_at          TIMESTAMPTZ NOT NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reschedule_proposals_booking ON reschedule_proposals (booking_id);

-- ----------------------------------------------------------------------------
-- 8. payments & refunds (Module B)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS payments (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    external_id             VARCHAR(64) NOT NULL UNIQUE,
    booking_id              UUID NOT NULL UNIQUE REFERENCES bookings(id) ON DELETE RESTRICT,
    client_id               UUID NOT NULL REFERENCES client_profiles(id) ON DELETE RESTRICT,
    lawyer_id               UUID NOT NULL REFERENCES lawyer_profiles(id) ON DELETE RESTRICT,
    amount                  NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
    currency                CHAR(3) NOT NULL DEFAULT 'INR',
    provider                VARCHAR(32) NOT NULL DEFAULT 'MOCK' CHECK (provider IN ('MOCK', 'RAZORPAY')),
    provider_order_id       VARCHAR(128) UNIQUE,
    provider_payment_id     VARCHAR(128) UNIQUE,
    transaction_reference   VARCHAR(128) UNIQUE,
    status                  VARCHAR(32) NOT NULL DEFAULT 'PENDING'
                            CHECK (status IN ('PENDING', 'PAID', 'FAILED', 'REFUND_INITIATED', 'REFUNDED')),
    failure_reason          TEXT,
    paid_at                 TIMESTAMPTZ,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payments_client_id ON payments (client_id, created_at DESC);

CREATE TABLE IF NOT EXISTS refunds (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    external_id             VARCHAR(64) NOT NULL UNIQUE,
    booking_id              UUID NOT NULL UNIQUE REFERENCES bookings(id) ON DELETE RESTRICT,
    payment_id              UUID NOT NULL UNIQUE REFERENCES payments(id) ON DELETE RESTRICT,
    client_id               UUID NOT NULL REFERENCES client_profiles(id) ON DELETE RESTRICT,
    lawyer_id               UUID NOT NULL REFERENCES lawyer_profiles(id) ON DELETE RESTRICT,
    amount                  NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
    currency                CHAR(3) NOT NULL DEFAULT 'INR',
    reason                  TEXT NOT NULL,
    provider_refund_id      VARCHAR(128) UNIQUE,
    status                  VARCHAR(32) NOT NULL DEFAULT 'REFUND_INITIATED'
                            CHECK (status IN ('REFUND_INITIATED', 'REFUNDED')),
    initiated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at            TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_refunds_client_id ON refunds (client_id, initiated_at DESC);

-- ----------------------------------------------------------------------------
-- 9. notifications, outbox_events, idempotency_keys, audit_logs
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notifications (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    external_id     VARCHAR(64) NOT NULL UNIQUE,
    recipient_id    VARCHAR(64) NOT NULL,
    booking_id      VARCHAR(64),
    type            VARCHAR(64) NOT NULL,
    title            VARCHAR(255) NOT NULL,
    message         TEXT NOT NULL,
    is_read         BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON notifications (recipient_id, created_at DESC);

CREATE TABLE IF NOT EXISTS outbox_events (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    aggregate_type  VARCHAR(64) NOT NULL,
    aggregate_id    VARCHAR(64) NOT NULL,
    event_type      VARCHAR(64) NOT NULL,
    payload         JSONB NOT NULL DEFAULT '{}'::jsonb,
    status          VARCHAR(32) NOT NULL DEFAULT 'PENDING'
                    CHECK (status IN ('PENDING', 'PROCESSING', 'PROCESSED', 'FAILED')),
    attempts        INT NOT NULL DEFAULT 0,
    next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_error      TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    processed_at    TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_outbox_pending ON outbox_events (status, next_attempt_at)
    WHERE status IN ('PENDING', 'FAILED');

CREATE TABLE IF NOT EXISTS idempotency_keys (
    idempotency_key VARCHAR(128) PRIMARY KEY,
    user_id         VARCHAR(64) NOT NULL,
    endpoint        VARCHAR(128) NOT NULL,
    response_status INT NOT NULL,
    response_body   JSONB NOT NULL,
    expires_at      TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '24 hours'),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_logs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_user_id   VARCHAR(64),
    actor_role      VARCHAR(32),
    action          VARCHAR(128) NOT NULL,
    resource_type   VARCHAR(64) NOT NULL,
    resource_id     VARCHAR(64) NOT NULL,
    metadata        JSONB NOT NULL DEFAULT '{}'::jsonb,
    ip_address      VARCHAR(64),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_resource ON audit_logs (resource_type, resource_id, created_at DESC);

