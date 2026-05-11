alter table orders rename to orders_legacy;

create table orders (
  id text primary key,
  customer_name text not null,
  owner_user_id text not null,
  status text not null,
  total_price_cents integer not null,
  created_at text not null
);

create table order_items (
  order_id text not null references orders (id) on delete cascade,
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
  primary key (order_id, position)
);

insert into
  orders (id, customer_name, owner_user_id, status, total_price_cents, created_at)
select
  id,
  customer_name,
  owner_user_id,
  status,
  price_cents,
  created_at
from orders_legacy;

insert into
  order_items (
    order_id,
    position,
    drink_id,
    drink_name,
    size,
    milk,
    temperature,
    shots,
    notes,
    quantity,
    unit_price_cents,
    line_total_cents
  )
select
  id,
  0,
  drink_id,
  drink_name,
  size,
  milk,
  temperature,
  shots,
  notes,
  1,
  price_cents,
  price_cents
from orders_legacy;

drop table orders_legacy;

create index orders_created_at_idx on orders (created_at, id);

create index orders_status_created_at_idx on orders (status, created_at, id);

create index orders_owner_user_id_created_at_idx on orders (owner_user_id, created_at, id);

create index orders_owner_user_id_status_created_at_idx on orders (owner_user_id, status, created_at, id);

create table carts (
  owner_user_id text primary key
);

create table cart_items (
  owner_user_id text not null references carts (owner_user_id) on delete cascade,
  id text not null primary key,
  position integer not null,
  drink_id text not null,
  size text not null,
  milk text not null,
  temperature text not null,
  shots integer not null,
  notes text,
  quantity integer not null
);

create index cart_items_owner_user_id_position_idx on cart_items (owner_user_id, position);
