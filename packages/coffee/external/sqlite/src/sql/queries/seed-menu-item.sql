insert into
  menu_items (
    id,
    name,
    kind,
    sort_order,
    base_price_cents,
    available_milks,
    available_temperatures,
    max_shots
  )
values
  (
    :item.id,
    :item.name,
    :item.kind,
    :item.sortOrder,
    :item.basePriceCents,
    :item.availableMilks,
    :item.availableTemperatures,
    :item.maxShots
  )
on conflict (id) do update
set
  name = excluded.name,
  kind = excluded.kind,
  sort_order = excluded.sort_order,
  base_price_cents = excluded.base_price_cents,
  available_milks = excluded.available_milks,
  available_temperatures = excluded.available_temperatures,
  max_shots = excluded.max_shots;
