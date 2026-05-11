insert into
  checkout_sessions (
    id,
    owner_user_id,
    status,
    total_price_cents,
    created_at,
    updated_at,
    expires_at
  )
values
  (
    :session.id,
    :session.ownerUserId,
    :session.status,
    :session.totalPriceCents,
    :session.createdAt,
    :session.updatedAt,
    :session.expiresAt
  )
on conflict (id) do update
set
  owner_user_id = excluded.owner_user_id,
  status = excluded.status,
  total_price_cents = excluded.total_price_cents,
  created_at = excluded.created_at,
  updated_at = excluded.updated_at,
  expires_at = excluded.expires_at;
