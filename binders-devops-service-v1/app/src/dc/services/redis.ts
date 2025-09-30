import type { Service } from "../docker-compose-spec.d.ts";

export function redis(): Service {
    return {
        container_name: "redis",
        image: "redis:7.4.4-alpine",
        mem_limit: "256m",
        networks: ["web_net"],
        restart: "unless-stopped",
        healthcheck: {
            test: ["CMD", "redis-cli", "ping"],
            interval: "2s",
            timeout: "1s",
            retries: 60,
        },
        volumes: [
            "redis_db_data:/data"
        ],
    }
}

export function redisUi(): Service {
    return {
        container_name: "redis.ui",
        depends_on: { redis: { condition: "service_healthy" } },
        image: "redis/redisinsight:2.58",
        mem_limit: "256m",
        networks: ["web_net"],
        environment: [
            "RI_APP_PORT=5540",
            "RI_APP_HOST=0.0.0.0",
        ],
        ports: [
            "33003:5540"
        ],
        labels: [
            "traefik.enable=true",
            "traefik.http.routers.redisui.rule=Host(`redisui.binders.localhost`)",
            "traefik.http.routers.redisui.service=redisui",
            "traefik.http.routers.redisui.entrypoints=web",
            "traefik.http.services.redisui.loadbalancer.server.port=5540",
            "traefik.docker.network=web_net",
        ],
        volumes: [
            "redis_ui_data:/data"
        ],
    }
}

