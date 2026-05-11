select
  owner_user_id,
  source,
  total_price_cents,
  updated_at
from pending_order_confirmations
where owner_user_id = ?;
