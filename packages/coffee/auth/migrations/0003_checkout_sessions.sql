create table checkout_sessions (
  id text primary key,
  owner_user_id text not null,
  status text not null,
  total_price_cents integer not null,
  created_at text not null,
  updated_at text not null,
  expires_at text not null
);

create index checkout_sessions_owner_status_updated_idx on checkout_sessions (owner_user_id, status, updated_at, id);

create table checkout_session_items (
  session_id text not null references checkout_sessions (id) on delete cascade,
  position integer not null,
  drink_id text not null,
  drink_name text not null,
  size text not null,
  milk text not null,
  temperature text not null,
  shots integer not null,
  notes text,
  quantity integer not null,
  unit_price_cents integer not null,
  line_total_cents integer not null,
  primary key (session_id, position)
);
