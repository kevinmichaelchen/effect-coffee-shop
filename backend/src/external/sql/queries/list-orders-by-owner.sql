select *
from orders
where owneruserid = :ownerUserId
order by createdat, id;
