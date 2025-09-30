import { Metric, Mode } from "./contract";

export const ACTIVE_METRICS: Metric[] = [
    "DOCUMENTS_CREATED",
    "DOCUMENTS_READ",
    "LOGINS",
    "MEMBER_COUNT",
    "ITEMS_EDITED"
];

export const YEAR_RANGE = { from: 2018, until: null };
export const ALLOWED_MODES: Mode[] = ["account", "customer"];
export const DEFAULT_MODE: Mode = "account";
