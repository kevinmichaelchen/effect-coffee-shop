select
  id,
  owner_user_id,
  status,
  total_price_cents,
  created_at,
  updated_at,
  expires_at
from checkout_sessions
where owner_user_id = :ownerUserId
  and status = 'awaiting_confirmation'
order by updated_at desc, id desc
limit 1;
