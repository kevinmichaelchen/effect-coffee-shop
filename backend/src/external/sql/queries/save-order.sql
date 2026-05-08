insert into
  orders (
    id,
    customername,
    owneruserid,
    drinkid,
    drinkname,
    size,
    milk,
    temperature,
    shots,
    notes,
    status,
    pricecents,
    createdat
  )
values
  (
    :order.id,
    :order.customername,
    :order.owneruserid,
    :order.drinkid,
    :order.drinkname,
    :order.size,
    :order.milk,
    :order.temperature,
    :order.shots,
    :order.notes,
    :order.status,
    :order.pricecents,
    :order.createdat
  )
on conflict (id) do update
set
  customername = excluded.customername,
  owneruserid = excluded.owneruserid,
  drinkid = excluded.drinkid,
  drinkname = excluded.drinkname,
  size = excluded.size,
  milk = excluded.milk,
  temperature = excluded.temperature,
  shots = excluded.shots,
  notes = excluded.notes,
  status = excluded.status,
  pricecents = excluded.pricecents,
  createdat = excluded.createdat
returning *;
