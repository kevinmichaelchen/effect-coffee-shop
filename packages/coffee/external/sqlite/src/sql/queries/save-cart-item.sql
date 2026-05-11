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
    :item.ownerUserId,
    :item.id,
    :item.position,
    :item.drinkId,
    :item.size,
    :item.milk,
    :item.temperature,
    :item.shots,
    :item.notes,
    :item.quantity
  );
