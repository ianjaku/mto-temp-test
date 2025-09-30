import { AccountServiceClient } from "@binders/client/lib/clients/accountservice/v1/client";
import {
    BackendAccountServiceClient
} from  "@binders/binders-service-common/lib/apiclient/backendclient";
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import { getCases } from "./cases";


const TEST_ACCOUNT_ID = "aid-ff1ce900-6ac9-479d-959c-5d301ed71380"; // Volvo
const TEST_READER_DOMAIN = "volvotraining.manual.to";

const TEST_NAME = "search-component-test";


const config = BindersConfig.get();

let accountServiceClient;
async function getAccountServiceClient(): Promise<AccountServiceClient> {
    if (!accountServiceClient) {
        accountServiceClient = await BackendAccountServiceClient.fromConfig(config, TEST_NAME)
    }
    return accountServiceClient;
}

async function accountExists(accountId: string): Promise<boolean> {
    const client = await getAccountServiceClient();
    try {
        await client.getAccount(accountId);
        return true;
    } catch (ex) {
        // eslint-disable-next-line no-console
        // console.error(ex);
        return false;
    }
}

export const UID_ACCOUNT_ADMIN = "uid-67264963-da1e-486b-b762-a81f54acd354"; // Henrik
export const UID_SUBCOL_EDITOR = "uid-1c33bdb3-bae7-4fc8-ade2-d42db664485f"; // Franky Van Cleven (Belgian Editor)
export const UID_SUBCOL_READER = "uid-94e9588b-9bf0-4502-93ad-2f04d7a51e40"; // Dewandelaer Anne (Belgian Reader)

function getUsers() { return [
    { name: "AccountAdmin", id: UID_ACCOUNT_ADMIN },
    { name: "SubcollectionEditor", id: UID_SUBCOL_EDITOR },
    { name: "SubcollectionReader", id: UID_SUBCOL_READER }
]}

function getCollections() { return [
    { name: "RootCollection", id: "AW0kjb8-0Qlq3PESnGmE" }, // Volvo root
    { name: "SubCollection", id: "AW7Xkh5AiZTtrnDeo8Kf" }, // Commercial > Local versions > EMEA > Belgium (Commercial trainings)
]}

function getTestCases() {
    const users = getUsers();
    const searchContexts = getCollections();
    const testCases = getCases();
    const cases = [];
    for (const user of users) {
        for(const searchContext of searchContexts) {
            for(const testCase of testCases) {
                const key = `${testCase.name} (user: ${user.name} | scope: ${searchContext.name})`;
                cases.push({
                    name: key,
                    test: async () => {
                        if (! await accountExists(TEST_ACCOUNT_ID)) {
                            // eslint-disable-next-line no-console
                            console.log(`Skipping test, account ${TEST_ACCOUNT_ID} not found`)
                            return;
                        }
                        const result = await testCase.test(TEST_ACCOUNT_ID, TEST_READER_DOMAIN, user, searchContext);
                        await testCase.validation(result, user, searchContext);
                    }
                });
            }
        }
    }
    return cases;
}

describe("Perform multiple test cases", () => {
    const cases = getTestCases();
    for (const testCase of cases) {
        test(testCase.name, testCase.test);
    }
});