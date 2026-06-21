import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as HashMap from "effect/HashMap";
import * as Option from "effect/Option";
import * as Ref from "effect/Ref";
import { CheckoutSessionRepository } from "@effect-coffee-shop/coffee-core/application/ports/CheckoutSessionRepository";
import type {
  CheckoutSession,
  CheckoutSessionId,
} from "@effect-coffee-shop/coffee-core/domain/checkout-session";

type CheckoutSessionStore = Ref.Ref<HashMap.HashMap<CheckoutSessionId, CheckoutSession>>;

const ownedBy = (ownerUserId: string) => (session: CheckoutSession) =>
  session.ownerUserId === ownerUserId;

const mostRecentlyUpdatedFirst = (left: CheckoutSession, right: CheckoutSession) =>
  DateTime.toEpochMillis(right.updatedAt) - DateTime.toEpochMillis(left.updatedAt);

const currentSessionForOwner = (
  currentSessions: HashMap.HashMap<CheckoutSessionId, CheckoutSession>,
  ownerUserId: string,
) =>
  Array.from(HashMap.values(currentSessions))
    .filter(ownedBy(ownerUserId))
    .sort(mostRecentlyUpdatedFirst)[0];

const currentSessionOption = (
  currentSessions: HashMap.HashMap<CheckoutSessionId, CheckoutSession>,
  ownerUserId: string,
) => Option.fromUndefinedOr(currentSessionForOwner(currentSessions, ownerUserId));

export const makeCheckoutSessionRepository = (sessions: CheckoutSessionStore) =>
  CheckoutSessionRepository.of({
    getById: (id) => Ref.get(sessions).pipe(Effect.map(HashMap.get(id))),
    getCurrentByOwnerUserId: (ownerUserId) =>
      Ref.get(sessions).pipe(
        Effect.map((currentSessions) => currentSessionOption(currentSessions, ownerUserId)),
      ),
    save: (session) =>
      Ref.update(sessions, HashMap.set(session.id, session)).pipe(Effect.as(session)),
    clearCurrentByOwnerUserId: (ownerUserId) =>
      Ref.update(sessions, (currentSessions) =>
        Option.match(currentSessionOption(currentSessions, ownerUserId), {
          onNone: () => currentSessions,
          onSome: (current) => HashMap.remove(currentSessions, current.id),
        }),
      ),
  });
