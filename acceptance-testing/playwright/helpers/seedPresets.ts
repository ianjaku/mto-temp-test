import { type PwTestFixtures } from "../pwTest";
import { createUniqueTestLogin } from "@binders/binders-service-common/lib/testutils/fixtures/userfactory";

export async function setupSomeAccountAndUser({ seed }: Partial<PwTestFixtures>) {
    const login = createUniqueTestLogin();
    const password = createUniqueTestLogin();
    await seed({
        features: [],
        users: [{ login, password }],
        items: {
            type: "collection",
            title: "Root collection",
            children: [{
                title: "Test document",
                type: "document",
                published: true,
                roles: { Reader: [login] },
                languageCode: "en",
                chunks: ["First chunk", "Second chunk"],
            }],
            roles: { Editor: [login] },
        },
    });
    return { login, password };
}
