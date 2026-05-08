select *
from orders
where owneruserid = :ownerUserId and status = :status
order by createdat, id;
