import {
    DocumentEditor,
    IAccountViewsStatistics,
    IDashboardDocument,
    IDocumentCreationsStatistics,
    IDocumentDeletionsStatistics
} from "@binders/client/lib/clients/trackingservice/v1/contract";
import { UseQueryResult, useQuery } from "@tanstack/react-query";
import { TrackingServiceClient } from "@binders/client/lib/clients/trackingservice/v1/client";
import { config } from "@binders/client/lib/config";
import { getBackendRequestHandler } from "../api";

const serviceName = "@binders/tracking-v1";

const backendTrackingServiceClient = TrackingServiceClient.fromConfig(config, "v1", getBackendRequestHandler());

export const useMostReadDocuments = (accountId: string): UseQueryResult<IDashboardDocument[]> => {
    return useQuery({
        queryFn: async () => backendTrackingServiceClient.mostReadDocuments(accountId, 10),
        queryKey: [serviceName, "mostReadDocuments", accountId],
        staleTime: Infinity,
        enabled: !!accountId,
    });
};

export const useMostEditedDocuments = (accountId: string): UseQueryResult<IDashboardDocument[]> => {
    return useQuery({
        queryFn: async () => backendTrackingServiceClient.mostEditedDocuments(accountId, 10),
        queryKey: [serviceName, "mostEditedDocuments", accountId],
        staleTime: Infinity,
        enabled: !!accountId,
    });
};

export const useMostActiveEditors = (accountId: string): UseQueryResult<DocumentEditor[]> => {
    return useQuery({
        queryFn: async () => backendTrackingServiceClient.mostActiveEditors(accountId, 10),
        queryKey: [serviceName, "mostActiveEditors", accountId],
        staleTime: Infinity,
        enabled: !!accountId,
    });
};

export const useDocumentCreationsStatistics = (accountId: string): UseQueryResult<IDocumentCreationsStatistics[]> => {
    return useQuery({
        queryFn: async () => backendTrackingServiceClient.documentCreationsStatistics(accountId),
        queryKey: [serviceName, "documentCreationsStatistics", accountId],
        staleTime: Infinity,
        enabled: !!accountId,
    });
};

export const useDocumentDeletionsStatistics = (accountId: string): UseQueryResult<IDocumentDeletionsStatistics[]> => {
    return useQuery({
        queryFn: async () => backendTrackingServiceClient.documentDeletionsStatistics(accountId),
        queryKey: [serviceName, "documentDeletionsStatistics", accountId],
        staleTime: Infinity,
        enabled: !!accountId,
    });
};

export const useAccountViewsStatistics = (accountId: string): UseQueryResult<IAccountViewsStatistics> => {
    return useQuery({
        queryFn: async () => backendTrackingServiceClient.accountViewsStatistics(accountId),
        queryKey: [serviceName, "accountViewsStatistics", accountId],
        staleTime: Infinity,
        enabled: !!accountId,
    });
};