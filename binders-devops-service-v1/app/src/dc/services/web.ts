import type { IServiceSpec } from "../../config/services";
import type { Service } from "../docker-compose-spec.d.ts";
import { WebAppBundler } from "../../config/services";

/**
 * Builds compose definition of services needed to run a Web application.
 */
export function webApp(def: IServiceSpec & {
    /**
    * See `docker-compose.ts`
    */
    bindersConfigSecretPath: string;
    /**
    * Path to Dockerfile
    */
    dockerfile: string;
    /**
    * External port used by browser, playwright tests
    * Example: `30014`
    */
    externalPort: number;
    /**
    * See `docker-compose.ts`
    */
    gid: number;
    /**
    * IP address of the service on the stack network
    * Example: `172.0.30.114`
    */
    ipv4Address: string;
    mode: "development" | "build-and-run";
    /**
    * Web App Bundler used for development (from devConfig)
    */
    developmentWebAppBundler: WebAppBundler;
    /**
    * Domain to be reverse proxied
    * Example: `editor.binders.localhost`
    */
    reverseProxyDomain: string;
    /**
    * See `docker-compose.ts`
    */
    uid: number;
}): { [versionedServiceName: string]: Service } {
    const internalPort = def.port;
    const versionedServiceName = `${def.name}-${def.version}`;
    const webAppBundler = def.webAppBundler?.find(wab => wab === def.developmentWebAppBundler) ?? WebAppBundler.Webpack;

    const serverServiceName = versionedServiceName;
    const clientServiceName = `${versionedServiceName}-client`;

    const serverCommand = def.mode === "build-and-run" ?
        [`compile:${webAppBundler}`] :
        [`dev:${webAppBundler}`];
    const clientCommand = def.mode === "build-and-run" ?
        [`build:${webAppBundler}`] :
        [`dev:${webAppBundler}`];

    const build: Service["build"] = {
        context: ".",
        dockerfile: def.dockerfile,
        args: {
            UID: def.uid,
            GID: def.gid,
        },
    };

    const serverDependencies: Service["depends_on"] =
        webAppBundler === WebAppBundler.Webpack || def.mode === "build-and-run" ?
            {
                [clientServiceName]: {
                    condition: def.mode === "build-and-run" ?
                        "service_completed_successfully" :
                        "service_started"
                }
            } :
            {};

    const ports = webAppBundler === WebAppBundler.Vite ?
        [`${def.externalPort}:${internalPort}`, `${def.externalPort + 90}:${internalPort + 90}`] :
        [`${def.externalPort}:${internalPort}`];

    const serverService: Service = {
        build: { ...build, target: versionedServiceName },
        container_name: serverServiceName,
        command: serverCommand,
        mem_limit: "2048m",
        networks: { web_net: { ipv4_address: def.ipv4Address } },
        restart: "unless-stopped",
        depends_on: {
            redis: { condition: "service_healthy" },
            "account-v1": { condition: "service_healthy" },
            "authorization-v1": { condition: "service_healthy" },
            "binders-v3": { condition: "service_healthy" },
            "image-v1": { condition: "service_healthy" },
            "screenshot-v1": { condition: "service_healthy" },
            "tracking-v1": { condition: "service_healthy" },
            "credential-v1": { condition: "service_healthy" },
            "notification-v1": { condition: "service_healthy" },
            "user-v1": { condition: "service_healthy" },
            "public-api-v1": { condition: "service_healthy" },
            "lib-common": { condition: "service_healthy" },
            "lib-client-v1": { condition: "service_healthy" },
            "lib-uikit": { condition: "service_healthy" },
            ...serverDependencies,
        },
        environment: [
            `BINDERS_SERVICE_PORT=${internalPort}`,
            "HOST=0.0.0.0",
            "NODE_ENV=development",
            "ELASTIC_APM_ACTIVE=false",
        ],
        healthcheck: {
            test: ["CMD-SHELL", `nc -z 127.0.0.1 ${internalPort}`],
            interval: "5s",
            timeout: "2s",
            retries: 60,
        },
        labels: [
            "traefik.enable=true",
            `traefik.http.routers.${versionedServiceName}.rule=Host(\`${def.reverseProxyDomain}\`)`,
            `traefik.http.routers.${versionedServiceName}.service=${versionedServiceName}`,
            `traefik.http.routers.${versionedServiceName}.entrypoints=web`,
            `traefik.http.services.${versionedServiceName}.loadbalancer.server.port=${internalPort}`,
            "traefik.docker.network=web_net",
        ],
        ports,
        volumes: [
            ".:/opt/binders",
            `${def.bindersConfigSecretPath}:/etc/binders/development.json:ro`,
        ],
    }

    const clientService: Service = {
        build: { ...build, target: `${versionedServiceName}-client` },
        container_name: clientServiceName,
        command: clientCommand,
        mem_limit: "8g",
        restart: "on-failure",
        depends_on: {
            "init-container": { condition: "service_completed_successfully" },
            "lib-client-v1": { condition: "service_healthy" },
            "lib-uikit": { condition: "service_healthy" },
        },
        environment: [
            "NODE_ENV=development",
        ],
        volumes: [
            ".:/opt/binders",
            `${def.bindersConfigSecretPath}:/etc/binders/development.json:ro`,
        ],
    }

    switch (webAppBundler) {
        case WebAppBundler.Webpack:
            return {
                [serverServiceName]: serverService,
                [clientServiceName]: clientService,
            }
        case WebAppBundler.Vite:
            switch (def.mode) {
                case "build-and-run":
                    return {
                        [serverServiceName]: serverService,
                        [clientServiceName]: clientService,
                    }
                case "development":
                    return {
                        [serverServiceName]: serverService,
                    }
            }
    }
}

