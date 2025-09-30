import { TrackingServiceContract } from "@binders/client/lib/clients/trackingservice/v1/contract";

export type Metric =
    "MEMBER_COUNT" |
    "LOGINS" |
    "DOCUMENTS_CREATED" |
    "DOCUMENTS_READ" |
    "DOCUMENTS_READ_EXCL_AUTHORS" |
    "ITEMS_EDITED";
export type MetricServices = { trackingService: TrackingServiceContract };
export type MonthlyStats = { [yearDashMonth: string]: number };
export type MetricHandler = (accountId: string, services: MetricServices) => Promise<MonthlyStats>;
export type MergeMethod = "ADD" | "HIGHEST";
export type MetricMap = { [metricName: string]: number[] };
export type Mode = "account" | "customer";