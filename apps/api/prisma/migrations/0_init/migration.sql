-- ============================================================================
-- VAI Phase 2 Database Migration: 0_init
-- Portable schema for SQLite (prototype) with clean migration path to PostgreSQL 16
-- Implements TRD Section 6, Spec Patches P1a-P1d, P2, P7, P9, P11
-- ============================================================================

-- Ensure SQLite foreign key enforcement is active
PRAGMA foreign_keys = ON;

-- ----------------------------------------------------------------------------
-- 1. Table: users
-- ----------------------------------------------------------------------------
CREATE TABLE "users" (
    "user_id" TEXT NOT NULL PRIMARY KEY,
    "mobile_e164" TEXT NOT NULL,
    "pan_encrypted" TEXT NOT NULL,
    "pan_hash" TEXT NOT NULL,
    "pan_masked" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "registration_date" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "is_dummy" BOOLEAN NOT NULL DEFAULT true,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "users_pan_masked_len_chk" CHECK (length("pan_masked") = 10)
);

-- ----------------------------------------------------------------------------
-- 2. Table: vehicles
-- ----------------------------------------------------------------------------
CREATE TABLE "vehicles" (
    "vehicle_id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "registration_no" TEXT NOT NULL,
    "vehicle_type" TEXT NOT NULL,
    "manufacturer" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "registration_date" DATETIME NOT NULL,
    "insurance_expiry" DATETIME,
    "puc_expiry" DATETIME,
    "rc_validity_till" DATETIME NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "vehicles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("user_id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- ----------------------------------------------------------------------------
-- 3. Table: licences
-- ----------------------------------------------------------------------------
CREATE TABLE "licences" (
    "licence_id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "licence_no_masked" TEXT NOT NULL,
    "licence_class" TEXT NOT NULL,
    "expiry_date" DATETIME NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "licences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("user_id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- ----------------------------------------------------------------------------
-- 4. Table: challans
-- ----------------------------------------------------------------------------
CREATE TABLE "challans" (
    "challan_id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "vehicle_id" TEXT NOT NULL,
    "challan_date" DATETIME NOT NULL,
    "challan_type" TEXT NOT NULL,
    "violation_code" TEXT NOT NULL,
    "violation_desc" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "amount_paise" BIGINT NOT NULL,
    "status" TEXT NOT NULL,
    "due_date" DATETIME NOT NULL,
    "payment_date" DATETIME,
    "scoring_eligible" BOOLEAN NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "challans_amount_positive_chk" CHECK ("amount_paise" > 0),
    CONSTRAINT "challans_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("user_id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "challans_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles" ("vehicle_id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- ----------------------------------------------------------------------------
-- 5. Table: vai_scores
-- ----------------------------------------------------------------------------
CREATE TABLE "vai_scores" (
    "user_id" TEXT NOT NULL PRIMARY KEY,
    "score" INTEGER NOT NULL,
    "category" TEXT NOT NULL,
    "score_before_cap" REAL NOT NULL,
    "scoring_config_version" INTEGER NOT NULL,
    "computed_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "vai_scores_range_chk" CHECK ("score" >= 500 AND "score" <= 900),
    CONSTRAINT "vai_scores_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("user_id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- ----------------------------------------------------------------------------
-- 6. Table: score_ledger (Append-only)
-- ----------------------------------------------------------------------------
CREATE TABLE "score_ledger" (
    "entry_id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "user_id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "component" TEXT NOT NULL,
    "reason_code" TEXT NOT NULL,
    "ref_id" TEXT,
    "delta_points" REAL NOT NULL,
    "balance_before" INTEGER NOT NULL,
    "balance_after" INTEGER NOT NULL,
    "config_version" INTEGER NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "score_ledger_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("user_id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- ----------------------------------------------------------------------------
-- 7. Table: score_snapshots
-- ----------------------------------------------------------------------------
CREATE TABLE "score_snapshots" (
    "snapshot_id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "user_id" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "category" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "score_snapshots_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("user_id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- ----------------------------------------------------------------------------
-- 8. Table: service_providers
-- ----------------------------------------------------------------------------
CREATE TABLE "service_providers" (
    "provider_id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "service_type" TEXT NOT NULL,
    "api_mode" TEXT NOT NULL DEFAULT 'SIMULATED',
    "settlement_account_ref" TEXT NOT NULL,
    "fee_mode" TEXT NOT NULL DEFAULT 'PROVIDER_PAYS',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- ----------------------------------------------------------------------------
-- 9. Table: reward_config
-- ----------------------------------------------------------------------------
CREATE TABLE "reward_config" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "vai_category" TEXT NOT NULL,
    "service_type" TEXT NOT NULL,
    "discount_bps" INTEGER NOT NULL,
    "effective_from" DATETIME NOT NULL,
    "created_by" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ----------------------------------------------------------------------------
-- 10. Table: fee_config
-- ----------------------------------------------------------------------------
CREATE TABLE "fee_config" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "option_code" TEXT NOT NULL,
    "ppm" INTEGER NOT NULL,
    "mode" TEXT NOT NULL,
    "effective_from" DATETIME NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT false,
    "created_by" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ----------------------------------------------------------------------------
-- 11. Table: scoring_config
-- ----------------------------------------------------------------------------
CREATE TABLE "scoring_config" (
    "version" INTEGER NOT NULL PRIMARY KEY,
    "parameters" TEXT NOT NULL,
    "effective_from" DATETIME NOT NULL,
    "created_by" TEXT NOT NULL,
    "change_reason" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ----------------------------------------------------------------------------
-- 12. Table: transactions
-- ----------------------------------------------------------------------------
CREATE TABLE "transactions" (
    "txn_id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "vehicle_id" TEXT,
    "licence_id" TEXT,
    "provider_id" TEXT NOT NULL,
    "service_type" TEXT NOT NULL,
    "vai_category_at_txn" TEXT NOT NULL,
    "base_amount_paise" BIGINT NOT NULL,
    "discount_bps" INTEGER NOT NULL,
    "discount_paise" BIGINT NOT NULL,
    "govt_funded_paise" BIGINT NOT NULL,
    "payable_paise" BIGINT NOT NULL,
    "platform_fee_ppm" INTEGER NOT NULL,
    "platform_fee_paise" BIGINT NOT NULL,
    "fee_mode" TEXT NOT NULL DEFAULT 'PROVIDER_PAYS',
    "user_total_paise" BIGINT NOT NULL,
    "settlement_to_provider_paise" BIGINT NOT NULL,
    "status" TEXT NOT NULL,
    "payment_ref" TEXT,
    "idempotency_key" TEXT,
    "quote_id" TEXT,
    "quote_expires_at" DATETIME,
    "receipt_url" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "transactions_base_positive_chk" CHECK ("base_amount_paise" > 0),
    CONSTRAINT "transactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("user_id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "transactions_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles" ("vehicle_id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "transactions_licence_id_fkey" FOREIGN KEY ("licence_id") REFERENCES "licences" ("licence_id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "transactions_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "service_providers" ("provider_id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- ----------------------------------------------------------------------------
-- 13. Table: refunds (P7)
-- ----------------------------------------------------------------------------
CREATE TABLE "refunds" (
    "refund_id" TEXT NOT NULL PRIMARY KEY,
    "txn_id" TEXT NOT NULL,
    "amount_paise" BIGINT NOT NULL,
    "fee_reversed_paise" BIGINT NOT NULL,
    "reason_code" TEXT NOT NULL,
    "admin_id" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "refunds_amount_positive_chk" CHECK ("amount_paise" > 0),
    CONSTRAINT "refunds_txn_id_fkey" FOREIGN KEY ("txn_id") REFERENCES "transactions" ("txn_id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- ----------------------------------------------------------------------------
-- 14. Table: admins
-- ----------------------------------------------------------------------------
CREATE TABLE "admins" (
    "admin_id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "mfa_secret_ref" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- ----------------------------------------------------------------------------
-- 15. Table: audit_logs (Append-only)
-- ----------------------------------------------------------------------------
CREATE TABLE "audit_logs" (
    "log_id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "actor_type" TEXT NOT NULL,
    "actor_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "before_json" TEXT,
    "after_json" TEXT,
    "ip_hash" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ----------------------------------------------------------------------------
-- 16. Table: consent_records
-- ----------------------------------------------------------------------------
CREATE TABLE "consent_records" (
    "consent_id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "granted" BOOLEAN NOT NULL,
    "version_text_hash" TEXT NOT NULL,
    "captured_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "withdrawn_at" DATETIME,
    CONSTRAINT "consent_records_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("user_id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- ----------------------------------------------------------------------------
-- 17. Table: disputes
-- ----------------------------------------------------------------------------
CREATE TABLE "disputes" (
    "dispute_id" TEXT NOT NULL PRIMARY KEY,
    "challan_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "opened_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" DATETIME,
    "outcome" TEXT,
    "resolver_admin_id" TEXT,
    "note" TEXT NOT NULL,
    CONSTRAINT "disputes_challan_id_fkey" FOREIGN KEY ("challan_id") REFERENCES "challans" ("challan_id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "disputes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("user_id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- ----------------------------------------------------------------------------
-- 18. Table: otp_sessions (In-process replacement for Redis OTP store)
-- ----------------------------------------------------------------------------
CREATE TABLE "otp_sessions" (
    "session_id" TEXT NOT NULL PRIMARY KEY,
    "mobile_hash" TEXT NOT NULL,
    "otp_hash" TEXT NOT NULL,
    "expires_at" DATETIME NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "consumed_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ----------------------------------------------------------------------------
-- 19. Table: score_jobs (In-process replacement for BullMQ job queue)
-- ----------------------------------------------------------------------------
CREATE TABLE "score_jobs" (
    "job_id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "config_version" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "scheduled_for" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" DATETIME,
    "error" TEXT,
    CONSTRAINT "score_jobs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("user_id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- ============================================================================
-- INDEXES (TRD 6.4 and Spec Patch P1c)
-- ============================================================================

CREATE UNIQUE INDEX "users_mobile_e164_key" ON "users"("mobile_e164");
CREATE UNIQUE INDEX "users_pan_hash_key" ON "users"("pan_hash");

CREATE UNIQUE INDEX "vehicles_registration_no_key" ON "vehicles"("registration_no");
CREATE INDEX "vehicles_user_idx" ON "vehicles"("user_id");

CREATE INDEX "challans_user_date_idx" ON "challans"("user_id", "challan_date");
CREATE INDEX "challans_vehicle_idx" ON "challans"("vehicle_id", "challan_date");

-- Partial index for overdue scan in nightly job (TRD 6.4)
CREATE INDEX "challans_unpaid_partial" ON "challans" ("user_id", "due_date") WHERE "status" = 'UNPAID';

CREATE INDEX "score_distribution_idx" ON "vai_scores"("category");
CREATE INDEX "ledger_user_time_idx" ON "score_ledger"("user_id", "created_at");
CREATE UNIQUE INDEX "score_snapshots_user_id_period_key" ON "score_snapshots"("user_id", "period");

CREATE UNIQUE INDEX "reward_config_vai_category_service_type_effective_from_key" ON "reward_config"("vai_category", "service_type", "effective_from");

-- Partial unique index: Exactly one fee_config row may be active at a given time (TRD 6.2, P1c)
CREATE UNIQUE INDEX "fee_config_single_active_uq" ON "fee_config"("is_active") WHERE "is_active" = 1;

CREATE UNIQUE INDEX "transactions_idempotency_key_key" ON "transactions"("idempotency_key");
CREATE INDEX "txn_user_time_idx" ON "transactions"("user_id", "created_at");
CREATE INDEX "txn_status_idx" ON "transactions"("status", "created_at");

CREATE UNIQUE INDEX "admins_email_key" ON "admins"("email");
CREATE INDEX "audit_entity_idx" ON "audit_logs"("entity_type", "entity_id", "created_at");

-- ============================================================================
-- APPEND-ONLY TRIGGERS (P1c)
-- Prevents UPDATE and DELETE operations on score_ledger and audit_logs
-- ============================================================================

CREATE TRIGGER "score_ledger_no_update"
BEFORE UPDATE ON "score_ledger"
BEGIN
    SELECT RAISE(ABORT, 'score_ledger is append-only: UPDATE is prohibited');
END;

CREATE TRIGGER "score_ledger_no_delete"
BEFORE DELETE ON "score_ledger"
BEGIN
    SELECT RAISE(ABORT, 'score_ledger is append-only: DELETE is prohibited');
END;

CREATE TRIGGER "audit_logs_no_update"
BEFORE UPDATE ON "audit_logs"
BEGIN
    SELECT RAISE(ABORT, 'audit_logs is append-only: UPDATE is prohibited');
END;

CREATE TRIGGER "audit_logs_no_delete"
BEFORE DELETE ON "audit_logs"
BEGIN
    SELECT RAISE(ABORT, 'audit_logs is append-only: DELETE is prohibited');
END;
