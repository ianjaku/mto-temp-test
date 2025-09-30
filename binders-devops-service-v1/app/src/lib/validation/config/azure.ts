import {
    IValidationEnv,
    typeDomain,
    typeEndpoint,
    typeStrictStruct,
    typeUUID
} from "../types";
// eslint-disable-next-line @typescript-eslint/no-var-requires
const t = require("tcomb");

const azureBlobs = [
    "audio",
    "avatars",
    "elasticbackups",
    "export",
    "feedback",
    "fonts",
    "images",
    "llm",
    "logos",
    "mongobackups",
    "videos",
    "videos-v2",
];

const blob = t.struct({
    accessKey: t.String,
    account: t.String,
    container: t.maybe(t.String),
}, { strict: true });


const functions = t.struct({
    screenshots: t.String,
});

const videoIndexer = t.struct({
    apiRoot: t.String,
    accountId: t.String,
    accountName: t.String,
    resourceGroup: t.String,
    productAuthorizationSubscriptionPrimaryKey: t.String,
})

const devops = t.struct({
    login: t.String,
    password: t.String,
}, { strict: true });

const subscription = t.struct({
    id: typeUUID,
    tenantId: typeUUID,
}, { strict: true });

const translator = t.struct({
    host: typeDomain,
    path: typeEndpoint,
    subscriptionKey: t.String,
}, { strict: true });

const environmentBlobs = {
    local: typeStrictStruct(azureBlobs, blob),
    production: typeStrictStruct(azureBlobs, blob),
    staging: typeStrictStruct(azureBlobs, blob),
};

const cognitiveServices = t.struct({
    speechServiceAccessKey: t.String,
})

const openAi = t.struct({
    apiKey: t.String,
    endpoint: t.String,
})


// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
const azure = (env: IValidationEnv) => t.struct({
    blobs: environmentBlobs[env],
    videoIndexer,
    functions,
    audioCdnEndpoint: typeDomain,
    visualsCdnEndpoint: typeDomain,
    videosCdnEndpoint: typeDomain,
    servicePrincipal: t.struct({ devops }),
    subscription,
    translator,
    cognitiveServices,
    locationCode: t.String,
    openAi,
}, { strict: true });

export default azure;
