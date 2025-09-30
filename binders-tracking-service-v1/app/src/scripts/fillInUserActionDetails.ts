/* eslint-disable no-console */
import { BackendAccountServiceClient, BackendRepoServiceClient, BackendUserServiceClient } from "@binders/binders-service-common/lib/apiclient/backendclient";
import { readFileSync, writeFileSync } from "fs";
import { AccountServiceClient } from "@binders/client/lib/clients/accountservice/v1/client";
import { BinderRepositoryServiceClient } from "@binders/client/lib/clients/repositoryservice/v3/client";
import { ObjectConfig } from "@binders/client/lib/config/config";
import { UserServiceClient } from "@binders/client/lib/clients/userservice/v1/client";

const userAction = "DOCUMENT_READ";
const allowDuplicates = true;
const inFile = `/tmp/useractions/useractions-${userAction}.json`;
const outFile = `/tmp/useractions/useractions-${userAction}-with-details.json`;

const userCache = { };
let userClient: UserServiceClient = undefined;

const accountCache = { };
let accountClient: AccountServiceClient = undefined;

const itemNameCache = { };
let repoClient: BinderRepositoryServiceClient = undefined;

const configData = {
    serviceconfig: {
        jwt: {
            secret: "FILL IT IN"
        }
    },
    services: {
        accounts: {
            "location": "https://api.binders.media",
            "prefix": "/account"
        },
        binders: {
            "location": "https://api.binders.media",
            "prefix": "/binders"
        },
        users: {
            "location": "https://api.binders.media",
            "prefix": "/user"
        }
    }
};

const getAccountClient = async(): Promise<AccountServiceClient> => {
    if(!accountClient) {
        const config = new ObjectConfig(configData);
        accountClient = await BackendAccountServiceClient.fromConfig(config, "fill-in-details");
    }
    return accountClient;
}
const getAccount = async (id) => {
    if (accountCache[id]) {
        return accountCache[id];
    }
    const client = await getAccountClient();
    const account = client.getAccount(id);
    accountCache[id] = account;
    return account;
}

const getUserClient = async (): Promise<UserServiceClient> => {
    if (!userClient) {
        const config = new ObjectConfig(configData);
        userClient = await BackendUserServiceClient.fromConfig(config, "fill-in-details");
    }
    return userClient;
}
const getUser = async (id) => {
    if (id === "public") {
        return {
            login: "public",
            displayName: ""
        };
    }
    if (userCache[id]) {
        return userCache[id];
    }
    try {
        const client = await getUserClient();
        const details = await client.getUser(id);
        userCache[id] = details;
        return details;
    } catch (err) {
        console.log(id);
        console.log(err);
        process.exit(0);
    }
}

const getRepoClient = async (): Promise<BinderRepositoryServiceClient> => {
    if (!repoClient) {
        const config = new ObjectConfig(configData);
        repoClient = await BackendRepoServiceClient.fromConfig(config, "fill-in-details");
    }
    return repoClient;
}
const getItemName = async (kind, id) => {
    if (itemNameCache[id]) {
        return allowDuplicates && itemNameCache[id];
    }
    const client = await getRepoClient();
    const items = await client.findItems({binderIds: [id]}, {maxResults: 1});
    const name = await extractName(kind, items[0]);
    itemNameCache[id] = name;
    return name;
}

const cleanName = (name: string) => name
    .replace(",", " ")
    .replace(/[\n\r\f\s]+/g, " ");

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const extractName = (kind, item): any => {
    if (!item) {
        return "n/a (deleted)";
    }
    if (kind === "binder") {
        if (!item.languages) {
            console.log("No languages detected");
            console.log(item);
            process.exit(1);
        }
        return cleanName(item.languages[0].storyTitle) || "n/a (empty)";
    }
    if (kind === "collection") {
        if (!item.titles) {
            console.log("No titles detected");
            console.log(item);
            process.exit(1);
        }
        return cleanName(item.titles[0].title) || "n/a (empty)";
    }
    console.log(item);
    console.log(kind);
}



const fillInData = async (data) => {
    const total = data.length + 1;
    let i = 0;
    console.log(`Processing ${total} rows.`)
    const withDetails = [];
    for (const row of data) {
        i++;
        const userDetails = await getUser(row.userId);
        const account = await getAccount(row.accountId);
        const itemName = await getItemName(row.itemKind, row.itemId);
        if (itemName !== false) {
            withDetails.push({
                ...row,
                itemName,
                accountName: account.name,
                login: userDetails.login,
                displayName: userDetails.displayName
            });
        } else {
            console.log("Skipping user action", row.itemId);
        }
        if ((i % 50) === 0) {
            console.log(`Progress: ${i} / ${total}`);
        }
    }
    return withDetails;
}



const doIt = async () => {
    const data = JSON.parse(readFileSync(inFile).toString());
    const dataWithDetails = await fillInData(data);
    writeFileSync(outFile, JSON.stringify(dataWithDetails));
};

doIt()
    .then(
        () => {
            console.log("! All done.");
            process.exit(0)
        },
        err => {
            console.log(err);
            process.exit(1);
        }
    )
