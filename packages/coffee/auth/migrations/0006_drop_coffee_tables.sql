-- Orders, carts and checkouts moved into the event-sourced alchemy/Domain
-- model on Durable Objects. This database now holds only auth state.
drop table if exists checkout_session_items;
drop table if exists checkout_sessions;
drop table if exists cart_items;
drop table if exists carts;
drop table if exists order_items;
drop table if exists orders;
drop table if exists menu_items;
