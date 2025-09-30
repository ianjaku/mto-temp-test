// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyLog = Record<string, any>

export enum Category {
    AzureBlobUpload = "azure-blob-upload",
    CreateBinder = "create-binder",
    ContentV1 = "content-v1",
    Cors = "cors",
    Domains = "domains",
    ElasticInit = "elastic-init",
    ElasticScroll = "elastic-scroll",
    EsStats = "es-stats",
    GetLocalCopy = "getLocalCopy",
    ImageApi = "image-api",
    ImageUpload = "image-upload",
    ImageWorker = "image-worker",
    MongoConnect = "mongo-connect",
    MongoIndex = "mongo-index",
    Panic = "panic",
    RedisGetSet = "redis-get-set",
    RedisLocking = "redis-locking",
    RedisPubsub = "redis-pubsub",
    Request = "request",
    SharpHandler = "sharp-handler",
    UsageAzureOpenAi = "usage-azure-open-ai",
}

export type FormatLogOptions = {
    printData?: boolean;
    printMsg?: boolean;
    printOriginal?: boolean;
    printOther?: boolean;
    printSeparator?: boolean;
    defaultConsoleWidth?: number;
}
