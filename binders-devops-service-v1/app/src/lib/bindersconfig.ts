import { ELASTIC_BACKUP_CONTAINER, ELASTIC_POD_NAME_PREFIX } from "./eck";
import { MONGO_RELEASE_NAME, MONGO_REPLICASET_NAME } from "../actions/helm/config";
import {
    PREPROD_NAMESPACE,
    PRODUCTION_NAMESPACE,
    buildStagingEnvironmentLocation
} from "./bindersenvironment";
import { createSecret, deleteSecret, listSecrets } from "../actions/k8s/secrets";
import { getElasticConfig, getHelmElasticReleaseName } from "../actions/elastic/config";
import { loadDevLaunchDarklyConfig, loadSecrets } from "./secrets";
import { BINDERS_SERVICE_SPECS } from "../config/services";
import { assocPath } from "ramda";
import { getMongoCredentials } from "../actions/bindersenv/secrets";
import { getSentinels } from "../actions/redis/create";
import { loadFile } from "./fs";
import { toNodePort } from "./devenvironment";

export const PRODUCTION_CONFIG = "/etc/binders/production.json";

export interface ITranslationEngine {
    host: string;
    subscriptionKey: string;
}

export interface ITranslatorConfig {
    azure: ITranslationEngine;
    google: ITranslationEngine;
    deepl: ITranslationEngine,
}

export interface AzureBlobStoreConfig {
    accessKey: string;
    account: string;
    container?: string;
}

export interface AzureOpenAiConfig {
    apiKey: string;
    endpoint: string;
}

export interface VideoIndexerConfig {
    apiRoot: string;
    accountId: string;
    accountName: string
    resourceGroup: string;
    productAuthorizationSubscriptionPrimaryKey: string
}

export interface AzureFunctionConfig {
    screenshots: string;
}

export interface KeyVaultData {
    keyVaultUri: string,
    secretName: string,
    devopsSecretName: string
}

export interface CdnEndpoints {
    attachment: string
    audio: string
    images: string;
    videos: string;
}

export interface CognitiveServices {
    speechServiceAccessKey: string
}

export interface AzureInfraResources {
    blobs: {
        [name: string]: AzureBlobStoreConfig
    };
    cognitiveServices: CognitiveServices
    cdnEndpoints: CdnEndpoints;
    functions: AzureFunctionConfig;
    secrets: KeyVaultData;
}

export interface AzureBindersConfig {
    blobs: {
        [name: string]: AzureBlobStoreConfig
    };
    audioCdnEndpoint?: string;
    visualsCdnEndpoint: string;
    videosCdnEndpoint: string;
    cognitiveServices?: CognitiveServices;
    servicePrincipal: {
        [name: string]: {
            login: string;
            password: string;
        }
    };
    subscription: {
        id: string;
        tenantId: string;
    };
    functions: AzureFunctionConfig;
    locationCode: string
    videoIndexer: VideoIndexerConfig;
    translator: ITranslationEngine;
    openAi: AzureOpenAiConfig;
}

export interface ElasticClusterConfig {
    apiVersion: string;
    hosts?: string[];
    host?: string;
    httpAuth?: string;
}

export interface ElasticBindersConfig {
    clusters: {
        [name: string]: ElasticClusterConfig;
    };
}

export interface GlusterBindersConfig {
    volumes: {
        [name: string]: {
            mountDir: string
        }
    };
}

export interface LoggingBindersConfig {
    default: {
        level: "TRACE" | "DEBUG" | "INFO";
    };
}

export interface MailgunBindersConfig {
    apiKey: string;
    domain: string;
}

export interface MongoClusterConfig {
    instances: Array<{ host: string, port: number }>;
    replicaSet?: string;
}

export interface MongoCollectionConfig {
    cluster: string;
    collection: string;
    database: string;
    service_users?: string[];
}

export interface MongoBindersConfig {
    clusters: {
        main: MongoClusterConfig
    };
    collections: {
        [name: string]: MongoCollectionConfig
    };
    credentials?: {
        [user: string]: string;
    };
}

export interface RabbitBindersConfig {
    [clusterName: string]: {
        host: string;
        port: number;
        login: string;
        password: string;
    };
}

export interface RedisBindersConfig {
    [name: string]: {
        useSentinel: boolean;
        host: string;
        port: number;
    };
}

export interface S3BindersConfig {
    [name: string]: {
        accessKey: string;
        bucket: string;
        maxRetries: number;
        transcoderRegion: string;
        region: string;
        secret: string;
    };
}

export interface BackendBindersConfig {
    jwt: {
        secret: string;
    };
    api: {
        secret: string;
    }
}

export interface ServicesBindersConfig {
    [name: string]: {
        location: string;
        externalLocation: string;
        prefix: string;
    };
}

export interface SessionBindersConfig {
    maxAge: number;
    secret: string;
    cookieDomain: string;
    store: {
        server: {
            useSentinel: boolean;
            host: string;
            port: number;
        },
        type: "redis"
    };
}

export interface VideoBindersConfig {
    transcoding: {
        pipelineId: string;
        presetIds: {
            [key: string]: string;
        }
    };
}

export interface ProductionClusterBackupConfig {
    repositoryName: string;
    repositoryType: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    repositoryOptions: Record<string, any>;
}

export interface ProductionBackupConfig {
    elastic: {
        [clusterName: string]: ProductionClusterBackupConfig;
    };
    mongo?: {
        credentials: {
            login: string;
            password: string;
        }
    };
}

export interface IntercomConfig {
    appId: string;
    secretKey: string;
}

export interface HubspotConfig {
    apiToken: string;
    portalId: string;
}

export interface ProxyDomainConfig {
    protocol: string;
    readerDomain: string;
    readerPath: string;
    apiPath: string;
}

export interface ProxyConfig {
    [domain: string]: ProxyDomainConfig;
}

export interface DevopsConfig {
    user: {
        login: string,
        password: string
    },
    bitbucket: {
        accessToken: string;
    }
}

export interface SlackConfig {
    webhooks: {
        techtalk: string;
    }
}

