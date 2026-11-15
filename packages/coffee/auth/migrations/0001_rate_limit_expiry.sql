-- Rate-limit buckets expire; rows from before this column read as already
-- expired (0) and are pruned on the next write.
ALTER TABLE coffee_auth_rate_limits ADD COLUMN expires_at INTEGER NOT NULL DEFAULT 0;
