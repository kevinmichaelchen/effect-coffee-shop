select
  id,
  customer_name,
  owner_user_id,
  status,
  total_price_cents,
  created_at
from orders
order by created_at, id;