export interface BindersConfig {
    azure: AzureBindersConfig;
    bitmovin: BitmovinConfig;
    devops: DevopsConfig
    elasticsearch: ElasticBindersConfig;
    gluster: GlusterBindersConfig;
    helm: HelmConfig;
    intercom: IntercomConfig;
    hubspot: HubspotConfig;
    launchDarkly: LaunchDarklyConfig;
    logging: LoggingBindersConfig;
    mailgun: MailgunBindersConfig;
    mongo: MongoBindersConfig;
    msTransactableOffers: TransactableOffersConfig;
    proxy: ProxyConfig;
    posthog: PosthogConfig
    rabbit: RabbitBindersConfig;
    redis: RedisBindersConfig;
    s3: S3BindersConfig;
    serviceconfig: BackendBindersConfig;
    services: ServicesBindersConfig;
    session: SessionBindersConfig;
    slack: SlackConfig;
    video: VideoBindersConfig;
    backup: ProductionBackupConfig;
    translator: ITranslatorConfig;
    pipedrive: IPipedriveConfig;
    akita: AkitaConfig;
    contentSecurityPolicy: ContentSecurityPolicy;
    tally: TallyConfig;
    ag5: AG5Config;
    gemini: GeminiConfig
}

export type EnvironmentKind = "development" | "staging" | "production";

export interface BindersEnvironment {
    locations: {
        [name: string]: string
    };
    externalLocations: {
        [name: string]: string
    };
    kind: EnvironmentKind;
    elastic: {
        binders: ElasticClusterConfig,
        logevents: ElasticClusterConfig,
        useractions: ElasticClusterConfig
    };
    gluster?: {
        imageUploads: string;
    };
    mongo: MongoClusterConfig;
    rabbit: {
        host: string;
        port: number;
    };
    redis: {
        useSentinel: boolean;
        host: string;
        port: number;
        sentinels?: { host: string; port: number }[]
    };
}

export interface S3BucketConfig {
    accessKey: string;
    bucket: string;
    region: string;
    secret: string;
    transcoderRegion?: string;
}

export interface HelmConfig {
    tls: {
        ca: {
            key: string;
            cert: string;
        }
    };
}

interface AkitaConfig {
    apiKey: string; // Only available on prod
}

interface GeminiConfig {
    apiKey: string;
}

interface PosthogConfig {
    publicKey: string
}

interface AG5Config {
    baseUrl: string;
    apiKey: string;
}

export interface ContentSecurityPolicyDirectives {
    childSrc: string[];
    connectSrc: string[];
    defaultSrc: string[];
    fontSrc: string[];
    formAction: string[]
    frameAncestors: string[];
    frameSrc: string[];
    imgSrc: string[];
    manifestSrc: string[];
    mediaSrc: string[];
    reportUri: string[];
    scriptSrc: string[];
    styleSrc: string[];
    workerSrc: string[];
}

export type ContentSecurityPolicy = false | {
    directives: Partial<ContentSecurityPolicyDirectives>;
    reportOnly?: boolean;
};

interface BitmovinConfig {
    apiKey: string;
    analyticsKey?: string;
}

interface TransactableOffersBaseConfig {
    azureSSOAppID: string;
    azureSSORedirectURI: string;
    azureSSOAuthority: string;
}
interface TransactableOffersLiveConfig extends TransactableOffersBaseConfig {
    appId: string;
    appSecret: string;
    tenantId: string;
    notificationEmailAddress: string;
}
interface TransactableOffersStubConfig extends TransactableOffersBaseConfig {
    useStub: boolean;
}

type TransactableOffersConfig = TransactableOffersStubConfig | TransactableOffersLiveConfig;

export interface IPipedriveConfig {
    host: string;
    customerFilterId: number;
    apiKey: string;
}

export interface IPipedriveSecretsConfig {
    apiKey: string;
}

export interface LaunchDarklyConfig {
    clientSideId: string;
    sdkKey: string;
}

type TallyConfig = {
    plgSignupWebhookSignSecret: string;
}

export interface BindersSecrets {
    api: {
        secret: string;
    }
    google: {
        cloudTranslation: {
            apiKey: string;
        }
    }
    azure: {
        blobs: {
            [name: string]: AzureBlobStoreConfig
        },
        cdn?: {
            attachment: string;
            audio: string;
            images: string;
            videos: string;
        },
        cognitiveServices?: CognitiveServices,
        functions: AzureFunctionConfig,
        locationCode: string,
        videoIndexer: VideoIndexerConfig,
        servicePrincipal: {
            [name: string]: {
                login: string;
                password: string;
            }
        },
        subscription: {
            id: string;
            tenantId: string;
        }
        translator: {
            subscriptionKey: string;
        },
        openAi: AzureOpenAiConfig;
    };
    deepl: {
        cloudTranslation: {
            apiKey: string;
        }
    };
    backend: {
        jwt: string;
    };
    bitmovin: BitmovinConfig,
    certManager: {
        awsAccessKey: string,
        awsSecretKey: string
    }
    devops: {
        user: {
            login: string,
            password: string
        },
        bitbucket: {
            accessToken: string;
        }
    }
    helm: HelmConfig;
    intercom: IntercomConfig;
    hubspot: HubspotConfig;
    launchDarkly: LaunchDarklyConfig,
    mailgun: {
        apiKey: string;
    };
    mongo?: {
        credentials: {
            [user: string]: string
        }
    };
    msTransactableOffers: TransactableOffersConfig,
    rabbit?: {
        login: string;
        password: string;
    };
    s3: {
        backups?: S3BucketConfig;
        videos: S3BucketConfig;
    };
    servicePrincipal: {
        clientId: string,
        secretKey: string
    },
    session: {
        secret: string;
    };
    slack: SlackConfig;
    pipedrive: IPipedriveSecretsConfig,
    akita?: AkitaConfig;
    tally: TallyConfig;
    posthog: PosthogConfig;
    ag5: AG5Config;
    gemini: GeminiConfig
}

const isProduction = (environment: BindersEnvironment) => environment.kind === "production";

