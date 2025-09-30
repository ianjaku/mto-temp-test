import { Logger as BitmovinLogger } from "@bitmovin/api-sdk";
import { Logger } from "@binders/binders-service-common/lib/util/logging";

export class PrettyBitmovinLogger implements BitmovinLogger {

    constructor(private readonly logger: Logger) {
    }

    public async logRequest(request): Promise<void> {
        const { method, url, body } = request;
        this.logger.debug("Bitmovin request", "bitmovin-logger", { method, url, body });
    }

    public async logResponse(response): Promise<void> {
        const { status } = response;
        const body = await response.text();
        this.logger.debug("Bitmovin response", "bitmovin-logger", { status, body });
    }
}

export default PrettyBitmovinLogger;
