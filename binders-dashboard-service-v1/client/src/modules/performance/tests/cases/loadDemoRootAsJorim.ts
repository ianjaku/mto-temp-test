import TestAccounts from "../data/accounts";
import TestItems from "../data/items";
import TestUsers from "../data/users";
import { getRepoServiceClient } from "../clients";

export default {
    id: "loadDemoRootAsJorim",
    name: "Load demo.manual.to root collection (Jorim)",
    async run(): Promise<void> {
        const client = await getRepoServiceClient(TestUsers.JORIM, TestAccounts.DEMO_MANUAL_TO);
        await client.getCollection(TestItems.DEMO_MANUAL_TO_ROOT_COLLECTION);
        return;
    },
    expectedTimings: {
        normal: 3000,
        maximum: 5000
    }
}