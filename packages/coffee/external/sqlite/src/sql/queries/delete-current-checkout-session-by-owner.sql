delete from checkout_sessions
where id = (
  select id
  from checkout_sessions
  where owner_user_id = :ownerUserId
    and status = 'awaiting_confirmation'
  order by updated_at desc, id desc
  limit 1
);
