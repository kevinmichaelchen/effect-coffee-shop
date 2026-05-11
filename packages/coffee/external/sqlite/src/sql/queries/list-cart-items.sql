select
  owner_user_id,
  id,
  position,
  drink_id,
  size,
  milk,
  temperature,
  shots,
  notes,
  quantity
from cart_items
where owner_user_id = :ownerUserId
order by position;
