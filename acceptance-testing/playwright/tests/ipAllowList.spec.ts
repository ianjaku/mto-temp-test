
import {
    createUniqueTestLogin
} from "@binders/binders-service-common/lib/testutils/fixtures/userfactory";
import { pwTest } from "../pwTest";
import sleep from "@binders/binders-service-common/lib/util/sleep";

pwTest("Navigate in reader", async ({ createTabs, seed, fixtures }) => {
    const login = createUniqueTestLogin();
    const password = createUniqueTestLogin();
    await seed({
        users: [
            { login, password },
        ],
        items: {
            type: "collection",
            title: "Test collection",
            roles: {
                Editor: [login]
            },
            children: [
                {
                    type: "document",
                    title: "Test document",
                    published: true,
                    chunks: ["first chunk"],
                }
            ]
        }
    });
    const ipWhitelistBlocking = {
        domain: fixtures.getDomain(),
        CIDRs: ["8.8.8.8/32"],
        enabled: true,
    }
    await fixtures.routing.saveIpWhitelist(ipWhitelistBlocking);

    const [tab1, tab2] = await createTabs(2);
    const reader1 = await tab1.openReader();
    await reader1.errors.expectText("Invalid client ip.");

    const ipWhitelistDisabled = {
        ...ipWhitelistBlocking,
        enabled: false,
    }
    await fixtures.routing.saveIpWhitelist(ipWhitelistDisabled);
    // Wait for allow-list cache entries to expire
    await sleep(6_000);

    const reader2 = await tab2.openReaderAsUser(login, password);
    await reader2.browser.expectLoggedInUser(login);

});