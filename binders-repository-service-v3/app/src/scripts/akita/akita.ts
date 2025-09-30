/* eslint-disable no-console */
import { Account } from "@binders/client/lib/clients/accountservice/v1/contract";
import { AkitaEventType } from ".";
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import { DefaultESQueryBuilderHelper } from "../../repositoryservice/esquery/helper";
import { ElasticBindersRepository } from "../../repositoryservice/repositories/binderrepository";
import {
    ElasticCollectionsRepository
} from "../../repositoryservice/repositories/collectionrepository";
import { LoggerBuilder } from "@binders/binders-service-common/lib/util/logging";
import RateLimiter from "@binders/binders-service-common/lib/util/rateLimiter";
import { User } from "@binders/client/lib/clients/userservice/v1/contract";
import { getUserFirstAndLastName } from "./helpers";

const config = BindersConfig.get();

const API_TOKEN = config.getString("akita.apiKey").get();
const DRY = false; // If true, won't actually write to Akita (for testing purposes)

const MAX_REQUESTS_PER_MINUTE = 118; // Akita's rate limit is 120 requests per minute
const rateLimiter = new RateLimiter(MAX_REQUESTS_PER_MINUTE);


interface AkitaEventBody {
    event: AkitaEventType,
    event_date: string,
    event_count: number,
}

// event aggregators produce these, internal_contact_id not known at this point
export type EventPartial = AkitaEventBody & {
    manualtoUserId: string,
}

// these are ready to send to Akita
export type AkitaEventParams = AkitaEventBody & {
    internal_contact_id: string,
}

export const upsertAccountAkita = async (account: Account): Promise<void> => {
    const config = BindersConfig.get();
    const logger = LoggerBuilder.fromConfig(config);

    const binderRepo = new ElasticBindersRepository(config, logger, new DefaultESQueryBuilderHelper(config));
    const collRepo = new ElasticCollectionsRepository(config, logger, new DefaultESQueryBuilderHelper(config));

    const collCount = await collRepo.countCollections(account.id);
    const binderCount = await binderRepo.countBinders(account.id);

    const akitaAccount = {
        internal_id: account.id,
        name: account.name,
        traits: {
            userCount: account.members.length,
            editorExpirationDate: new Date(account.expirationDate).getTime(),
            readerExpirationDate: new Date(account.readerExpirationDate).getTime(),
            collectionCount: collCount,
            documentCount: binderCount
        }
    };

    const publicUserForAccount = {
        internal_id: `public_${account.id}`,
        internal_account_id: account.id,
        first_name: "public",
        last_name: "user",
    };

    if (DRY) {
        console.log("dry run: Would have upserted account: ", JSON.stringify(akitaAccount, null, 2));
        console.log("dry run: Would have upserted public user: ", JSON.stringify(publicUserForAccount, null, 2));
        return;
    }

    await rateLimiter.fetch("https://api.akitaapp.com/v1/accounts", {
        method: "POST",
        headers: {
            "Authorization": "Bearer " + API_TOKEN,
            "Content-Type": "application/json"
        },
        body: JSON.stringify(akitaAccount)
    });

    // upsert the public user for this account
    await rateLimiter.fetch("https://api.akitaapp.com/v1/contacts", {
        method: "POST",
        headers: {
            "Authorization": "Bearer " + API_TOKEN,
            "Content-Type": "application/json"
        },
        body: JSON.stringify(publicUserForAccount)
    });
}

export const upsertUsersAkita = async (users: Array<User & { accountId: string }>): Promise<void> => {
    let i = 0;
    for (const user of users) {

        const [first_name, last_name] = getUserFirstAndLastName(user);

        const akitaContact = {
            internal_id: `${user.login}_${user.accountId}`,
            internal_account_id: user.accountId,
            first_name,
            last_name,
            email: user.login,
        };
        if (DRY) {
            console.log("dry run: Would have upserted contact: ", JSON.stringify(akitaContact, null, 2));
            return Promise.resolve();
        } else {
            console.log(`(${++i}/${users.length}) Upserting user "${user.login}"`);
        }
        await rateLimiter.fetch("https://api.akitaapp.com/v1/contacts", {
            method: "POST",
            headers: {
                "Authorization": "Bearer " + API_TOKEN,
                "Content-Type": "application/json"
            },
            body: JSON.stringify(akitaContact)
        });
    }
}


export const sendAkitaEvents = async (events: AkitaEventParams[]): Promise<void> => {
    if (DRY) {
        console.log("dry run: Would have sent events: ", JSON.stringify(events, null, 2));
        return;
    }
    const result = await rateLimiter.fetch("https://api.akitaapp.com/v1/event-counts", {
        method: "POST",
        headers: {
            "Authorization": "Bearer " + API_TOKEN,
            "Content-Type": "application/json"
        },
        body: JSON.stringify(events)
    });
    if (result.status !== 202) {
        console.log("Failed to send events to Akita");
        console.log(`Response status: ${result.status}`);
        const json = await result.json();
        console.log("Response json: ", json, JSON.stringify(json, null, 2));
        throw new Error("Failed to send events to Akita");
    }
}
