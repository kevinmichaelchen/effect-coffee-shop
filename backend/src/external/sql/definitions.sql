create table menu_items (
  id text primary key,
  name text not null,
  kind text not null,
  sortorder integer not null,
  basepricecents integer not null,
  availablemilks text not null,
  availabletemperatures text not null,
  maxshots integer not null
);

create table orders (
  id text primary key,
  customername text not null,
  owneruserid text not null,
  drinkid text not null,
  drinkname text not null,
  size text not null,
  milk text not null,
  temperature text not null,
  shots integer not null,
  notes text,
  status text not null,
  pricecents integer not null,
  createdat text not null
);

create index orders_created_at_idx on orders (createdat, id);

create index orders_status_created_at_idx on orders (status, createdat, id);

create index orders_owner_user_id_created_at_idx on orders (owneruserid, createdat, id);

create index orders_owner_user_id_status_created_at_idx on orders (owneruserid, status, createdat, id);
