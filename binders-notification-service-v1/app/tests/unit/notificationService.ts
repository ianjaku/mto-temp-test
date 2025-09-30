import { MissingNotificationTargetItem, NotificationDispatcher } from "../../src/notificationservice/events/dispatcher";
import { MockProxy, any, mock } from "jest-mock-extended";
import { NotificationDispatcherFactory } from "../../src/notificationservice/events/dispatcherfactory";
import { NotificationKind } from "@binders/client/lib/clients/notificationservice/v1/contract";
import { NotificationService } from "../../src/notificationservice/service";
import { ScheduledEvent } from "../../src/notificationservice/repositories/models/scheduledevent";
import { ScheduledEventIdentifier } from "@binders/binders-service-common/lib/authentication/identity";
import { ScheduledEventRepository } from "../../src/notificationservice/repositories/scheduledevents";

const ACCOUNT_ID = "aid-account-id";
const SCHEDULED_EVENT_ID = "sce-123";

describe("runScheduledEvents", () => {
    let notificationService: NotificationService;
    let scheduledEventRepository: MockProxy<ScheduledEventRepository>;
    let dispatcherFactory: MockProxy<NotificationDispatcherFactory>;
    let dispatcher: MockProxy<NotificationDispatcher>;

    beforeEach(() => {
        scheduledEventRepository = mockWithFailure();
        dispatcherFactory = mockWithFailure();

        notificationService = new NotificationService(
            mock(),
            mock(),
            dispatcherFactory,
            null,
            scheduledEventRepository,
            null,
            null,
            null,
            null,
            null,
        );

        scheduledEventRepository.find
            .calledWith(any())
            .mockResolvedValueOnce([buildScheduledEvent()]);
        scheduledEventRepository.claim
            .calledWith(SCHEDULED_EVENT_ID)
            .mockResolvedValueOnce(undefined);

        dispatcher = mockWithFailure<NotificationDispatcher>();
        dispatcherFactory.buildDispatcherFor
            .calledWith(ACCOUNT_ID)
            .mockResolvedValueOnce(dispatcher);
    });

    it("sends regular notifications", async () => {
        scheduledEventRepository.claim
            .calledWith(SCHEDULED_EVENT_ID)
            .mockResolvedValueOnce(true);
        scheduledEventRepository.delete
            .calledWith(SCHEDULED_EVENT_ID)
            .mockResolvedValueOnce(undefined);

        dispatcher.dispatch
            .calledWith(any())
            .mockReturnValueOnce(undefined);

        await notificationService.runScheduledEvents();
    });

    it("deletes notification and continues without error on missing item", async () => {
        scheduledEventRepository.claim
            .calledWith(SCHEDULED_EVENT_ID)
            .mockResolvedValueOnce(true);
        scheduledEventRepository.delete
            .calledWith(SCHEDULED_EVENT_ID)
            .mockResolvedValueOnce(undefined);

        dispatcher.dispatch
            .calledWith(any())
            .mockRejectedValueOnce(new MissingNotificationTargetItem("Missing item id"));

        await notificationService.runScheduledEvents();
    });

    it("unclaims notification on unexpected error", async () => {
        scheduledEventRepository.claim
            .calledWith(SCHEDULED_EVENT_ID)
            .mockResolvedValueOnce(true);
        scheduledEventRepository.unClaim
            .calledWith(SCHEDULED_EVENT_ID)
            .mockResolvedValueOnce(undefined);

        dispatcher.dispatch
            .calledWith(any())
            .mockRejectedValueOnce(new Error("Unexpected"));

        await notificationService.runScheduledEvents();
    });

    it("failure to claim should not dispatch", async () => {
        scheduledEventRepository.claim
            .calledWith(SCHEDULED_EVENT_ID)
            .mockResolvedValueOnce(false);

        await notificationService.runScheduledEvents();
    });
});

const buildScheduledEvent = (): ScheduledEvent => {
    return new ScheduledEvent(
        new ScheduledEventIdentifier(SCHEDULED_EVENT_ID),
        ACCOUNT_ID,
        NotificationKind.PUBLISH,
        new Date(),
        new Date(),
        {
            accountId: ACCOUNT_ID,
            kind: NotificationKind.PUBLISH,
            actorId: "uid-actor-id",
            itemId: "item-id",
        },
    );
};

const mockWithFailure = <T>() => mock<T>({} as never, { fallbackMockImplementation: (...params: unknown[]) => {
    throw new Error("Called method was not mocked when called with: " + JSON.stringify(params, null, 2));
}});
