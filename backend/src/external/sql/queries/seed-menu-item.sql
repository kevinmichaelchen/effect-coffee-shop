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
    :item.sort_order,
    :item.base_price_cents,
    :item.available_milks,
    :item.available_temperatures,
    :item.max_shots
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
