import * as Domain from "@alchemy.run/domain";

/** A customer asked about someone else's order. */
export class NotYourOrder extends Domain.Rejection("NotYourOrder") {}