const buildAzureConfig = (environment: BindersEnvironment, secrets: BindersSecrets): AzureBindersConfig => {
    const {
        blobs,
        videoIndexer,
        servicePrincipal,
        subscription,
        translator,
        functions,
        cognitiveServices,
        locationCode,
        openAi,
    } = secrets.azure;
    const translatorConfig = {
        host: "api.cognitive.microsofttranslator.com",
        path: "/translate?api-version=3.0",
        subscriptionKey: translator.subscriptionKey
    }
    return {
        blobs,
        functions,
        videoIndexer,
        cognitiveServices,
        locationCode,
        audioCdnEndpoint: (secrets.azure.cdn && secrets.azure.cdn.audio) || "binder-prod-audio-cdn.azureedge.net",
        visualsCdnEndpoint: (secrets.azure.cdn && secrets.azure.cdn.images) || "binder-prod-images-cdn.azureedge.net",
        videosCdnEndpoint: (secrets.azure.cdn && secrets.azure.cdn.videos) || "bindersmedia-videos.azureedge.net",
        servicePrincipal,
        subscription,
        translator: translatorConfig,
        openAi,
    };
};

const buildElasticConfig = (environment: BindersEnvironment): ElasticBindersConfig => {
    const { binders, logevents, useractions } = environment.elastic;
    return {
        clusters: {
            binders,
            logevents,
            useractions
        }
    };
};

const buildGlusterConfig = (environment: BindersEnvironment): GlusterBindersConfig => {
    if (!environment.gluster) {
        return undefined;
    }
    return {
        volumes: {
            imageUploads: {
                mountDir: environment.gluster.imageUploads
            }
        }
    };
};

const buildLoggingConfig = (): LoggingBindersConfig => {
    return {
        default: {
            level: "TRACE"
        }
    };
};

const buildMailgunConfig = (environment: BindersEnvironment, secrets: BindersSecrets): MailgunBindersConfig => {
    return {
        apiKey: secrets.mailgun.apiKey,
        domain: isProduction(environment) ? "mail.manual.to" : "sandboxf48203872e274cf6bfa01a59568400e9.mailgun.org",
    };
};

export const COLLECTIONS_PER_SERVICE: { [serviceName: string]: { [codeName: string]: string } } = {
    account_service: {
        accountFeatures: "accountFeatures",
        accountMemberships: "accountMemberships",
        accountMigrationLog: "accountMigrationLog",
        accountSettings: "accountSettings",
        accounts: "accounts",
        licensing: "licensing",
        msAccountSetupRequests: "msAccountSetupRequests",
        msTransactableEvents: "msTransactableEvents",
        msTransactableSubscriptions: "msTransactableSubscriptions",
        mtCustomers: "mtCustomers",
    },
    authorization_service: {
        acls: "acls",
        roles: "roles"
    },
    credential_service: {
        activeSessions: "activeSessions",
        adgroupmapping: "adgroupmapping",
        adidentitymapping: "adidentitymapping",
        authtokens: "authtokens",
        azuremapping: "azuremapping",
        certificates: "certificates",
        credentials: "user_credentials",
        sessions: "sessions",
        tokens: "tokens",
        userTokenImpersonatedUsers: "userTokenImpersonatedUsers"
    },
    image_service: {
        images: "images",
        videoIndexer: "videoIndexer",
        visualProcessingJobs: "visualProcessingJobs",
        feedbackAttachments: "feedbackAttachments",
    },
    notification_service: {
        alerts: "alerts",
        notificationtargets: "notification_targets",
        notificationtemplates: "notification_templates",
        scheduledevents: "scheduled_events",
        sentnotifications: "sent_notifications",
    },
    public_api: {
        apitokens: "api_tokens"
    },
    repository_service: {
        bindercomments: "binder_comments",
        checklistconfigs: "checklist_configs",
        checklists: "checklists",
        chunkApprovals: "chunk_approvals",
        commentthreads: "comment_threads",
        llmFiles: "llm_files",
        operationlogs: "operation_logs",
        readerfeedbackconfigs: "reader_feedback_configs",
        readerfeedbacks: "reader_feedbacks",
        ttsmetas: "tts_metas",
        binderstatusescache: "binder_statuses_cache",
    },
    routing_service: {
        domainfilters: "domain_filters",
        ipwhitelists: "ipwhitelists",
        readerbranding: "reader_branding",
        semanticlink: "semanticlink",
    },
    tracking_service: {
        aggregations: "aggregations",
        auditLog: "auditLog",
        eventRepoMapping: "event_repo_mapping",
        lastAccountEventMapping: "lastAccountEventMapping",
        lastAccountUserActionsMapping: "lastAccountUserActionsMapping",
        mostUsedLanguagesStats: "mostUsedLanguagesStats",
        tracking: "events",
    },
    user_service: {
        deviceTargetUserLinks: "device_targetuser_links",
        scriptRunStats: "scriptrun_stats",
        termsAcceptance: "terms_acceptance",
        userImportActions: "user_import_actions",
        userPreferences: "user_preferences",
        userTags: "user_tags",
        usergroups: "usergroups",
        users: "users",
        whitelistedEmails: "whitelisted_emails",
    },
};

const buildMongoConfig = (environment: BindersEnvironment, secrets: BindersSecrets): MongoBindersConfig => {
    const collections = COLLECTIONS_PER_SERVICE;
    const collectionConfigs: { [key: string]: MongoCollectionConfig } = {};
    Object.keys(collections).forEach(service => {
        const serviceCollections = collections[service];
        Object.keys(serviceCollections).forEach(codeName => {
            const mongoName = serviceCollections[codeName];
            collectionConfigs[codeName] = {
                cluster: "main",
                collection: mongoName,
                database: service,
            };
            collectionConfigs[codeName].service_users = [service];
        });
    });
    const config: MongoBindersConfig = {
        clusters: {
            main: environment.mongo
        },
        collections: collectionConfigs
    };
    if (secrets.mongo) {
        config.credentials = secrets.mongo.credentials;
    }
    return config;
};


export const getAllMongoUsers = (): string[] => Object.keys(COLLECTIONS_PER_SERVICE);

