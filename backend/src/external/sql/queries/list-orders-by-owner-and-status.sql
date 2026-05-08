select *
from orders
where owner_user_id = :owner_user_id and status = :status
order by created_at, id;
