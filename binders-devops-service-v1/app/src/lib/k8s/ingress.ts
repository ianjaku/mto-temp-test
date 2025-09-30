import {
    EnvironmentStatus,
    IBindersEnvironment,
    toHostConfig,
    toServiceName
} from "../bindersenvironment";
import { IServiceSpec } from "../../config/services";
import { getTLSSecretName } from "../../actions/k8s/secrets";
import { yamlStringify } from "../yaml";

const yamlDump = (content: unknown): string => yamlStringify(content, true);

const toIngressPath = (name: string, port: number, path?: string) => {
    const ingressPath = {
        backend: {
            service: {
                name,
                port: {
                    number: port
                }
            }
        },
        pathType: "Prefix"
    };
    if (path) {
        ingressPath["path"] = path;
    } else {
        ingressPath["path"] = "/"
    }
    return ingressPath;
};

const toIngressRuleWithHost = (host: string, serviceName: string, servicePort: number, path?: string) => {
    const ingressPath = toIngressPath(serviceName, servicePort, path);
    return {
        host,
        http: {
            paths: [ingressPath]
        }
    };
};

const frontendRules = (environment: IBindersEnvironment, hosts: string[], name: string, version: string, portOverride?: number) => {
    const spec = environment.services.find(service => service.name === name && service.version === version);
    const port = portOverride || spec.port;
    return hosts.map(host =>
        toIngressRuleWithHost(host, toServiceName(spec), port)
    );
};

const editorRules = (environment: IBindersEnvironment) => {
    const { editor: editorHosts } = toHostConfig(environment);

    return frontendRules(environment, editorHosts, "editor", "v2");
};

const getEditorHosts = (environment: IBindersEnvironment) => {
    const { editor: editorHosts } = toHostConfig(environment);
    const noWildcardEditorHost = editorHosts.find(s => !s.startsWith("*"));
    const wildcardEditorHost = editorHosts.find(s => s.startsWith("*"));
    return { noWildcardEditorHost, wildcardEditorHost };
};


const editorRule = (environment: IBindersEnvironment) => {
    const { noWildcardEditorHost } = getEditorHosts(environment);
    return frontendRules(environment, [noWildcardEditorHost], "editor", "v2");
};

const wildcardEditorRule = (environment: IBindersEnvironment) => {
    const { wildcardEditorHost } = getEditorHosts(environment);
    return frontendRules(environment, [wildcardEditorHost], "editor", "v2");
};

const manualtoRules = (environment: IBindersEnvironment) => {
    const { manualto: hosts } = toHostConfig(environment);
    return frontendRules(environment, [hosts], "manualto", "v1");
};

const manageRule = (environment: IBindersEnvironment) => {
    const { manage } = toHostConfig(environment);
    return frontendRules(environment, [manage], "manage", "v1")
        .pop();
};

const partnersRule = (environment: IBindersEnvironment) => {
    const { partners } = toHostConfig(environment);
    return frontendRules(environment, [partners], "partners", "v1").pop();
}

const dashboardRule = (environment: IBindersEnvironment) => {
    const { dashboard } = toHostConfig(environment);
    return frontendRules(environment, [dashboard], "dashboard", "v1")
        .pop();
};

const offlineRule = (environment: IBindersEnvironment, hosts: string[], portOverride?: number) => {
    return frontendRules(environment, hosts, "static-pages", "v1", portOverride);
};

const toAPIIngressRule = (environment: IBindersEnvironment) => {
    const { api } = toHostConfig(environment);
    const paths = [];
    environment.services
        .filter(service => !service.isFrontend)
        .map(service => {
            const servicePaths = [];
            let targetService: IServiceSpec;
            if (!service.sharedDeployment) {
                targetService = service;
            } else {
                targetService = environment.services.find(s => s.name === service.sharedDeployment);
                if (!targetService) {
                    throw new Error(`Invalid shared service (not found): '${service.sharedDeployment}'`);
                }
            }
            const targetServiceName = toServiceName(targetService);
            servicePaths.push(
                toIngressPath(targetServiceName, targetService.port, `/${service.name}/${service.version}`)
            );
            if (service.extraIngressPaths) {
                servicePaths.push(...service.extraIngressPaths.map(
                    extraPath => toIngressPath(targetServiceName, targetService.port, extraPath)
                ));
            }
            paths.push(...servicePaths);
        });
    return {
        host: api,
        http: {
            paths
        }
    };
};

