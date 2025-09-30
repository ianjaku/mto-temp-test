import type { Service } from "../docker-compose-spec.d.ts";

export function elasticsearch(def: { dataVolume: string }): Service {
    return {
        command: `
      sh -c 'if [ ! -d "/usr/share/elasticsearch/plugins/repository-azure" ]; then
      elasticsearch-plugin install --batch repository-azure; fi &&
      exec elasticsearch -E search.max_buckets=900000'
`,
        container_name: "elasticsearch",
        image: "docker.elastic.co/elasticsearch/elasticsearch:7.17.25",
        restart: "unless-stopped",
        user: "1000:1000",
        mem_limit: "4g",
        environment: [
            "discovery.type=single-node",
            "ES_JAVA_OPTS=-Xms1000m -Xmx1000m",
            "xpack.security.enabled=false",
            "bootstrap.memory_lock=true",
            "http.port=9200",
            "http.cors.enabled=true",
            "http.cors.allow-origin=http://localhost:33001,http://127.0.0.1:33001,http://esui.binders.localhost",
            "http.cors.allow-headers=X-Requested-With,X-Auth-Token,Content-Type,Content-Length,Authorization",
            "http.cors.allow-credentials=true",
        ],
        healthcheck: {
            test: ["CMD-SHELL", "curl -f http://localhost:9200/_cluster/health"],
            interval: "5s",
            timeout: "5s",
            retries: 30,
        },
        networks: {
            web_net: {
                aliases: [
                    "binders-es-http"
                ]
            }
        },
        ports: [
            "9200:9200",
            "9300:9300",
        ],
        ulimits: {
            memlock: {
                soft: -1,
                hard: -1
            },
        },
        volumes: [
            `${def.dataVolume}:/usr/share/elasticsearch/data`,
        ],
    };
}

export function elasticsearchUi(): Service {
    return {
        container_name: "elasticsearch.ui",
        depends_on: { elasticsearch: { condition: "service_healthy" } },
        image: "cars10/elasticvue:1.6.2",
        environment: {
            ELASTICVUE_CLUSTERS: JSON.stringify([{
                "name": "binders-elastic",
                "uri": "http://localhost:9200",
                "username": "elastic",
                "password": "elastic",
            }])
        },
        networks: ["web_net"],
        ports: ["33001:8080"],
        labels: [
            "traefik.enable=true",
            "traefik.http.routers.esui.rule=Host(`esui.binders.localhost`)",
            "traefik.http.routers.esui.service=esui",
            "traefik.http.routers.esui.entrypoints=web",
            "traefik.http.services.esui.loadbalancer.server.port=8080",
            "traefik.docker.network=web_net",
        ],
    };
}
