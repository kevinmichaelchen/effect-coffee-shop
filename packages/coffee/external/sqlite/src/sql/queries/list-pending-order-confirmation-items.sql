select
  owner_user_id,
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
from pending_order_confirmation_items
where owner_user_id = ?
order by position;
