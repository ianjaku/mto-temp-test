import { BindersConfig } from "../bindersconfig/binders";
import { LoggerBuilder } from "../util/logging";
import { createServer } from "node:http";

const config = BindersConfig.get();
const logger = LoggerBuilder.fromConfig(config)
const category = "health-check-server"

export function startWorkerHealthServer(healthEndpointUri: string, port: number) {
    const srv = createServer((req, res) => {
        if (req.method !== "GET" || req.url !== healthEndpointUri) {
            res.writeHead(404).end();
            return;
        }
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true }));
    });
    srv.listen(port, "0.0.0.0", () =>
        logger.info(`[health] listening on ${port}/_status/healtz`, category),
    );
    return srv;
}
