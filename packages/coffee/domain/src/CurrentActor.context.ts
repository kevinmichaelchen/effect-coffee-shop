import * as Domain from "@alchemy.run/domain";
import { Actor } from "./Actor.ts";

/**
 * Who is making the current request. `Session` provides it; commands read it
 * in `decide` and views in `validate`.
 */
export class CurrentActor extends Domain.RequestContext<CurrentActor>()(
  "Coffee/CurrentActor",
  Actor,
) {}
