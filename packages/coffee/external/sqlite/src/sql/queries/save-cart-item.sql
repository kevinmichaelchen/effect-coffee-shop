insert into
  cart_items (
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
  )
values
  (
    :item.owner_user_id,
    :item.id,
    :item.position,
    :item.drink_id,
    :item.size,
    :item.milk,
    :item.temperature,
    :item.shots,
    :item.notes,
    :item.quantity
  );
