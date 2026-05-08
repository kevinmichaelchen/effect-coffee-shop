create table menu_items (
  id text primary key,
  name text not null,
  kind text not null,
  sort_order integer not null,
  base_price_cents integer not null,
  available_milks text not null,
  available_temperatures text not null,
  max_shots integer not null
);

create table orders (
  id text primary key,
  customer_name text not null,
  owner_user_id text not null,
  drink_id text not null,
  drink_name text not null,
  size text not null,
  milk text not null,
  temperature text not null,
  shots integer not null,
  notes text,
  status text not null,
  price_cents integer not null,
  created_at text not null
);

create index orders_created_at_idx on orders (created_at, id);

create index orders_status_created_at_idx on orders (status, created_at, id);

create index orders_owner_user_id_created_at_idx on orders (owner_user_id, created_at, id);

create index orders_owner_user_id_status_created_at_idx on orders (owner_user_id, status, created_at, id);
