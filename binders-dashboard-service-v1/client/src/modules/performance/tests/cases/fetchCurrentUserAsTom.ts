import TestUsers from "../data/users"
import { getUserServiceClient } from "../clients";

export default {
    id: "whoAmITom",
    name: "Fetch the current user (Tom)",
    async run(): Promise<void> {
        const userServiceClient = await getUserServiceClient(TestUsers.TOM);
        await userServiceClient.whoAmI();
    },
    expectedTimings: {
        normal: 50,
        maximum: 100
    }
}
