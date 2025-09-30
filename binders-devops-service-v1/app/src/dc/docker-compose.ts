import * as chalk from "chalk";
import type { ComposeSpecification, Service as DefinitionsService } from "./docker-compose-spec.d.ts";
import type { DevTypeScriptCompiler, IServiceSpec, WebAppBundler } from "../config/services";
import { elasticsearch, elasticsearchUi } from "./services/elasticsearch";
import { libClient, libCommon, libUikit } from "./services/libs";
import { mongo, mongoUi } from "./services/mongo";
import { redis, redisUi } from "./services/redis";
import { apiApp } from "./services/api";
import { log } from "./log";
import { traefik } from "./services/traefik";
import { webApp } from "./services/web";

const { bold, green, underline, yellow } = chalk;

/**
 * Builds the contents of docker-compose.yml
 */
export function buildDockerCompose({
    bindersConfigSecretPath,
    elasticPath,
    gid,
    ipOverrides,
    localhostDomain,
    mode,
    mongoPath,
    reverseProxyIpV4,
    subnet,
    uid,
    versionedServiceMap,
    webAppBundler,
}: {
    /**
    * The path to the binders config on the host machine
    */
    bindersConfigSecretPath: string;
    /**
    * Path to the elastic data folder on the host machine
    */
    elasticPath: string,
    /**
    * Group ID of the user on the host machine
    * Used in combination with `uid` to match the `dev` user in the container (defined in `dev.Dockerfile`)
    * in order to avoid file permission errors, since the repository is mounted with the host machine user uid/gid.
    * This allows us to run processes inside the containers as a non-privileged user.
    */
    gid: number;
    /**
    * Mapping from versioned service name to IP address inside the docker-compose stack
    * Example:
    *   { "account-v1": "172.0.30.101", "binders-v3": "172.0.30.111" }
    */
    ipOverrides: Record<string, string>;
    /**
    * Root domain name. Used to build service domain names for reverse proxy.
    * Example: binders.localhost
    */
    localhostDomain: string;
    /**
    * Specifying whether to run apps in development mode, or build & run.
    * Used to simulate staging environment.
    */
    mode: "development" | "build-and-run";
    /**
    * Path to the mongo data folder on the host machine
    */
    mongoPath: string,
    /**
    * IP address of the reverse proxy inside the stack network.
    */
    reverseProxyIpV4: string;
    /**
    * Subnet for the services.
    * Example: 172.0.30.0/24
    */
    subnet: string;
    /**
    * TS compiler used to compile API services. `tsc` or `esbuild`
    */
    typescriptCompiler: DevTypeScriptCompiler;
    /**
    * User ID of the user on the host machine
    * Used in combination with `gid` to match the `dev` user in the container (defined in `dev.Dockerfile`)
    * in order to avoid file permission errors, since the repository is mounted with the host machine user uid/gid.
    * This allows us to run processes inside the containers as a non-privileged user.
    */
    uid: number;
    /**
    * Mapping from versioned service names to their `IServiceSpec`
    */
    versionedServiceMap: Record<string, IServiceSpec>
    /**
    * Web app bundler used for development & build of the web apps. `webpack` or `vite`
    */
    webAppBundler: WebAppBundler;
}): ComposeSpecification {

    log(bold("==> Building docker-compose.yml"));
    log(`Mode:               ${bold(mode === "development" ? green(mode) : yellow(mode))}`);
    log(`UID GID:            ${bold(uid + " " + gid)}`);
    log(`Reverse Proxy IP:   ${bold(reverseProxyIpV4)}`);
    log(`Subnet:             ${bold(subnet)}`);
    log(`Localhost domain:   ${bold(localhostDomain)}`);
    log(`BindersConfig:      ${underline(bindersConfigSecretPath)}`);
    log(`Elastic path:       ${underline(elasticPath)}`);
    log(`Mongo path:         ${underline(mongoPath)}`);
    log("IP Overrides:");
    for (const [serviceName, ip] of Object.entries(ipOverrides)) {
        log(`   ${serviceName.padEnd(16)} ${ip}`)
    }

    const allContainersDef = {
        uid,
        gid,
        dockerfile: "./binders-devops-service-v1/app/src/dc/dev.Dockerfile",
    };
    const apiContainersDef = {
        ...allContainersDef,
        bindersConfigSecretPath,
        localhostDomain,
    };
    const webContainersDef = {
        ...allContainersDef,
        bindersConfigSecretPath,
        developmentWebAppBundler: webAppBundler,
    };

    return {
        services: {
            redis: redis(),
            mongo: mongo({
                dataVolume: `${mongoPath}/mongo-data-db`,
                configVolume: `${mongoPath}/mongo-data-db-config`,
            }),
            elasticsearch: elasticsearch({
                dataVolume: `${elasticPath}/0`,
            }),
            traefik: traefik({ ipv4Address: reverseProxyIpV4 }),

            "redis.ui": redisUi(),
            "mongo.ui": mongoUi(),
            "elasticsearch.ui": elasticsearchUi(),
            "init-container": initContainer(allContainersDef),

            "lib-client-v1": libClient(allContainersDef),
            "lib-uikit": libUikit(allContainersDef),
            "lib-common": libCommon(allContainersDef),

            ...webApp({
                ...versionedServiceMap["editor-v2"],
                ...webContainersDef,
                mode,
                externalPort: 30006,
                ipv4Address: ipOverrides["editor-v2"],
                reverseProxyDomain: `editor.${localhostDomain}`,
            }),
            ...webApp({
                ...versionedServiceMap["manage-v1"],
                ...webContainersDef,
                mode,
                externalPort: 30008,
                ipv4Address: ipOverrides["manage-v1"],
                reverseProxyDomain: `manage.${localhostDomain}`,
            }),
            ...webApp({
                ...versionedServiceMap["manualto-v1"],
                ...webContainersDef,
                mode,
                externalPort: 30014,
                ipv4Address: ipOverrides["manualto-v1"],
                reverseProxyDomain: `manualto.${localhostDomain}`,
            }),
            ...webApp({
                ...versionedServiceMap["dashboard-v1"],
                ...webContainersDef,
                mode,
                externalPort: 30015,
                ipv4Address: ipOverrides["dashboard-v1"],
                reverseProxyDomain: `dashboard.${localhostDomain}`,
            }),

            "account-v1": apiApp({
                ...versionedServiceMap["account-v1"],
                ...apiContainersDef,
                mode,
                externalPort: 30001,
                ipv4Address: ipOverrides["account-v1"],
                modulePathPrefixes: ["/account/v1"],
            }),
            "authorization-v1": apiApp({
                ...versionedServiceMap["authorization-v1"],
                ...apiContainersDef,
                mode,
                externalPort: 30002,
                ipv4Address: ipOverrides["authorization-v1"],
                modulePathPrefixes: ["/authorization/v1"],
            }),
            "binders-v3": apiApp({
                ...versionedServiceMap["binders-v3"],
                ...apiContainersDef,
                mode,
                externalPort: 30011,
                ipv4Address: ipOverrides["binders-v3"],
                modulePathPrefixes: [
                    "/binders/v3",
                    "/routing/v1",
                    "/comment/v1",
                    "/content/v1",
                ],
            }),
            "credential-v1": apiApp({
                ...versionedServiceMap["credential-v1"],
                ...apiContainersDef,
                mode,
                externalPort: 30004,
                ipv4Address: ipOverrides["credential-v1"],
                modulePathPrefixes: ["/credential/v1"],
            }),
            "image-v1": apiApp({
                ...versionedServiceMap["image-v1"],
                ...apiContainersDef,
                mode,
                dependencies: {
                    "init-container": { condition: "service_completed_successfully" },
                },
                externalPort: 30007,
                ipv4Address: ipOverrides["image-v1"],
                modulePathPrefixes: ["/image/v1"],
            }),
            "notification-v1": apiApp({
                ...versionedServiceMap["notification-v1"],
                ...apiContainersDef,
                mode,
                externalPort: 30010,
                ipv4Address: ipOverrides["notification-v1"],
                modulePathPrefixes: ["/notification/v1"],
            }),
            "public-api-v1": apiApp({
                ...versionedServiceMap["public-api-v1"],
                ...apiContainersDef,
                mode,
                externalPort: 30017,
                ipv4Address: ipOverrides["public-api-v1"],
                modulePathPrefixes: ["/public-api/v1", "/public/v1"],
            }),
            "screenshot-v1": apiApp({
                ...versionedServiceMap["screenshot-v1"],
                ...apiContainersDef,
                bindersConfigSecretPath,
                mode,
                dependencies: {
                    "init-container": { condition: "service_completed_successfully" },
                },
                externalPort: 30020,
                ipv4Address: ipOverrides["screenshot-v1"],
                modulePathPrefixes: []
            }),
            "tracking-v1": apiApp({
                ...versionedServiceMap["tracking-v1"],
                ...apiContainersDef,
                mode,
                externalPort: 30012,
                ipv4Address: ipOverrides["tracking-v1"],
                modulePathPrefixes: ["/tracking/v1"],
            }),
            "user-v1": apiApp({
                ...versionedServiceMap["user-v1"],
                ...apiContainersDef,
                bindersConfigSecretPath,
                mode,
                externalPort: 30013,
                ipv4Address: ipOverrides["user-v1"],
                modulePathPrefixes: ["/user/v1"],
            }),
        },

        networks: {
            "web_net": {
                ipam: {
                    driver: "default",
                    config: [{ subnet }],
                }
            }
        },

        // If the binders config could be read from any location, docker compose secrets can be used
        // This would result in the binders config to be at /run/secrets/binders_config
        // instead of /etc/binders/development.json
        //
        // secrets: {
        //     binders_config: { file: bindersConfigSecretPath }
        // },

        volumes: {
            "redis_db_data": {},
            "redis_ui_data": {},
        },
    };
}

export function initContainer(def: { dockerfile: string; gid: number; uid: number; }): DefinitionsService {
    return {
        build: {
            context: ".",
            dockerfile: def.dockerfile,
            target: "init-container",
            args: {
                UID: def.uid,
                GID: def.gid,
            },
        },
        container_name: "init-container",
        command: ["install"],
        volumes: [
            ".:/opt/binders",
        ],
    }
}