const buildRabbitConfig = (environment: BindersEnvironment, secrets: BindersSecrets): RabbitBindersConfig => {
    return {
        imageService: {
            ...environment.rabbit,
            ...secrets.rabbit
        }
    };
};
export const REDIS_DATABASES = [
    "accountsPermissions",
    "accountsettings",
    "css",
    "documents",
    "mostUsedLanguages",
    "mtlanguages",
    "pubsub",
    "rateLimiter",
    "requestBlockers",
    "sessions",
    "persistent-cache"
];

export const REDIS_DEV_DATABASES = [
    "test"
];

const buildRedisConfig = (environment: BindersEnvironment): RedisBindersConfig => {
    const databases = REDIS_DATABASES
    if (environment.kind === "development") {
        databases.push(...REDIS_DEV_DATABASES);
    }
    const config: RedisBindersConfig = {};
    databases.forEach(db => {
        config[db] = {
            ...environment.redis
        };
    });
    return config;
};

const buildS3Config = (environment: BindersEnvironment, secrets: BindersSecrets): S3BindersConfig => {
    return {
        videos: {
            ...secrets.s3.videos,
            transcoderRegion: "eu-west-1",
            maxRetries: 5,
        }
    };
};

const buildServiceConfig = (environment: BindersEnvironment, secrets: BindersSecrets): BackendBindersConfig => {
    return {
        jwt: {
            secret: secrets.backend.jwt
        },
        api: {
            secret: secrets.api.secret
        }
    };
};

const buildServicesConfig = (environment: BindersEnvironment): ServicesBindersConfig => {
    const services = BINDERS_SERVICE_SPECS;
    const config: ServicesBindersConfig = {};
    const protocol = environment.kind === "development" ? "http" : "https";
    services.forEach(service => {
        const versionedService = `${service.name}-${service.version}`;
        const location = environment.locations[versionedService] ||
            environment.locations[service.name] ||
            environment.locations.api;
        const externalLocation = environment.externalLocations[versionedService] ||
            environment.externalLocations[service.name] ||
            environment.externalLocations.api;
        config[service.name] = {
            prefix: `/${service.name}`,
            location: `http://${location}`,
            externalLocation: `${protocol}://${externalLocation}`,
        };
    });
    return config;
};

const buildSessionConfig = (environment: BindersEnvironment, secrets: BindersSecrets): SessionBindersConfig => {
    let cookieDomain;
    if (environment.kind === "staging") {
        cookieDomain = "staging.binders.media";
    } else if (environment.kind === "production") {
        cookieDomain = "manual.to";
    }
    return {
        ...secrets.session,
        maxAge: 1000 * 3600 * 24 * 8,
        store: {
            server: {
                ...environment.redis
            },
            type: "redis"
        },
        cookieDomain: cookieDomain
    };
};

const buildVideoConfig = (): VideoBindersConfig => {
    return {
        "transcoding": {
            "pipelineId": "1484641431520-fbluep",
            "presetIds": {
                "1487064576053-mdl3ca": "VIDEO_IPHONE",
                "1487175780278-v23uba": "VIDEO_WEB_DEFAULT",
                "1513767687431-7t9hr6": "VIDEO_IPHONE_HD",
                "1513775848126-cgde7j": "VIDEO_DEFAULT_LD",
                "1513775920124-m8lqoe": "VIDEO_DEFAULT_SD",
                "1513775971818-svrs1n": "VIDEO_IPHONE_SD",
                "1513776022903-li793a": "VIDEO_DEFAULT_HD"
            }
        }
    };
};

const buildIntercomConfig = (environment: BindersEnvironment, secrets: BindersSecrets): IntercomConfig => {
    return secrets.intercom;
};

const ALPLA_FRONTENDS = [
    "plant.mission-j.com",
    "plantdev.mission-j.com",
    "plantstaging.mission-j.com",
    "control.mission-j.com",
    "controldev.mission-j.com",
    "controlstaging.mission-j.com",
    "alpla.crate-iot-staging.com",
    "plant-alpla.crate-iot-staging.com",
    "alpla.digital-friend.app",
    "plant-alpla.digital-friend.app",
    "alpla.dev.digital-friend.app",
    "plant-alpla.dev.digital-friend.app",
    "alpla.staging.digital-friend.app",
    "plant-alpla.staging.digital-friend.app",
];
const DEFAULT_PROXY_CONFIG = {
    readerDomain: "alpla.manual.to",
    readerPath: "/manual/reader",
    apiPath: "/manual/api",
    protocol: "https",
};

const ALPLA_PROXY_CONFIG = DEFAULT_PROXY_CONFIG;

export const buildProxyConfig = (): ProxyConfig => {
    const devAndStagingConfig: ProxyConfig = {
        "localhost:9998": {
            ...DEFAULT_PROXY_CONFIG,
            readerDomain: "localhost",
            protocol: "http",
        },
        "proxy.dev.binders.media": {
            ...DEFAULT_PROXY_CONFIG,
            readerDomain: "azure-test.manual.to"
        }
    };
    const alplaProxies: ProxyConfig = ALPLA_FRONTENDS.reduce(
        (reduced, alplaFrontend) => ({
            ...reduced,
            [alplaFrontend]: ALPLA_PROXY_CONFIG
        }), {}
    );

    return {
        ...alplaProxies,
        ...devAndStagingConfig
    };
};

const buildDevopsConfig = (environment: BindersEnvironment, secrets: BindersSecrets) => {
    return secrets.devops
}

const buildMSTransactableOffersConfig = (environment: BindersEnvironment, secrets: BindersSecrets) => {
    return secrets.msTransactableOffers;
}

function buildTranslatorConfig(environment: BindersEnvironment, secrets: BindersSecrets): ITranslatorConfig {
    const {
        azure: { translator },
        google: { cloudTranslation: googleCloudTranslation },
        deepl: { cloudTranslation: deeplCloudTranslation },
    } = secrets;
    return {
        azure: {
            host: "api.cognitive.microsofttranslator.com",
            subscriptionKey: translator.subscriptionKey,
        },
        google: {
            host: "translation.googleapis.com/language/translate/v2",
            subscriptionKey: googleCloudTranslation.apiKey,
        },
        deepl: {
            host: "api.deepl.com/v2",
            subscriptionKey: deeplCloudTranslation.apiKey,
        }
    }
}

