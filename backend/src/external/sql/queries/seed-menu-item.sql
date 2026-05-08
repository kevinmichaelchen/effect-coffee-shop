insert into
  menu_items (
    id,
    name,
    kind,
    sortorder,
    basepricecents,
    availablemilks,
    availabletemperatures,
    maxshots
  )
values
  (
    :item.id,
    :item.name,
    :item.kind,
    :item.sortorder,
    :item.basepricecents,
    :item.availablemilks,
    :item.availabletemperatures,
    :item.maxshots
  )
on conflict (id) do update
set
  name = excluded.name,
  kind = excluded.kind,
  sortorder = excluded.sortorder,
  basepricecents = excluded.basepricecents,
  availablemilks = excluded.availablemilks,
  availabletemperatures = excluded.availabletemperatures,
  maxshots = excluded.maxshots;
