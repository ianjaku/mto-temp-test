import { BindersServiceClient, RequestHandler } from "../../client";
import {
    ExportServiceContract,
    IPDFExportOptions,
} from "./contract";
import { BindersServiceClientConfig } from "../../config";
import { Config } from "../../../config";
import getRoutes from "./routes";

export class ExportServiceClient extends BindersServiceClient implements ExportServiceContract {

    constructor(
        endpointPrefix: string,
        requestHandler: RequestHandler,
        accountIdProvider?: () => string,
    ) {
        super(endpointPrefix, getRoutes(), requestHandler, accountIdProvider);
    }

    static fromConfig(
        config: Config,
        version: string,
        requestHandler: RequestHandler,
        accountIdProvider?: () => string,
    ): ExportServiceClient {
        const versionedPath = BindersServiceClientConfig.getVersionedPath(config, "export", version);
        return new ExportServiceClient(versionedPath, requestHandler, accountIdProvider);
    }

    docInfosCsv(accountId: string): Promise<string> {
        return this.handleRequest("docInfosCsv", {
            pathParams: {
                accountId,
            }
        });
    }

    colInfosCsv(accountId: string): Promise<string> {
        return this.handleRequest("colInfosCsv", {
            pathParams: {
                accountId,
            }
        });
    }

    exportPublication(
        publicationId: string,
        domain: string,
        timezone: string,
        pdfOptions?: IPDFExportOptions,
        from?: "reader" | "editor",
    ): Promise<string> {
        const options = {
            pathParams: {
                publicationId,
            },
            body: {
                domain,
                timezone,
                options: pdfOptions,
                from,
            }
        };
        return this.handleRequest("exportPublication", options);
    }

    getPdfExportOptionsForBinder(binderId: string, languageCode: string): Promise<IPDFExportOptions> {
        const options = {
            pathParams: {
                binderId,
                languageCode,
            }
        };
        return this.handleRequest("getPdfExportOptionsForBinder", options);
    }

    previewExportPublication(publicationId: string, domain: string, timezone: string, pdfOptions?: IPDFExportOptions): Promise<string> {
        const options = {
            pathParams: {
                publicationId,
            },
            body: {
                domain,
                timezone,
                options: pdfOptions,
            }
        };
        return this.handleRequest("previewExportPublication", options);
    }

}
