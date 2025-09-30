export interface IIngressRule {
    hosts: string[];
    paths?: string[];
}

export interface IServiceBackend {
    name: string;
    port: number;
}

export interface ITLSConfig {
    hosts: string[];
    secretName: string;
}

export interface IAuthConfig {
    type: "basic" | "digest";
    secret: string;
    realm: string;
}

export enum BackendProtocol {
    HTTPS = "HTTPS"
}

export interface IIngress {
    name: string;
    // eslint-disable-next-line @typescript-eslint/ban-types
    labels: {};
    rules: IIngressRule[];
    backend: IServiceBackend;
    tlsConfig?: ITLSConfig;
    authConfig?: IAuthConfig;
    backendProtocol?: BackendProtocol
}

const extractExtraAnnotations = (ingress: IIngress) => {
    const annotations = {};
    const { authConfig, backendProtocol } = ingress;
    if (authConfig) {
        ["type", "secret", "realm"].forEach(k => {
            annotations[`nginx.ingress.kubernetes.io/auth-${k}`] = authConfig[k];
        });
    }

    if (backendProtocol) {
        annotations["nginx.ingress.kubernetes.io/backend-protocol"] = backendProtocol
    }

    return annotations;
};

// eslint-disable-next-line @typescript-eslint/ban-types
const buildPaths = (rule: IIngressRule, backend: IServiceBackend): Array<{}> => {
    const { paths } = rule;
    const ruleBackend = {
        service: {
            name: backend.name,
            port: {
                number: backend.port
            }
        }
    };
    const ruleWithBackend = {
        backend: ruleBackend,
        pathType: "ImplementationSpecific"
    };
    return !paths || paths.length === 0 ?
        [ruleWithBackend] :
        paths.map(path => ({
            path,
            ...ruleWithBackend
        }));
};

// eslint-disable-next-line @typescript-eslint/ban-types
const buildRule = (rule: IIngressRule, backend: IServiceBackend): Array<{}> => {
    return rule.hosts.map(host => ({
        host,
        http: {
            paths: buildPaths(rule, backend)
        }
    }));
};

const buildRules = (ingress: IIngress) => {
    const { rules } = ingress;
    if (rules.length === 0) {
        throw new Error("Invalid ingress definition. No rules.");
    }
    // eslint-disable-next-line prefer-spread
    return [].concat.apply([], rules.map(r => buildRule(r, ingress.backend)));
};

const buildTlsConfig = (ingress: IIngress) => {
    const { tlsConfig } = ingress;
    if (!tlsConfig) {
        return {};
    }
    return {
        tls: [
            tlsConfig
        ]
    };
};

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export const buildIngress = (ingress: IIngress, namespace: string) => {
    const extraAnnotations = extractExtraAnnotations(ingress);
    return {
        apiVersion: "networking.k8s.io/v1",
        kind: "Ingress",
        metadata: {
            name: ingress.name,
            namespace,
            annotations: {
                "kubernetes.io/ingress.class": "nginx",
                "nginx.ingress.kubernetes.io/service-upstream": "true",
                ...extraAnnotations
            }
        },
        spec: {
            rules: buildRules(ingress),
            ...buildTlsConfig(ingress)
        }
    };
};