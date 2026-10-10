CREATE TABLE yielded_oauth_server (
  namespace TEXT NOT NULL,
  grant_id TEXT NOT NULL,
  version TEXT NOT NULL,
  revoked INTEGER NOT NULL DEFAULT 0,
  expires_at_millis BIGINT NOT NULL,
  payload TEXT NOT NULL,
  PRIMARY KEY (namespace, grant_id)
);

CREATE TABLE yielded_oauth_client_assertion (
  namespace TEXT NOT NULL,
  assertion_id TEXT NOT NULL,
  expires_at_millis BIGINT NOT NULL,
  PRIMARY KEY (namespace, assertion_id)
);

CREATE TABLE coffee_auth_rate_limits (
  id TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
