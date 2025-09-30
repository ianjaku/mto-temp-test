import { UserIdOrPublic, tcombValidate } from "../../validation";
import { EventType } from "./contract";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const t = require("tcomb");

/**
 * Validation definitions
 */
const Type = t.enums(EventType);
const Event = t.struct(
    {
        userId: t.maybe(UserIdOrPublic),
        accountId: t.maybe(t.String),
        eventType: Type,
        occurrenceMsDiff: t.maybe(t.Number),
        data: t.maybe(t.Object)
    },
    "Event"
);

const Events = t.list(Event);

const TrustedDataFields = t.struct({
    binderId: t.maybe(t.String),
    itemId: t.maybe(t.String),
});

const EventFilterStruct = t.struct({
    accountIds: t.maybe(t.list(t.String)),
    eventType: t.maybe(t.Number),
    rangeStart: t.maybe(t.Date),
    rangeEnd: t.maybe(t.Date),
    itemKind: t.maybe(t.String),
    data: t.maybe(TrustedDataFields),
});

/**
 * Validate an array of events
 * @param candidates
 */
export const validateEvents = (candidates: unknown): string[] => tcombValidate(candidates, Events);

export function validateEventFilter(eventFilterCandidate: unknown): string[] {
    return tcombValidate(eventFilterCandidate, EventFilterStruct);
}