function buildPipeDriveConfig(secrets: BindersSecrets) {
    return {
        host: "api.pipedrive.com",
        customerFilterId: 84,
        apiKey: secrets.pipedrive.apiKey,
    }
}

function buildCspDirectives(environment: BindersEnvironment, azure: AzureBindersConfig, prodAzure: AzureBindersConfig): Partial<ContentSecurityPolicyDirectives> {
    const apisUri = ensureProperUriFormat(environment.externalLocations.api ?? "");
    const readerDomains = "https://*.manual.to";
    const websocketApisUri = apisUri.replace("https://", "wss://");
    const binderVideoBlobs = [
        ...(prodAzure ? [`https://${prodAzure.blobs["videos-v2"].account}.blob.core.windows.net`] : []),
        `https://${azure.blobs["videos-v2"].account}.blob.core.windows.net`,
    ];
    const awsEndpoints = [
        "https://binders.s3.amazonaws.com",
        "https://s3.eu-central-1.amazonaws.com/binders",
        "https://s3-eu-west-1.amazonaws.com/manualto-images",
    ];
    const imgCdnEndpoints = [
        ensureProperUriFormat(azure.videosCdnEndpoint),
        ensureProperUriFormat(azure.visualsCdnEndpoint),
        ...(
            prodAzure ?
                [
                    ensureProperUriFormat(prodAzure.videosCdnEndpoint),
                    ensureProperUriFormat(prodAzure.visualsCdnEndpoint),
                ] :
                []
        ),
    ];
    const mediaCdnEndpoints = [
        ensureProperUriFormat(azure.videosCdnEndpoint),
        ensureProperUriFormat(azure.audioCdnEndpoint),
        ...(
            prodAzure ?
                [
                    ensureProperUriFormat(prodAzure.videosCdnEndpoint),
                    ensureProperUriFormat(prodAzure.audioCdnEndpoint),
                ] :
                []
        ),
    ];
    return {
        defaultSrc: ["'self'"],
        childSrc: [
            "'self'",
            "https://intercom-sheets.com",  // Intercom
            "https://www.intercom-reporting.com",  // Intercom
            "https://www.youtube.com",  // Intercom
            "https://player.vimeo.com",  // Intercom
            "https://fast.wistia.net",  // Intercom
        ],
        connectSrc: [
            "'self'",
            apisUri,
            readerDomains,
            websocketApisUri,
            ...binderVideoBlobs,
            "https://*.google-analytics.com",
            "https://www.googletagmanager.com",
            "https://fonts.googleapis.com", // Fonts APIs used in manage app
            "https://analytics-ingress-global.bitmovin.com",
            "https://eu.i.posthog.com",  // Posthog
            "https://eu-assets.i.posthog.com",  // Posthog
            "https://internal-t.posthog.com",  // Posthog
            "https://*.hubspot.com",  // Hubspot
            "https://*.hubapi.com",  // Hubspot
            "https://via.intercom.io",  // Intercom
            "https://api.intercom.io",  // Intercom
            "https://api.au.intercom.io",  // Intercom
            "https://api.eu.intercom.io",  // Intercom
            "https://api-iam.intercom.io",  // Intercom
            "https://api-iam.eu.intercom.io",  // Intercom
            "https://api-iam.au.intercom.io",  // Intercom
            "https://api-ping.intercom.io",  // Intercom
            "https://nexus-websocket-a.intercom.io",  // Intercom
            "wss://nexus-websocket-a.intercom.io",  // Intercom
            "https://nexus-websocket-b.intercom.io",  // Intercom
            "wss://nexus-websocket-b.intercom.io",  // Intercom
            "https://nexus-europe-websocket.intercom.io",  // Intercom
            "wss://nexus-europe-websocket.intercom.io",  // Intercom
            "https://nexus-australia-websocket.intercom.io",  // Intercom
            "wss://nexus-australia-websocket.intercom.io",  // Intercom
            "https://uploads.intercomcdn.com",  // Intercom
            "https://uploads.intercomcdn.eu",  // Intercom
            "https://uploads.au.intercomcdn.com",  // Intercom
            "https://uploads.eu.intercomcdn.com",  // Intercom
            "https://uploads.intercomusercontent.com",  // Intercom
        ],
        fontSrc: [
            "'self'",
            "data:",  // Required in the reader to load fonts
            apisUri,
            "https://fonts.googleapis.com",
            "https://fonts.gstatic.com",
            "https://maxcdn.bootstrapcdn.com",
            "https://js.intercomcdn.com",  // Intercom
            "https://fonts.intercomcdn.com",  // Intercom
        ],
        formAction: [
            "'self'",
            "https://intercom.help",  // Intercom
            "https://api-iam.intercom.io",  // Intercom
            "https://api-iam.eu.intercom.io",  // Intercom
            "https://api-iam.au.intercom.io",  // Intercom
        ],
        frameAncestors: [
            "*",  // We can't list all our customers that refer to our platform
        ],
        frameSrc: [
            "https://*.hubspot.com",  // Hubspot
            "https://www.googletagmanager.com",
        ],
        imgSrc: [
            "'self'",
            "blob:",  // Used by 3rd parties (eg. Intercom)
            "data:",  // Used by 3rd parties (eg. Intercom)
            "https://www.googletagmanager.com",
            apisUri,
            ...imgCdnEndpoints,
            ...binderVideoBlobs,
            ...awsEndpoints,
            "https://fonts.gstatic.com",
            "https://*.hubspot.com",  // Hubspot
            "https://js.intercomcdn.com",  // Intercom
            "https://static.intercomassets.com",  // Intercom
            "https://downloads.intercomcdn.com",  // Intercom
            "https://downloads.intercomcdn.eu",  // Intercom
            "https://downloads.au.intercomcdn.com",  // Intercom
            "https://uploads.intercomusercontent.com",  // Intercom
            "https://gifs.intercomcdn.com",  // Intercom
            "https://video-messages.intercomcdn.com",  // Intercom
            "https://messenger-apps.intercom.io",  // Intercom
            "https://messenger-apps.eu.intercom.io",  // Intercom
            "https://messenger-apps.au.intercom.io",  // Intercom
            "https://*.intercom-attachments-1.com",  // Intercom
            "https://*.intercom-attachments.eu",  // Intercom
            "https://*.au.intercom-attachments.com",  // Intercom
            "https://*.intercom-attachments-2.com",  // Intercom
            "https://*.intercom-attachments-3.com",  // Intercom
            "https://*.intercom-attachments-4.com",  // Intercom
            "https://*.intercom-attachments-5.com",  // Intercom
            "https://*.intercom-attachments-6.com",  // Intercom
            "https://*.intercom-attachments-7.com",  // Intercom
            "https://*.intercom-attachments-8.com",  // Intercom
            "https://*.intercom-attachments-9.com",  // Intercom
            "https://static.intercomassets.eu",  // Intercom
            "https://static.au.intercomassets.com",  // Intercom
            "https://us.posthog.com",  // Posthog
        ],
        manifestSrc: [
            "'self'",
        ],
        mediaSrc: [
            "'self'",
            "blob:",  // Required to allow loading some of our data from memory
            apisUri,
            ...mediaCdnEndpoints,
            ...binderVideoBlobs,
            "https://js.intercomcdn.com",  // Intercom
            "https://downloads.intercomcdn.com",  // Intercom
            "https://downloads.intercomcdn.eu",  // Intercom
            "https://downloads.au.intercomcdn.com",  // Intercom
        ],
        scriptSrc: [
            "'self'",
            "'unsafe-inline'",
            "https://*.google-analytics.com",
            "https://www.googletagmanager.com",
            "https://widget.intercom.io",  // Intercom
            "https://app.intercom.io",  // Intercom
            "https://js.intercomcdn.com",  // Intercom
            "https://js-eu1.hs-analytics.net",  // Hubspot
            "https://js-eu1.hs-banner.net",  // Hubspot
            "https://js-eu1.hs-scripts.com",  // Hubspot
            "https://*.usemessages.com",  // Hubspot
            "https://eu.i.posthog.com",  // Posthog
            "https://eu-assets.i.posthog.com", // Posthog
        ],
        styleSrc: [
            "'self'",
            "'unsafe-inline'",
            apisUri,
            "https://fonts.googleapis.com",
            "https://eu.posthog.com/",  // Posthog
            "https://maxcdn.bootstrapcdn.com",  // Font awesome
            "https://www.gstatic.com"
        ],
        workerSrc: [
            "'self'",
            "blob:",  // Used by 3rd parties (eg. Posthog)
            "data:",  // Used by 3rd parties (eg. Posthog)
        ],

        reportUri: [
            apisUri + "/tracking/v1/cspReport"
        ],
    };
}