const toIngressRules = (environment: IBindersEnvironment) => {
    const sharedRules = [
        toAPIIngressRule(environment)
    ];

    if (environment.services.some(s => s.name === "dashboard")) {
        sharedRules.push(dashboardRule(environment));
    }
    if (environment.services.some(s => s.name === "manage")) {
        sharedRules.push(manageRule(environment));
    }
    if (environment.services.some(s => s.name === "partners")) {
        sharedRules.push(partnersRule(environment));
    }
    if (environment.status === undefined || environment.status === EnvironmentStatus.ONLINE) {
        return [
            ...sharedRules,
            ...editorRules(environment),
            ...manualtoRules(environment),
        ];
    }
    if (environment.status === EnvironmentStatus.MAINTENANCE) {
        const maintenanceRules = [];
        if (environment.services.some(s => s.name === "dashboard")) {
            maintenanceRules.push(dashboardRule(environment));
        }
        if (environment.services.some(s => s.name === "manage")) {
            maintenanceRules.push(manageRule(environment));
        }
        if (environment.services.some(s => s.name === "partners")) {
            maintenanceRules.push(partnersRule(environment));
        }
        return maintenanceRules;
    }
    throw new Error(`Unknown environment status ${environment.status}`);
};

export const toIngress = (environment: IBindersEnvironment, applicationGatewayIngress = false): string => {
    const name = environment.isProduction ?
        `production-ingress${applicationGatewayIngress ? "-agic" : ""}` :
        `${environment.prefix}-ingress${applicationGatewayIngress ? "-agic" : ""}`;
    const ingressClassName = applicationGatewayIngress ? "azure-application-gateway" : "nginx"
    const annotations = getIngressAnnotations(applicationGatewayIngress)

    const ingress = {
        apiVersion: "networking.k8s.io/v1",
        kind: "Ingress",
        metadata: {
            name,
            annotations
        },
        spec: {
            ingressClassName,
            rules: toIngressRules(environment)
        }
    };

    const hostConfig = toHostConfig(environment);
    const hosts = environment.status === EnvironmentStatus.MAINTENANCE ?
        (
            [
                hostConfig.dashboard,
                hostConfig.manage
            ]
        ) :
        (
            [
                hostConfig.api,
                hostConfig.dashboard,
                ...hostConfig.editor,
                hostConfig.manualto,
                hostConfig.manage,
                hostConfig.partners
            ]
        );

    const secretName = getTLSSecretName(environment);
    ingress.spec["tls"] = [{
        hosts,
        secretName
    }];

    return yamlDump(ingress);
};

function getIngressAnnotations(applicationGatewayIngress: boolean) {
    if (applicationGatewayIngress) {
        return {
            "appgw.ingress.kubernetes.io/request-timeout": "900"
        }
    }
    return {
        //This puts a limit on image upload size
        "nginx.ingress.kubernetes.io/proxy-body-size": "5000m",
        // This puts a limit on the max header size
        "nginx.ingress.kubernetes.io/proxy-buffer-size": "128k",
        // This is the timeout for maximum inactivity (websockets included)
        "nginx.ingress.kubernetes.io/proxy-read-timeout": "900",
        // "nginx.ingress.kubernetes.io/client-body-buffer-size": "500m",
        /* IE11 (win 7 & 8) specific:
        https://support.microsoft.com/en-us/topic/rc4-cipher-is-no-longer-supported-in-internet-explorer-11-or-microsoft-edge-f8687bc1-1f88-9abe-5c81-b00c26290f36
        https://kubernetes.github.io/ingress-nginx/user-guide/nginx-configuration/annotations/#ssl-ciphers
        So now we have default setting with removed RC4 cipher
        */
        /* SSL ciphers list format: https://www.openssl.org/docs/manmaster/man1/openssl-ciphers.html#CIPHER-LIST-FORMAT */
        "nginx.ingress.kubernetes.io/ssl-ciphers": "ALL:!aNULL:!EXPORT56:+HIGH:+MEDIUM:+LOW:+SSLv2:+EXP",
        "nginx.ingress.kubernetes.io/ssl-prefer-server-ciphers": "true"
    }
}

const getSharedRules = (environment: IBindersEnvironment) => {
    const sharedRules = [
        toAPIIngressRule(environment)
    ];

    if (environment.services.some(s => s.name === "dashboard")) {
        sharedRules.push(dashboardRule(environment));
    }
    if (environment.services.some(s => s.name === "manage")) {
        sharedRules.push(manageRule(environment));
    }
    if (environment.services.some(s => s.name === "partners")) {
        sharedRules.push(partnersRule(environment));
    }
    return sharedRules
}


export const toApiAgicIngress = (environment: IBindersEnvironment): string => {
    const name = environment.isProduction ?
        "api-production-ingress-agic" :
        `api-${environment.prefix}-ingress-agic`;
    const ingressClassName = "azure-application-gateway"
    const annotations = getAzureAppGatewayAnnotations(environment.isProduction)
    const ingress = {
        apiVersion: "networking.k8s.io/v1",
        kind: "Ingress",
        metadata: {
            name,
            annotations
        },
        spec: {
            ingressClassName,
            rules: getSharedRules(environment)
        }
    };

    const hostConfig = toHostConfig(environment);
    const hosts = environment.status === EnvironmentStatus.MAINTENANCE ?
        (
            [
                hostConfig.dashboard,
                hostConfig.manage
            ]
        ) :
        (
            [
                hostConfig.api,
                hostConfig.dashboard,
                hostConfig.manage,
                hostConfig.partners
            ]
        );


    const secretName = getTLSSecretName(environment);
    ingress.spec["tls"] = [{
        hosts,
        secretName
    }];

    return yamlDump(ingress);
};

