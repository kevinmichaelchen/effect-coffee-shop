select
  id,
  name,
  kind,
  base_price_cents,
  available_milks,
  available_temperatures,
  max_shots
from menu_items
order by sort_order, id;