const ensureProperUriFormat = (uri: string): string => {
    if (!uri) return uri;
    return removeEndingSlashIfPresent(prefixUriWithHttps(uri));
};

const prefixUriWithHttps = (uri: string) => uri.startsWith("https://") ? uri : `https://${uri}`;

const removeEndingSlashIfPresent = (uri: string) => uri.endsWith("/") ? uri.slice(0, -1) : uri;

const buildContentSecurityPolicy = (environment: BindersEnvironment, azure: AzureBindersConfig, prodAzure?: AzureBindersConfig): ContentSecurityPolicy => {
    if (environment.kind === "development") return false;
    return {
        directives: buildCspDirectives(environment, azure, prodAzure),
        reportOnly: true,
    };
};

export const buildBindersConfig = (environment: BindersEnvironment, secrets: BindersSecrets, productionSecrets?: BindersSecrets): BindersConfig => {
    const azure = buildAzureConfig(environment, secrets);
    const prodAzure = productionSecrets ? buildAzureConfig(environment, productionSecrets) : undefined;
    return {
        akita: secrets.akita ? { apiKey: secrets.akita.apiKey } : null,
        azure,
        backup: buildBackupConfig(secrets),
        bitmovin: secrets.bitmovin,
        contentSecurityPolicy: buildContentSecurityPolicy(environment, azure, prodAzure),
        devops: buildDevopsConfig(environment, secrets),
        elasticsearch: buildElasticConfig(environment),
        gluster: buildGlusterConfig(environment),
        helm: secrets.helm,
        hubspot: secrets.hubspot,
        intercom: buildIntercomConfig(environment, secrets),
        launchDarkly: secrets.launchDarkly,
        logging: buildLoggingConfig(),
        mailgun: buildMailgunConfig(environment, secrets),
        mongo: buildMongoConfig(environment, secrets),
        msTransactableOffers: buildMSTransactableOffersConfig(environment, secrets),
        posthog: secrets.posthog,
        pipedrive: buildPipeDriveConfig(secrets),
        proxy: buildProxyConfig(),
        rabbit: buildRabbitConfig(environment, secrets),
        redis: buildRedisConfig(environment),
        s3: buildS3Config(environment, secrets),
        serviceconfig: buildServiceConfig(environment, secrets),
        services: buildServicesConfig(environment),
        session: buildSessionConfig(environment, secrets),
        slack: secrets.slack,
        tally: secrets.tally,
        translator: buildTranslatorConfig(environment, secrets),
        video: buildVideoConfig(),
        ag5: secrets.ag5,
        gemini: secrets.gemini
    };
};


export const getProductionSecretsFile = (): string => (__dirname + "/../../src/config/develop.production.secrets.json");
export const getProductionSecretsEnvVar = (): string => "PRODUCTION_SECRETS";
export const getProductionK8SSecret = (): string => "binders-secrets";

export const createProductionK8SSecretFromFile = async (): Promise<void> => {
    const productionSecretsFile = getProductionSecretsFile();
    const json = await loadFile(productionSecretsFile);
    const b64 = Buffer.from(json).toString("base64");
    const currentSecrets = await listSecrets(PRODUCTION_NAMESPACE);
    const secretName = getProductionK8SSecret();
    const existingSecret = currentSecrets.find(secret => secret.metadata.name === secretName);
    if (existingSecret) {
        await deleteSecret(secretName, PRODUCTION_NAMESPACE);
    }
    await createSecret(
        secretName,
        { [getProductionSecretsEnvVar()]: b64 },
        PRODUCTION_NAMESPACE
    );
};

