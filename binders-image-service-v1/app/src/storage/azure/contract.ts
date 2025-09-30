export interface IBLOBServiceConfig {
    accessKey: string;
    account: string;
    container: string;
}

// export interface IBLOBImageStorageConfig extends IBLOBServiceConfig { }
export type IBLOBImageStorageConfig = IBLOBServiceConfig;