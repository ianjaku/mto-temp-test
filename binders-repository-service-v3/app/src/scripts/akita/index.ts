/* eslint-disable no-console */
import {
    AkitaEventParams,
    EventPartial,
    sendAkitaEvents,
    upsertAccountAkita,
    upsertUsersAkita
} from "./akita";
import {
    BackendAccountServiceClient,
    BackendUserServiceClient
} from "@binders/binders-service-common/lib/apiclient/backendclient";
import { format, isBefore, subDays } from "date-fns";
import { groupBy, pick } from "ramda";
import { Account } from "@binders/client/lib/clients/accountservice/v1/contract";
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import { User } from "@binders/client/lib/clients/userservice/v1/contract";
import { getItemsCreatedEvents } from "./events/itemsCreated";
import { getItemsEditedEvents } from "./events/itemsEdited";
import { getPublicationsCreatedEvents } from "./events/newPublications";
import { getReadEvents } from "./events/reads";

export enum AkitaEventType {
    DocumentPublished = "document:published",
    DocumentEdited = "document:edited",
    DocumentCreated = "document:created",
    DocumentReadNoAuthor = "document:read:no-author",
    DocumentRead = "document:read",
    CollectionEdited = "collection:edited",
    CollectionCreated = "collection:created",
}

const hasAccountExpired = (account: Account): boolean => {
    const expirationDate = new Date(account.expirationDate);
    return isBefore(expirationDate, new Date());
}

const getUsers = async (userIds: string[]): Promise<User[]> => {
    const config = BindersConfig.get();
    const userService = await BackendUserServiceClient.fromConfig(config, "Akita");
    return userService.findUserDetailsForIds(userIds);
}

const doIt = async () => {
    const config = BindersConfig.get();

    const accountService = await BackendAccountServiceClient.fromConfig(config, "akita");
    const yesterday = format(subDays(new Date(), 1), "yyyy-MM-dd");
    const accounts = await accountService.listAccounts();

    const annotatedEvents: Array<EventPartial & { accountId: string }> = [];

    for (let i = 0; i < accounts.length; i++) {
        const account = accounts[i];

        if (hasAccountExpired(account)) {
            console.log(`(${i}/${accounts.length}) Expired, skipping "${account.name}"`);
            continue;
        }

        // Log progress
        console.log(`(${i + 1}/${accounts.length}) Upserting account "${account.name}"`);

        // Update all accounts in Akita
        await upsertAccountAkita(account);
        const eventsNested = await Promise.all([
            // docs & colls created
            getItemsCreatedEvents(account, yesterday),
            // docs & colls edited (unique items edited)
            getItemsEditedEvents(account, yesterday),
            // publications created
            getPublicationsCreatedEvents(account, yesterday),
            // Document reads with & without author
            getReadEvents(account, yesterday),
        ]);
        annotatedEvents.push(...eventsNested.flat().map(e => ({
            ...e,
            accountId: account.id
        })));
    }

    const uniqueUsers = annotatedEvents.reduce((acc, event) => {
        if (acc[event.manualtoUserId] || event.manualtoUserId === "public") {
            return acc;
        }
        return {
            ...acc,
            [event.manualtoUserId]: event.accountId,
        };
    }, {} as Record<string, string>);

    const userIds = Object.keys(uniqueUsers);
    const users = await getUsers(userIds);

    const usersToUpsert: Array<User & { accountId: string }> = Object.entries(uniqueUsers).map(([userId, accountId]) => {
        const user = users.find(u => u.id === userId);
        return { ...user, accountId };
    });

    await upsertUsersAkita(usersToUpsert);

    const allAkitaEvents: AkitaEventParams[] = annotatedEvents.map(event => {
        const user = users.find(u => u.id === event.manualtoUserId);
        return {
            ...pick(["event", "event_date", "event_count"], event),
            ...(event.manualtoUserId === "public" ?
                {
                    internal_contact_id: `public_${event.accountId}`
                } :
                {
                    internal_contact_id: `${user.login}_${event.accountId}`
                }),
        };
    });

    // Group them by type, because for some reason we can only send one metric type at a time
    const eventsByType = groupBy(
        (e) => e.event.toString(),
        allAkitaEvents,
    );

    let i = 0;
    for (const eventType of Object.keys(eventsByType)) {
        const events = eventsByType[eventType];
        const totalCount = events.reduce((acc, e) => acc + e.event_count, 0);
        console.log(`(${++i}/${Object.keys(eventsByType).length}) Sending ${events.length} events of type ${eventType} (total count ${totalCount})`);
        await sendAkitaEvents(events);
    }
}

doIt()
    .then(() => {
        console.log("Finished");
        process.exit(0);
    })
    .catch(err => {
        console.log("Oops, something went wrong", err);
        process.exit(1);
    });
