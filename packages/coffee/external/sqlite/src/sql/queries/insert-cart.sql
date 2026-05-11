insert into
  carts (owner_user_id)
values
  (:ownerUserId)
on conflict (owner_user_id) do nothing;
