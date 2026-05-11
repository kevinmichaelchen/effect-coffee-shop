select
  session_id,
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
from checkout_session_items
where session_id = :sessionId
order by position;
