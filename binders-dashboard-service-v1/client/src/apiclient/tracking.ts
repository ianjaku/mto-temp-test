import {
    IAccountViewsStatistics,
    ILoginStatistics,
    IUserCountStatistics
} from "@binders/client/lib/clients/trackingservice/v1/contract";
import { ExportServiceClient } from "@binders/client/lib/clients/exportservice/v1/client";
import { TrackingServiceClient } from "@binders/client/lib/clients/trackingservice/v1/client";
import config from "../config";
import { getBackendRequestHandler } from "../modules/api";

const backendTrackingClient = TrackingServiceClient.fromConfig(config, "v1", getBackendRequestHandler());
const backendExportClient = ExportServiceClient.fromConfig(config, "v1", getBackendRequestHandler());

export const loadLoginData = async (accountId: string): Promise<ILoginStatistics[]> => {
    return backendTrackingClient.loginStatistics(accountId);
};

export const loadUsersCountData = async (accountId: string): Promise<IUserCountStatistics[]> => {
    return backendTrackingClient.userCountStatistics(accountId);
};

export const loadViewsData = async (accountId: string): Promise<IAccountViewsStatistics> => {
    return backendTrackingClient.accountViewsStatistics(accountId);
};


export const APIReadSessionsCsv = (accountId: string): Promise<string> => {
    return backendTrackingClient.readSessionsCsv(accountId);
};

export const APIDocInfosCsv = (accountId: string): Promise<string> => {
    return backendExportClient.docInfosCsv(accountId);
}
