import { getAccountServiceClient, getUserServiceClient } from "../clients";
import TestAccounts from "../data/accounts";
import TestUsers from "../data/users"

export default {
    id: "allUsersVolvoAsHenrik",
    name: "Fetch al volvotraining users (Henrik)",
    async run(): Promise<void> {
        const userServiceClient = await getUserServiceClient(TestUsers.HENRIK_VOLVO);
        const accountServiceClient = await getAccountServiceClient(TestUsers.HENRIK_VOLVO);
        const account = await accountServiceClient.getAccount(TestAccounts.VOLVO_TRAINING);
        await userServiceClient.findUserDetailsForIds(account.members);
    },
    expectedTimings: {
        normal: 3000,
        maximum: 5000
    }
}
