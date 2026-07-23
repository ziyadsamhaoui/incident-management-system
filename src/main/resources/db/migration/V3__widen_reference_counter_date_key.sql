-- V3__widen_reference_counter_date_key.sql
-- Flyway Incremental Migration: Widen date_key column in reference_counters
--
-- The original VARCHAR(8) was sufficient for production date_key values
-- formatted as yyyyMMdd (e.g., "20260721"), but unit tests use longer
-- keys (e.g., "unittest_1234567890123" with nanoTime suffix) for
-- isolation.  Widen to VARCHAR(32) to accommodate both.

ALTER TABLE reference_counters
    ALTER COLUMN date_key TYPE VARCHAR(32);
