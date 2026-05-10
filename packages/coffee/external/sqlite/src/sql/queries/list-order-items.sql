select
  order_id,
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
from order_items
where order_id = :order_id
order by position;
