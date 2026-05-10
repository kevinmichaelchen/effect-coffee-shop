select
  id,
  customer_name,
  owner_user_id,
  status,
  total_price_cents,
  created_at
from orders
where owner_user_id = :ownerUserId and status = :status
order by created_at, id;
