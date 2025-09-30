import { createUniqueTestLogin } from "@binders/binders-service-common/lib/testutils/fixtures/userfactory";
import { pwTest } from "../pwTest";


pwTest("Non existing reader domain", async ({ createWindow, seed }) => {
    const login = createUniqueTestLogin();
    const password =  createUniqueTestLogin();
    await seed({
        users: [
            { login: login, password: password },
        ],
    });
    const window = await createWindow();
    const nonExistingDomain = "nonexistingdomain.manual.to";
    const reader = await window.openReader("/", nonExistingDomain);
    await reader.errors.expectErrorMessage(`Domain ${nonExistingDomain} does not exist`);
    const reader2 = await window.openReader("/login", nonExistingDomain);
    await reader2.login.loginWithEmailAndPass(login, password);
    await reader2.errors.expectErrorMessage(`Domain ${nonExistingDomain} does not exist`);
});