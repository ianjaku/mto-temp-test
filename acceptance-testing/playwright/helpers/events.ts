import { EventType } from "@binders/client/lib/clients/trackingservice/v1/contract";
import { TrackingServiceClient } from "@binders/client/lib/clients/trackingservice/v1/client";
import { log } from "../../shared/logging";


export interface PollOptions {
    maxAttempts: number;
    initialDelay: number;
    eventType: EventType;
    eventCount: number;
}

const MAX_DELAY = 5_000;
const MAX_ATTEMPTS = 120;

export async function pollForEvents(client: TrackingServiceClient, accountId: string, options: PollOptions) {
    const { maxAttempts, initialDelay, eventType, eventCount } = options;
    if (Number.isNaN(initialDelay) || initialDelay <= 0) {
        throw new Error(`Invalid initialDelay: ${initialDelay}`);
    }
    if (Number.isNaN(maxAttempts) || maxAttempts > MAX_ATTEMPTS) {
        throw new Error(`Invalid maxAttempts: ${maxAttempts}`);
    }
    let attempts = 0;
    let delay = initialDelay;
    async function poll() {
        attempts++;
        const events = await client.findEvents(accountId, {
            accountIds: [accountId],
            eventTypes: [eventType]
        })
        if (events.length >= eventCount) {
            return true;
        } else if (attempts < maxAttempts) {
            const remaining = eventCount - events.length;
            log(`Polling for ${remaining} ${eventType} more events.(attempt ${attempts}/${maxAttempts} - delay ${delay})`);
            await new Promise(resolve => setTimeout(resolve, delay));
            delay = Math.min(delay * 2, MAX_DELAY);
            return poll();
        } else {
            return false;
        }
    }
    return poll();
}