export const toWildcardEditorAgicIngress = (environment: IBindersEnvironment): string => {
    const name = environment.isProduction ?
        "wildcard-editor-production-ingress-agic" :
        `wildcardeditor-${environment.prefix}-ingress-agic`;
    const ingressClassName = "azure-application-gateway"
    const annotations = getAzureAppGatewayAnnotations(environment.isProduction, "18000")
    const ingress = {
        apiVersion: "networking.k8s.io/v1",
        kind: "Ingress",
        metadata: {
            name,
            annotations
        },
        spec: {
            ingressClassName,
            rules: wildcardEditorRule(environment)
        }
    };

    const { wildcardEditorHost } = getEditorHosts(environment);

    const secretName = getTLSSecretName(environment);
    ingress.spec["tls"] = [{
        hosts: [ wildcardEditorHost],
        secretName
    }];

    return yamlDump(ingress);
};

export const toEditorAgicIngress = (environment: IBindersEnvironment): string => {
    const name = environment.isProduction ?
        "editor-production-ingress-agic" :
        `editor-${environment.prefix}-ingress-agic`;
    const ingressClassName = "azure-application-gateway"
    const annotations = getAzureAppGatewayAnnotations(environment.isProduction, "18100")
    const ingress = {
        apiVersion: "networking.k8s.io/v1",
        kind: "Ingress",
        metadata: {
            name,
            annotations
        },
        spec: {
            ingressClassName,
            rules: editorRule(environment)
        }
    };
    const { noWildcardEditorHost } = getEditorHosts(environment)

    const secretName = getTLSSecretName(environment);
    ingress.spec["tls"] = [{
        hosts: [noWildcardEditorHost],
        secretName
    }];

    return yamlDump(ingress);
};


export const toReaderAgicIngress = (environment: IBindersEnvironment): string => {
    const name = environment.isProduction ?
        "reader-production-ingress-agic" :
        `reader-${environment.prefix}-ingress-agic`;
    const ingressClassName = "azure-application-gateway"
    const annotations = getAzureAppGatewayAnnotations(environment.isProduction, "20000")
    const ingress = {
        apiVersion: "networking.k8s.io/v1",
        kind: "Ingress",
        metadata: {
            name,
            annotations
        },
        spec: {
            ingressClassName,
            rules: manualtoRules(environment)
        }
    };

    const hostConfig = toHostConfig(environment);
    const hosts = [
        hostConfig.manualto,
    ]

    const secretName = getTLSSecretName(environment);
    ingress.spec["tls"] = [{
        hosts,
        secretName
    }];

    return yamlDump(ingress);
};

export const toOfflineIngress = (environment: IBindersEnvironment): string => {
    const hostConfig = toHostConfig(environment);
    const toIngress = (name: string, rules, hosts) => {
        const ingress = {
            apiVersion: "networking.k8s.io/v1",
            kind: "Ingress",
            metadata: {
                name,
                annotations: {
                    "kubernetes.io/ingress.class": "nginx",
                    "nginx.ingress.kubernetes.io/force-ssl-redirect": "true"
                }
            },
            spec: {
                rules
            }
        }
        const secretName = getTLSSecretName(environment);
        ingress.spec["tls"] = [{
            hosts,
            secretName
        }];

        return ingress;
    };
    const offlineHosts = [hostConfig.offline];
    const offlineIngressObject = toIngress(
        "offline-ingress",
        offlineRule(environment, offlineHosts),
        offlineHosts
    );
    const offlineIngress = yamlDump(offlineIngressObject);
    const offlineFrontendHosts = environment.status === EnvironmentStatus.MAINTENANCE ?
        ([
            hostConfig.api,
            ...hostConfig.editor,
            ...hostConfig.manualto,
        ]) :
        ([
            "fake-frontent-for-ingress.dev.binders.media"
        ]);
    const offlineIngressFrontendObject = toIngress(
        "offline-ingress-frontend",
        offlineRule(environment, offlineFrontendHosts, 8081),
        offlineFrontendHosts
    );
    const offlineIngressFrontend = yamlDump(offlineIngressFrontendObject);
    return `${offlineIngressFrontend}\n---\n${offlineIngress}`;
};


function getAzureAppGatewayAnnotations(isProduction: boolean, priority?: string) {
    const annotations = {
        "appgw.ingress.kubernetes.io/request-timeout": "900"
    }

    if(isProduction && priority) {
        annotations["appgw.ingress.kubernetes.io/rule-priority"] = priority
    }
    return annotations
}