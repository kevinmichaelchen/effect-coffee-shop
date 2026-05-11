delete from pending_order_confirmation_items;

delete from pending_order_confirmations;

alter table pending_order_confirmations
add column confirmation_id text not null default '00000000-0000-4000-8000-000000000000';
