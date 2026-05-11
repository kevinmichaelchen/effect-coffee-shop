create table pending_order_confirmations (
  owner_user_id text primary key,
  source text not null,
  total_price_cents integer not null,
  updated_at text not null
);

create table pending_order_confirmation_items (
  owner_user_id text not null references pending_order_confirmations (owner_user_id) on delete cascade,
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
  primary key (owner_user_id, position)
);

create index pending_order_confirmation_items_owner_position_idx on pending_order_confirmation_items (owner_user_id, position);
