import { AuthTokenProvider, EventQueueAuthStore } from "./EventQueueAuthStore";
import { EventPayload, EventType } from "../../clients/trackingservice/v1/contract";
import {
    safeLocalStorageGetItem,
    safeLocalStorageRemoveItem,
    safeLocalStorageSetItem
} from  "../../localstorage";
import tokenstore from "../../clients/tokenstore";

const MAX_QUEUE_SIZE = 250;
const INTERVAL = 10 * 1000;
const STORAGE_TOKEN = "tracking_queue";
const FAILED_SEND_ATTEMPTS_LIMIT = 100;

type Event = EventPayload & { timestamp: number };

export type ProxySend = (events: Array<Event>, urgent?: boolean, userId?: string) => Promise<boolean>;

export class EventQueue {
    queue: Array<Event> = [];
    worker: NodeJS.Timer; // set interval returns number to the timer
    proxySend: ProxySend;
    isFlushingQueue: boolean;
    failedSendAttempts: number;
    urgentEventsPending = false;
    authStore: EventQueueAuthStore;

    constructor() {
        const queued = safeLocalStorageGetItem(STORAGE_TOKEN) || "[]";
        this.queue = JSON.parse(queued);
        this.worker = setInterval(this.flushQueue, INTERVAL);
        this.failedSendAttempts = 0;
    }

    add(event: Event): void {
        if (this.queue.length >= MAX_QUEUE_SIZE) {
            // eslint-disable-next-line no-console
            console.log("Dropping events, max queue size reached.");
            return;
        }
        if (event.eventType === EventType.USER_IS_ONLINE) {
            this.queue = this.queue.filter(evt => evt.eventType !== EventType.USER_IS_ONLINE);
        }
        if (!this.queue.some(evt =>
            evt.timestamp === event.timestamp &&
            evt.userId === event.userId &&
            evt.eventType === event.eventType
        )) {
            this.queue.push(event);
        }
        safeLocalStorageSetItem(STORAGE_TOKEN, JSON.stringify(this.queue));
    }

    async log(eventType: EventType, accountId?: string, data?: Record<string, unknown>, urgent = false, userId?: string): Promise<void> {
        if (userId == null && typeof data?.userId === "string") {
            userId = data.userId;
        }
        const authToken = await this.authStore?.getAuthToken(userId);
        const event: Event = {
            timestamp: Date.now(),
            eventType: eventType,
            accountId,
            userId: tokenstore.isPublic() ? "public" : userId,
            ...(data ? { data } : {}),
            authToken
        };
        if (urgent) {
            if (this.isFlushingQueue) {
                this.send([event], true, userId);
            } else {
                this.add(event);
                this.flushQueue(urgent);
            }
            return;
        }
        this.add(event);
    }

    shouldRetryAfterFail = (): boolean => {
        if (!window.navigator["isOnline"]) {
            return true;
        }
        this.failedSendAttempts++;
        if (this.failedSendAttempts === FAILED_SEND_ATTEMPTS_LIMIT) {
            this.failedSendAttempts = 0;
            return false;
        }
        return true;
    }
    resetFailedAttempts = (): void => {
        this.failedSendAttempts = 0;
    }

    flushQueue = async (urgent = false): Promise<void> => {
        if (this.queue.length <= 0 || this.isFlushingQueue) {
            return;
        }
        if (!this.proxySend) {
            if (urgent) {
                this.urgentEventsPending = true;
            }
            return;
        }
        this.isFlushingQueue = true;
        const sendTimestamp = new Date().getTime();
        const toSend = this.queue.reduce((reduced, evt) => {
            if (EventType[evt.eventType] !== undefined) {
                reduced.push({
                    ...evt,
                    occurrenceMsDiff: sendTimestamp - evt.timestamp,
                })
            }
            return reduced;
        }, [] as Event[]);

        const eventsMappedToUserId = toSend.reduce((prev, e) => {
            const userId = e.userId || "public";

            if(prev[userId]) {
                prev[userId].push(e);
            } else {
                prev[userId] = [e];
            }
            return prev;
        }, {} as Record<string, Event[]>);
        // send to client
        try {
            const success = await Promise.all(Object.keys(eventsMappedToUserId).map(uId => {
                return this.send(eventsMappedToUserId[uId], urgent, uId === "public" ? undefined : uId);
            }));
            if (success || !this.shouldRetryAfterFail()) {
                this.emptyQueue();
                if (success) {
                    this.resetFailedAttempts();
                }
            }
        } finally {
            this.isFlushingQueue = false;
        }
    };

    private async send (
        events: Event[],
        urgent?: boolean,
        userId?: string,
    ): Promise<boolean> {
        if (!events || events.length === 0) {
            return false;
        }
        return this.proxySend(events, urgent, userId);
    }

    emptyQueue = (): void => {
        this.queue = [];
        safeLocalStorageRemoveItem(STORAGE_TOKEN);
    };

    setSendMethod = (sendMethod: ProxySend): void => {
        this.proxySend = sendMethod;
        if (this.queue.length) {
            this.flushQueue(this.urgentEventsPending);
        }
    };

    setAuthTokenProvider = (provider: AuthTokenProvider): void => {
        if (this.authStore) return;
        this.authStore = new EventQueueAuthStore(provider);
        this.fillMissingAuthTokens();
    };

    /**
     * If the auth provider is set after the queue is filled, we need to fill the missing auth tokens
     */
    private async fillMissingAuthTokens(): Promise<void> {
        for (const event of this.queue) {
            if (event.userId && event.userId !== "public" && !event.authToken) {
                event.authToken = await this.authStore.getAuthToken(event.userId);
            }
        }
    }
}
const instance = new EventQueue();
export default instance;
