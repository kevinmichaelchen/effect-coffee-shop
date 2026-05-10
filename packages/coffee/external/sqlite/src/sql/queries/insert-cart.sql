insert into
  carts (owner_user_id)
values
  (:owner_user_id)
on conflict (owner_user_id) do nothing;
