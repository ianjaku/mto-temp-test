import type { Service } from "../docker-compose-spec.d.ts";

export function libClient(def: { dockerfile: string; gid: number; uid: number; }): Service {
    return {
        build: {
            context: ".",
            dockerfile: def.dockerfile,
            target: "lib-client-v1",
            args: {
                UID: def.uid,
                GID: def.gid,
            },
        },
        mem_limit: "1024m",
        command: ["dev"],
        healthcheck: {
            test: ["CMD-SHELL", "test -f binders-client-v1/tsconfig.tsbuildinfo && test -d binders-client-v1/lib/assets"],
            interval: "2s",
            timeout: "1s",
            retries: 30
        },
        container_name: "lib-client-v1",
        volumes: [
            ".:/opt/binders",
        ],
    }
}

export function libCommon(def: { dockerfile: string; gid: number; uid: number; }): Service {
    return {
        build: {
            context: ".",
            dockerfile: def.dockerfile,
            target: "lib-common",
            args: {
                UID: def.uid,
                GID: def.gid,
            },
        },
        depends_on: {
            "lib-client-v1": { condition: "service_healthy" },
        },
        mem_limit: "1024m",
        command: ["dev"],
        healthcheck: {
            test: ["CMD-SHELL", "test -f binders-service-common-v1/tsconfig.tsbuildinfo && test -d binders-service-common-v1/lib/assets"],
            interval: "2s",
            timeout: "1s",
            retries: 30
        },
        container_name: "lib-common",
        volumes: [
            ".:/opt/binders",
        ],
    }
}

export function libUikit(def: { dockerfile: string; gid: number; uid: number; }): Service {
    return {
        build: {
            context: ".",
            dockerfile: def.dockerfile,
            target: "lib-uikit",
            args: {
                UID: def.uid,
                GID: def.gid,
            },
        },
        mem_limit: "1024m",
        command: ["dev"],
        healthcheck: {
            test: ["CMD-SHELL", "test -f binders-ui-kit/tsconfig.tsbuildinfo"],
            interval: "2s",
            timeout: "1s",
            retries: 30
        },
        container_name: "lib-uikit",
        volumes: [
            ".:/opt/binders",
        ],
    }
}

