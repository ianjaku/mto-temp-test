import {
    IValidationEnv,
    strict,
    typeHost,
    typeStrictStruct
} from "../types";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const t = require("tcomb");

const instance = t.struct({
    host: typeHost,
    port: t.Number,
}, strict);

const instances = t.list(instance);

const cluster = t.struct({
    instances,
    replicaSet: t.String,
}, strict);

const clusterDev = t.struct({
    instances,
}, strict);

const clusters = t.struct({
    main: cluster,
}, strict);

const clustersDev = t.struct({
    main: clusterDev,
});

const mongoCollections = [
    "accountFeatures",
    "accountMemberships",
    "accountMigrationLog",
    "accountSettings",
    "accounts",
    "acls",
    "activeSessions",
    "adgroupmapping",
    "adidentitymapping",
    "aggregations",
    "alerts",
    "apitokens",
    "auditLog",
    "authtokens",
    "azuremapping",
    "bindercomments",
    "certificates",
    "checklistconfigs",
    "checklists",
    "chunkApprovals",
    "commentthreads",
    "credentials",
    "deviceTargetUserLinks",
    "domainfilters",
    "eventRepoMapping",
    "images",
    "ipwhitelists",
    "lastAccountEventMapping",
    "lastAccountUserActionsMapping",
    "licensing",
    "llmFiles",
    "mostUsedLanguagesStats",
    "msAccountSetupRequests",
    "msTransactableEvents",
    "msTransactableSubscriptions",
    "mtCustomers",
    "notificationtargets",
    "notificationtemplates",
    "operationlogs",
    "readerbranding",
    "readerfeedbackconfigs",
    "readerfeedbacks",
    "roles",
    "scheduledevents",
    "scriptRunStats",
    "semanticlink",
    "sentnotifications",
    "sessions",
    "termsAcceptance",
    "tokens",
    "tracking",
    "ttsmetas",
    "userImportActions",
    "userPreferences",
    "userTags",
    "userTokenImpersonatedUsers",
    "usergroups",
    "users",
    "videoIndexer",
    "visualProcessingJobs",
    "whitelistedEmails",
    "feedbackAttachments",
    "binderstatusescache",
];

const collection = t.struct({
    cluster: t.String,
    collection: t.String,
    database: t.String,
    service_users: t.list(t.String),
}, strict);

const collectionDev = t.struct({
    cluster: t.String,
    collection: t.String,
    database: t.String,
}, strict);

const environmentClusters = {
    local: clustersDev,
    production: clusters,
    staging: clustersDev,
};

const environmentCollections = {
    local: typeStrictStruct(mongoCollections, collectionDev),
    production: typeStrictStruct(mongoCollections, collection),
    staging: typeStrictStruct(mongoCollections, collection),
};

const environmentCredentials = {
    local: t.Nil,
    staging: t.Object,
    production: t.Object,
}

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export default (env: IValidationEnv) => t.struct({
    clusters: environmentClusters[env],
    collections: environmentCollections[env],
    credentials: environmentCredentials[env],
}, strict);
