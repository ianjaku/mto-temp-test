interface CpuConfig {
    requests: string;
    limits?: string;
}

const productionServicesCpuConfig = {
    account: {
        requests: "100m"
    },
    authorization: {
        requests: "100m"
    },
    credential: {
        requests: "100m"
    },
    devops: {
        requests: "100m"
    },
    editor: {
        requests: "100m"
    },
    image: {
        requests: "800m"
    },
    manage: {
        requests: "50m"
    },
    notification: {
        requests: "100m"
    },
    partners: {
        requests: "50m"
    },
    "public-api": {
        requests: "50m"
    },
    binders: {
        requests: "400m"
    },
    tracking: {
        requests: "150m"
    },
    manualto: {
        requests: "150m"
    },
    dashboard: {
        requests: "100m"
    },
    user: {
        requests: "100m"
    }
};

export function getServiceCpuConfig(serviceName: string, isProduction: boolean): CpuConfig {
    const defaultConfig: CpuConfig = {
        requests: "100m"
    };
    if (isProduction) {
        return productionServicesCpuConfig[serviceName] || defaultConfig;
    }
    return defaultConfig
}