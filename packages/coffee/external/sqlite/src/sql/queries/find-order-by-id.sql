select
  id,
  customer_name,
  owner_user_id,
  status,
  total_price_cents,
  created_at
from orders
left join order_items on order_items.order_id = orders.id
where orders.id = :id
order by orders.created_at, orders.id;