export const loadDevSecret = async (branchName?: string): Promise<BindersSecrets> => {
    return loadSecrets("dev", branchName)
}

export const loadProductionSecrets = async (branchName?: string): Promise<BindersSecrets> => {
    return loadSecrets("production", branchName)
};

export const loadStagingSecrets = async (branchName?: string): Promise<BindersSecrets> => {
    return loadSecrets("staging", branchName)
};

export const getElasticPodNames = (clusterName: string, clusterSize: number): string[] => {
    const helmReleaseName = getHelmElasticReleaseName(clusterName, "service");
    const toElasticPod = i => `${helmReleaseName}-${i}.${helmReleaseName}-service`;
    const names = [];
    for (let i = 0; i < clusterSize; i++) {
        names.push(toElasticPod(i));
    }
    return names;
};

export const getElasticProductionPodNames = (clusterName: string): string[] => getElasticPodNames(clusterName, 3);



export const getNewClusterPodNames = (clusterSize: number): string[] => {
    const names = [];
    for (let i = 0; i < clusterSize; i++) {
        names.push(`${ELASTIC_POD_NAME_PREFIX}-${i}`);
    }
    return names;

}

export const getElasticProductionConfig = (clusterName: string, apiVersion: string): ElasticClusterConfig => {
    return {
        apiVersion,
        hosts: getElasticProductionPodNames(clusterName).map(h => `http://${h}:9200`)
    };
};

export const getMongoClusterConfig = (releaseName: string, replicaSet: string, nodeNumber = 1): MongoClusterConfig => {
    if (nodeNumber > 1) {
        const toMongoPod = i => `${releaseName}-mongod-${i}.${releaseName}-mongodb-service`;
        return {
            instances: [0, 1, 2].map(index => (
                {
                    host: toMongoPod(index),
                    port: 27017
                }
            )),
            replicaSet
        };
    }

    return {
        instances: [{
            host: `${releaseName}-mongodb-service`,
            port: 27017
        }]
    }
}

const getRabbitConfig = () => (
    {
        host: "rabbit",
        port: 5672
    }
);

const getRedisSentinelConfig = (namespace: string) => ({
    useSentinel: true,
    host: "redis",
    port: 26379,
    sentinels: getSentinels(namespace)
});

const addRabitSecrets = async (secrets) => {
    secrets.rabbit = {
        login: "roger",
        password: "not there yet"
    };
};

export const getESProductionBackupRepository = (): string => "manualto_azure_storage";

export const buildBackupConfig = (secrets: BindersSecrets): ProductionBackupConfig => {
    const config = {
        elastic: {
            bindersAzure: {
                repositoryName: getESProductionBackupRepository(),
                repositoryType: "azure",
                repositoryOptions: {
                    container: ELASTIC_BACKUP_CONTAINER,
                    "compress": true
                }

            }
        }
    };
    if (secrets.mongo) {
        config["mongo"] = {
            credentials: {
                login: "backup-operator",
                password: secrets.mongo.credentials["backup-operator"]
            }
        };
    }
    return config;
};

const addMongoProductionSecrets = async (secrets) => {
    if (!secrets?.mongo?.credentials) {
        const mongoCredentials = await getMongoCredentials(PRODUCTION_NAMESPACE);
        secrets.mongo = {
            credentials: mongoCredentials
        };
    }
};

const buildInternalApiLocations = () => {
    return BINDERS_SERVICE_SPECS
        .filter(spec => !spec.isFrontend)
        .reduce((reduced, spec) => {
            const key = `${spec.name}-${spec.version}`;
            const locationSpec = spec.sharedDeployment ?
                BINDERS_SERVICE_SPECS.find(s => s.name === spec.sharedDeployment) :
                spec;
            const locationKey = `${locationSpec.name}-${locationSpec.version}`;
            const serviceHost = `${locationKey}-service`;
            const servicePort = spec.port;
            const location = `${serviceHost}:${servicePort}`;
            return { ...reduced, [key]: location };
        }, {});
}

export const PARTNERS_DOMAIN = "partners.binders.media";

export const buildBindersProductionConfig = async (clusterName: string, secretName?: string): Promise<BindersConfig> => {
    const secrets = await loadProductionSecrets(secretName);
    await addRabitSecrets(secrets);
    await addMongoProductionSecrets(secrets);
    const mainElasticConfig = await getElasticConfig("production")
    const redis = getRedisSentinelConfig(PRODUCTION_NAMESPACE)
    const api = "api.binders.media"
    const manage = "manage.binders.media"
    const dashboard = "dashboard.binders.media"
    const editor = "editor.manual.to"
    const manualto = "reader.manual.to"
    const partners = PARTNERS_DOMAIN

    const environment: BindersEnvironment = {
        locations: {
            manualto,
            editor,
            manage,
            dashboard,
            partners,
            ...buildInternalApiLocations()
        },
        externalLocations: {
            manualto,
            dashboard,
            editor,
            manage,
            api,
            partners
        },
        kind: "production",
        elastic: {
            binders: mainElasticConfig,
            logevents: getElasticProductionConfig("logevents", "7.1"),
            useractions: mainElasticConfig,
        },
        mongo: getMongoClusterConfig(MONGO_RELEASE_NAME, MONGO_REPLICASET_NAME, 3),
        rabbit: getRabbitConfig(),
        redis
    };
    return buildBindersConfig(environment, secrets);
};


