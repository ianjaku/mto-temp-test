import { DevTypeScriptCompiler } from "../../config/services";
import type { IServiceSpec } from "../../config/services";
import type { Service } from "../docker-compose-spec.d.ts";

const DEBUG_PORT_OFFSET = 500;

/**
 * Builds a compose definition of an API runnable.
 */
export function apiApp(def: IServiceSpec & {
    /**
    * See `docker-compose.ts`
    */
    bindersConfigSecretPath: string;
    /**
    * Map of additional dependencies (docker compose-like structure)
    */
    dependencies?: Service["depends_on"];
    /**
    * Path to Dockerfile
    */
    dockerfile: string;
    /**
    * External port used by browser, playwright tests
    * Example: 30011
    */
    externalPort: number;
    /**
    * See `docker-compose.ts`
    */
    gid: number;
    /**
    * IP address of the service on the stack network, eg. 172.0.30.111
    */
    ipv4Address: string;
    /**
    * See `docker-compose.ts`
    */
    localhostDomain: string;
    mode: "development" | "build-and-run";
    /**
    * List of modules exposed on the runnable, eg. `["/comment/v1", "/binders/v3"]`
    */
    modulePathPrefixes: string[];
    /**
    * See `docker-compose.ts`
    */
    uid: number;
}): Service {
    const internalPort = def.port;
    const versionedServiceName = `${def.name}-${def.version}`;
    const command = def.mode === "build-and-run" ? "compile" : "dev";
    const compiler = def.compilers?.includes(DevTypeScriptCompiler.Esbuild) ?
        DevTypeScriptCompiler.Esbuild :
        DevTypeScriptCompiler.Tsc;

    return {
        build: {
            context: ".",
            dockerfile: def.dockerfile,
            target: versionedServiceName,
            args: {
                UID: def.uid,
                GID: def.gid,
            },
        },
        command: [`${command}:${compiler}`],
        container_name: versionedServiceName,
        mem_limit: "4g",
        networks: { web_net: { ipv4_address: def.ipv4Address } },
        restart: "unless-stopped",
        depends_on: {
            mongo: { condition: "service_healthy" },
            redis: { condition: "service_healthy" },
            elasticsearch: { condition: "service_healthy" },
            "lib-common": { condition: "service_healthy" },
            "lib-client-v1": { condition: "service_healthy" },
            ...def.dependencies,
        },
        environment: [
            `BINDERS_SERVICE_PORT=${internalPort}`,
            "HOST=0.0.0.0",
            "NODE_ENV=development",
            "ELASTIC_APM_ACTIVE=false",
        ],
        healthcheck: {
            test: [
                "CMD-SHELL",
                buildHealthcheckCommand(
                    `http://127.0.0.1:${internalPort}`,
                    def.modulePathPrefixes.slice(0, 1)
                ),
            ],
            interval: "5s",
            timeout: "2s",
            retries: 60,
        },
        labels: [
            "traefik.enable=true",
            `traefik.http.routers.${versionedServiceName}.rule=${buildTraefikApiRule(def.localhostDomain, def.modulePathPrefixes)}`,
            `traefik.http.routers.${versionedServiceName}.service=${versionedServiceName}`,
            `traefik.http.routers.${versionedServiceName}.entrypoints=web`,
            `traefik.http.services.${versionedServiceName}.loadbalancer.server.port=${internalPort}`,
            "traefik.docker.network=web_net",
        ],
        ports: [
            `${def.externalPort}:${internalPort}`,
            `${def.externalPort + DEBUG_PORT_OFFSET}:${internalPort + DEBUG_PORT_OFFSET}`,
        ],
        volumes: [
            ".:/opt/binders",
            `${def.bindersConfigSecretPath}:/etc/binders/development.json:ro`,
        ],
    }
}

function buildHealthcheckCommand(url: string, pathPrefixes: string[]) {
    return pathPrefixes.map(prefix => `${url}${prefix}/_status/healtz`)
        .map(url => `wget --spider --quiet '${url}'`)
        .join(" && ");
}

function buildTraefikApiRule(localhostDomain: string, pathPrefixes: string[]) {
    const hostPart = `Host(\`api.${localhostDomain}\`)`;
    const pathPrefixesExpression = pathPrefixes.map(p => `PathPrefix(\`${p}\`)`).join(" || ")
    return pathPrefixes.length > 0 ?
        `${hostPart} && (${pathPrefixesExpression})` :
        hostPart;
}

