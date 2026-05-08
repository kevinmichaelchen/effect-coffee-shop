insert into
  orders (
    id,
    customer_name,
    owner_user_id,
    drink_id,
    drink_name,
    size,
    milk,
    temperature,
    shots,
    notes,
    status,
    price_cents,
    created_at
  )
values
  (
    :order.id,
    :order.customer_name,
    :order.owner_user_id,
    :order.drink_id,
    :order.drink_name,
    :order.size,
    :order.milk,
    :order.temperature,
    :order.shots,
    :order.notes,
    :order.status,
    :order.price_cents,
    :order.created_at
  )
on conflict (id) do update
set
  customer_name = excluded.customer_name,
  owner_user_id = excluded.owner_user_id,
  drink_id = excluded.drink_id,
  drink_name = excluded.drink_name,
  size = excluded.size,
  milk = excluded.milk,
  temperature = excluded.temperature,
  shots = excluded.shots,
  notes = excluded.notes,
  status = excluded.status,
  price_cents = excluded.price_cents,
  created_at = excluded.created_at
returning *;
