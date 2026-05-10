insert into
  orders (id, customer_name, owner_user_id, status, total_price_cents, created_at)
values
  (
    :order.id,
    :order.customerName,
    :order.ownerUserId,
    :order.status,
    :order.totalPriceCents,
    :order.createdAt
  )
on conflict (id) do update
set
  customer_name = excluded.customer_name,
  owner_user_id = excluded.owner_user_id,
  status = excluded.status,
  total_price_cents = excluded.total_price_cents,
  created_at = excluded.created_at;
