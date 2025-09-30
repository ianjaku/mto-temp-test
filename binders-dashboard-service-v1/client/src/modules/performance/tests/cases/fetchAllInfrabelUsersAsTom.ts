import { getAccountServiceClient, getUserServiceClient } from "../clients";
import TestAccounts from "../data/accounts";
import TestUsers from "../data/users"

export default {
    id: "allUsersInfrabelAsTom",
    name: "Fetch al infrabel users (Tom)",
    async run(): Promise<void> {
        const userServiceClient = await getUserServiceClient(TestUsers.TOM);
        const accountServiceClient = await getAccountServiceClient(TestUsers.TOM);
        const account = await accountServiceClient.getAccount(TestAccounts.INFRABEL);
        await userServiceClient.findUserDetailsForIds(account.members);
    },
    expectedTimings: {
        normal: 3000,
        maximum: 5000
    }
}
