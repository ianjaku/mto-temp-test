import TestAccounts from "../data/accounts";
import TestUsers from "../data/users"
import { getTrackingServiceClient } from "../clients";

export default {
    id: "volvoAnalyticsAsHenrik",
    name: "Fetch Volvo analytics (Henrik)",
    async run(): Promise<void> {
        const trackingServiceClient = await getTrackingServiceClient(TestUsers.HENRIK_VOLVO);
        const now = (new Date()).getTime();
        const oneMonthAgo = new Date(now - 1000 * 3600 * 24 * 30);
        const filter = {
            "accountId": TestAccounts.VOLVO_TRAINING,
            "itemIds": [],
            "userIds": [],
            "userGroupIds": [],
            "startRange": {
                "rangeStart": oneMonthAgo
            },
            "userActionTypes": [],
            "recursive": true
        };
        await trackingServiceClient.searchUserActions(filter);
    },
    expectedTimings: {
        normal: 3000,
        maximum: 5000
    }
}
