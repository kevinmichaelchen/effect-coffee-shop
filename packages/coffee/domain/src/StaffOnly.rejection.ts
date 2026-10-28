import * as Domain from "@alchemy.run/domain";

/** Only coffee-shop staff may do this. */
export class StaffOnly extends Domain.Rejection("StaffOnly") {}
