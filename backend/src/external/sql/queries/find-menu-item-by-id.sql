select
  id,
  name,
  kind,
  basepricecents,
  availablemilks,
  availabletemperatures,
  maxshots
from menu_items
where id = :id
limit 1;
