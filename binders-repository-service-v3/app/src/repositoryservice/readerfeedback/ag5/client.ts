import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import { Logger } from "@binders/binders-service-common/lib/util/logging";
import { LoggerBuilder } from "@binders/binders-service-common/lib/util/logging";

export type AG5Skill = {
    name: string;
    documentId: string;
};

export class AG5Client {
    static get() {
        const config = BindersConfig.get();
        const baseUrl = config.getString("ag5.baseUrl").get();
        const apiKey = config.getString("ag5.apiKey").get();
        const logger = LoggerBuilder.fromConfig(config, "ag5-client");
        return new AG5Client(baseUrl, apiKey, logger);
    }

    constructor(
        private readonly baseUrl: string,
        private readonly apiKey: string,
        private readonly logger?: Logger,
    ) {
    }

    logError(message: string, context: Record<string, unknown>) {
        try {
            this.logger?.warn(message, "ag5-client", context);
        } catch (e) {
            // Ignore
        }
    }

    async getAllSkills(): Promise<AG5Skill[]> {
        const response = await fetch(
            `${this.baseUrl}/qualifications`,
            {
                headers: {
                    "Authorization": `Bearer ${this.apiKey}`
                }
            }
        );
        if (!response.ok) {
            this.logError("Failed to fetch skills from AG5", { status: response.status, statusText: response.statusText });
            return [];
        }
        try {
            const responseJson = await response.json();
            if (!(responseJson?.results)) {
                this.logError("Invalid response structure from AG5", { responseJson });
                return [];
            }
            return responseJson.results.map(result => ({
                name: Object.values(result.name || {}).at(0),
                documentId: result.externalCode,
            }));
        } catch (error) {
            this.logError("Error parsing skills from AG5", { error });
            return [];
        }
    }
}
