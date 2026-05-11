select
  id,
  owner_user_id,
  status,
  total_price_cents,
  created_at,
  updated_at,
  expires_at
from checkout_sessions
where id = :id;
