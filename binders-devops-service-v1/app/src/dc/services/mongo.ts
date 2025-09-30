import type { Service } from "../docker-compose-spec.d.ts";

export function mongo(def: { configVolume: string, dataVolume: string }): Service {
    return {
        container_name: "mongo",
        image: "mongo:8.0",
        networks: ["web_net"],
        restart: "unless-stopped",
        mem_limit: "1g",
        healthcheck: {
            test: ["CMD", "mongosh", "--eval", "db.adminCommand('ping')"],
            interval: "5s",
            timeout: "5s",
            retries: 60,
        },
        volumes: [
            `${def.dataVolume}:/data/db`,
            `${def.configVolume}data:/data/configdb`,
        ],
    };
}

export function mongoUi(): Service {
    return {
        container_name: "mongo.ui",
        depends_on: { mongo: { condition: "service_healthy" } },
        image: "mongo-express:1.0.2-20-alpine3.19",
        mem_limit: "256m",
        networks: ["web_net"],
        restart: "unless-stopped",
        ports: [
            "33002:8081"
        ],
        environment: {
            "ME_CONFIG_MONGODB_ADMINUSERNAME": "admin",
            "ME_CONFIG_MONGODB_ADMINPASSWORD": "nothanks",
            "ME_CONFIG_MONGODB_URL": "mongodb://mongo:27017",
            "ME_CONFIG_MONGODB_PORT": 27017,
            "ME_CONFIG_MONGODB_HOST": "mongo",
            "ME_CONFIG_MONGODB_ENABLE_ADMIN": "true",
            "ME_CONFIG_OPTIONS_EDITORTHEME": "material-darker",
            "ME_CONFIG_BASICAUTH": "false",
            "ME_CONFIG_BASICAUTH_USERNAME": "",
            "ME_CONFIG_BASICAUTH_PASSWORD": "",
        },
        labels: [
            "traefik.enable=true",
            "traefik.http.routers.mongoui.rule=Host(`mongoui.binders.localhost`)",
            "traefik.http.routers.mongoui.service=mongoui",
            "traefik.http.routers.mongoui.entrypoints=web",
            "traefik.http.services.mongoui.loadbalancer.server.port=8081",
            "traefik.docker.network=web_net",
        ]
    }
}
