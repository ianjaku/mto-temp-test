import { RedisClient } from "../../redis/client";

export type InvalidateEventType = "onCreate" | "onDelete" | "onUpdate";


export class Invalidator<EventType> {

    constructor(
        protected readonly client: RedisClient
    ) {}

    onDelete(events: EventType[]): Promise<void> {
        throw new Error("onDelete not supported " + events);
    }

    onUpdate(events: EventType[]): Promise<void> {
        throw new Error("onDelete not supported " + events);
    }

    onCreate(events: EventType[]): Promise<void> {
        throw new Error("onDelete not supported " + events);
    }
}
