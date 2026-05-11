insert into
  pending_order_confirmations (owner_user_id, source, total_price_cents, updated_at)
values
  (?, ?, ?, ?)
on conflict (owner_user_id) do update set
  source = excluded.source,
  total_price_cents = excluded.total_price_cents,
  updated_at = excluded.updated_at;
