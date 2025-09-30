import { MeasuredRequest } from "../util";
import demoRootAsJorim from "./cases/loadDemoRootAsJorim";
import fetchAllInfrabelUsersAsTom from "./cases/fetchAllInfrabelUsersAsTom";
import fetchAllVolvoUsers from "./cases/fetchAllVolvotrainingUsersAsHenrik";
import fetchVolvoAnalyticsAsHenrik from "./cases/fetchVolvoAnalyticsAsHenrik";
import loadRailways from "./cases/loadRailwaysFromProduction";
import whoAmIAsTom from "./cases/fetchCurrentUserAsTom";

export function buildTestSet(): MeasuredRequest[] {
    return [
        demoRootAsJorim,
        fetchAllVolvoUsers,
        fetchAllInfrabelUsersAsTom,
        fetchVolvoAnalyticsAsHenrik,
        loadRailways,
        whoAmIAsTom
    ]
}