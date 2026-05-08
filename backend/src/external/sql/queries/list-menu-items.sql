select
  id,
  name,
  kind,
  basepricecents,
  availablemilks,
  availabletemperatures,
  maxshots
from menu_items
order by sortorder, id;
