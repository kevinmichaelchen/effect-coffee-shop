import * as Domain from "alchemy/Domain";

/** Only a cart's owner may change or read it. */
export class NotYourCart extends Domain.Rejection("NotYourCart") {}
