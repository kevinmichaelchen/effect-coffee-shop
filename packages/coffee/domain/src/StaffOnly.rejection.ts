import * as Domain from "alchemy/Domain";

/** Only coffee-shop staff may do this. */
export class StaffOnly extends Domain.Rejection("StaffOnly") {}
