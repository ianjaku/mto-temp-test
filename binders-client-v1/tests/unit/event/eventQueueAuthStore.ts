import { EventQueueAuthStore } from "../../../src/react/event/EventQueueAuthStore";
import { addHours } from "date-fns";

const USER_ID = "someUserId";
describe("EventQueueAuthStore", () => {
    it("to return null auth token when user id is null or public", async () => {
        const tokenProvider = jest.fn();
        const store = new EventQueueAuthStore(tokenProvider);

        const tokenPublicUserId = await store.getAuthToken("public");
        const tokenNullUserId = await store.getAuthToken(null);

        expect(tokenNullUserId).toBeNull();
        expect(tokenPublicUserId).toBeNull();
        expect(tokenProvider).not.toHaveBeenCalled();
    });

    it("should return the same token when the time to expire is between 6 and 8 days", async () => {
        for (const hoursAhead of [150, 160, 180]) {
            const tokenProvider = jest.fn(async () => ({
                token: `token-${Math.random()}`,
                userId: USER_ID,
                expiresOn: addHours(Date.now(), hoursAhead),
            }));
            const store = new EventQueueAuthStore(tokenProvider);

            const firstToken = await store.getAuthToken(USER_ID);
            const secondToken = await store.getAuthToken(USER_ID);

            expect(firstToken).not.toBeNull();
            expect(firstToken).toEqual(secondToken);
            expect(tokenProvider).toHaveBeenCalledTimes(1);
        }
    });

    it("should return the different token when the time to expire is less than or equal to 23", async () => {
        for (const hoursAhead of [23, 10, 8, 2, 0]) {
            const tokenProvider = jest.fn(async () => ({
                token: `token-${Math.random()}`,
                userId: USER_ID,
                expiresOn: addHours(Date.now(), hoursAhead),
            }));
            const store = new EventQueueAuthStore(tokenProvider);

            const firstToken = await store.getAuthToken(USER_ID);
            const secondToken = await store.getAuthToken(USER_ID);

            expect(firstToken).not.toBeNull();
            expect(secondToken).not.toBeNull();
            expect(firstToken).not.toEqual(secondToken);
            expect(tokenProvider).toHaveBeenCalledTimes(2);
        }
    });
});