export const buildBindersPreprodConfig = async (secretName?: string): Promise<BindersConfig> => {
    const secrets = await loadProductionSecrets(secretName);
    const stagingSecrets = await loadStagingSecrets(secretName)
    secrets.mongo.credentials = stagingSecrets.mongo.credentials
    await addRabitSecrets(secrets);
    const mainElasticConfig = await getElasticConfig(PREPROD_NAMESPACE)
    const prefix = "preprod"
    const api = `${prefix}api.binders.media`
    const manage = `${prefix}-manage.manual.to`
    const dashboard = `${prefix}-dashboard.binders.media`
    const editor = `${prefix}-editor.manual.to`
    const manualto = "preprod.manual.to"
    const partners = `${prefix}-${PARTNERS_DOMAIN}`

    const environment: BindersEnvironment = {
        locations: {
            manualto,
            editor,
            manage,
            dashboard,
            partners,
            ...buildInternalApiLocations()
        },
        externalLocations: {
            manualto,
            dashboard,
            editor,
            manage,
            api,
            partners
        },
        kind: "production",
        elastic: {
            binders: mainElasticConfig,
            logevents: getElasticProductionConfig("logevents", "7.1"),
            useractions: mainElasticConfig,
        },
        mongo: getMongoClusterConfig(MONGO_RELEASE_NAME, MONGO_REPLICASET_NAME),
        rabbit: getRabbitConfig(),
        redis: {
            useSentinel: false,
            host: getServiceName(PREPROD_NAMESPACE, "redis"),
            port: 6379
        }
    };
    return buildBindersConfig(environment, secrets);
};

export const getDevEnvironment = async (ip: string, isProxy = false): Promise<BindersEnvironment> => {
    const elasticConfig = await getElasticConfig("develop")
    const logeventsConfig = {
        apiVersion: "5.6",
        host: "elastic:9200"
    }
    const getApiLocations = (external: boolean) => BINDERS_SERVICE_SPECS
        .filter(spec => !spec.isFrontend)
        .reduce((reduced, spec) => {
            const key = `${spec.name}-${spec.version}`;
            const port = spec.sharedDeployment ?
                BINDERS_SERVICE_SPECS.find(s => s.name === spec.sharedDeployment).port :
                spec.port;
            const nodePort = (external || isProxy) ? toNodePort(port) : port;
            const location = external ?
                `${ip}:${nodePort}` :
                `localhost:${port}`;
            return { ...reduced, [key]: location };
        }, {});

    return {
        locations: {
            manualto: "localhost:8014",
            editor: "localhost:8006",
            manage: "localhost:8008",
            dashboard: "localhost:8015",
            partners: "localhost:8019",
            ...getApiLocations(false)
        },
        externalLocations: {
            manualto: `${ip}:30014`,
            editor: `${ip}:30006`,
            manage: `${ip}:30008`,
            dashboard: `${ip}:30015`,
            partners: `${ip}:30019`,
            ...getApiLocations(true)
        },
        kind: "development",
        elastic: {
            binders: elasticConfig,
            logevents: logeventsConfig,
            useractions: elasticConfig
        },
        gluster: {
            imageUploads: "/tmp/uploads"
        },
        mongo: {
            instances: [{
                host: "mongo",
                port: 27017
            }]
        },
        rabbit: {
            host: "rabbit",
            port: 5672
        },
        redis: {
            useSentinel: false,
            host: "redis",
            port: 6379
        }
    };
};

export const buildBindersDevConfig = async (ip: string, isProxy: boolean, branchName: string, shouldLoadProductionSecrets?: boolean): Promise<BindersConfig> => {
    const secretLoader = shouldLoadProductionSecrets ? loadProductionSecrets : loadDevSecret;
    const bindersSecrets = await secretLoader(branchName);
    const patchedSecrets = await patchBindersDevConfig(bindersSecrets, branchName, shouldLoadProductionSecrets);
    const environment = await getDevEnvironment(ip, isProxy);
    return buildBindersConfig(environment, patchedSecrets);
};

const patchBindersDevConfig = async (secrets: BindersSecrets, branchName: string, isUsingProductionSecrets: boolean): Promise<BindersSecrets> => {
    secrets.launchDarkly = await loadDevLaunchDarklyConfig("dev");

    if (!isUsingProductionSecrets) return secrets;
    const devSecrets = await loadDevSecret(branchName);
    if (secrets.bitmovin.analyticsKey) {
        secrets.bitmovin.analyticsKey = devSecrets.bitmovin.analyticsKey;
    }
    return secrets;
};

const getServiceName = (namespace: string, service: string) => `${namespace}-${service}-service`;
export const buildBindersStagingConfig = async (namespace: string, branch: string, mergeWithProdSecrets = false): Promise<BindersConfig> => {
    const elasticConfig = await getElasticConfig(namespace)
    const secrets = await loadStagingSecrets(branch);
    const logeventsElasticConfig: ElasticClusterConfig = {
        apiVersion: "5.6",
        host: `${getServiceName(namespace, "elastic")}:9200`
    };
    const environment: BindersEnvironment = {
        locations: {
            manualto: buildStagingEnvironmentLocation(namespace, "manualto"),
            editor: buildStagingEnvironmentLocation(namespace, "editor"),
            manage: buildStagingEnvironmentLocation(namespace, "manage"),
            ...buildInternalApiLocations()
        },
        externalLocations: {
            manualto: buildStagingEnvironmentLocation(namespace, "manualto"),
            editor: buildStagingEnvironmentLocation(namespace, "editor"),
            manage: buildStagingEnvironmentLocation(namespace, "manage"),
            api: buildStagingEnvironmentLocation(namespace, "api"),
        },
        kind: "staging",
        elastic: {
            binders: elasticConfig,
            useractions: elasticConfig,
            logevents: logeventsElasticConfig
        },
        gluster: {
            imageUploads: "/tmp/uploads"
        },
        mongo: getMongoClusterConfig(MONGO_RELEASE_NAME, MONGO_REPLICASET_NAME),
        rabbit: {
            host: getServiceName(namespace, "rabbit"),
            port: 5672
        },
        redis: {
            useSentinel: false,
            host: getServiceName(namespace, "redis"),
            port: 6379
        }
    };
    const productionSecrets = await loadProductionSecrets(branch)
    const stagingConfig = buildBindersConfig(environment, secrets, productionSecrets);

    if (!mergeWithProdSecrets) {
        return stagingConfig
    }
    return {
        ...stagingConfig,
        azure: buildAzureConfig(environment, productionSecrets)
    }

};

export function replacePasswordInBindersSecrets(binderSecrets: BindersSecrets, secret: string, pathInBindersSecrets: string[] = []): BindersSecrets {
    if (!pathInBindersSecrets.length || !secret) {
        return binderSecrets
    }
    return assocPath(pathInBindersSecrets, secret, binderSecrets)
}

