import type { Service } from "../docker-compose-spec.d.ts";

export function traefik(def: {
    ipv4Address: string;
}): Service {
    return {
        image: "traefik:v3.2",
        container_name: "traefik",
        mem_limit: "128m",
        command: [
            "--log.level=DEBUG",
            "--api.insecure=true",
            "--accesslog=true",
            "--providers.docker=true",
            "--providers.docker.exposedbydefault=false",
            "--entryPoints.web.address=:80",
            "--metrics.prometheus=true",
            "--metrics.prometheus.entryPoint=metrics",
            "--metrics.prometheus.buckets=0.1,0.3,1.2,5.0",
            "--metrics.prometheus.addEntryPointsLabels=true",
            "--metrics.prometheus.addServicesLabels=true",
            "--entryPoints.metrics.address=:8899",
        ],
        ports: [
            "80:80",
            "8081:8080",
            "8899:8899",
        ],
        networks: {
            web_net: {
                ipv4_address: def.ipv4Address,
            }
        },
        volumes: [
            "/var/run/docker.sock:/var/run/docker.sock:ro",
        ]
    }
}
