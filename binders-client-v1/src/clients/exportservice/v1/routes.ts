import * as HTTPStatusCode from "http-status-codes";
import { AppRoute, HTTPVerb } from "../../routes";
import {
    fromBody,
    fromParams,
    validateAccountId,
    validateBinderId,
    validateLanguageCode,
    validatePublicationId,
    validateStringInput,
} from "../../validation";
import { ExportServiceContract } from "./contract";

export default function getRoutes(): { [name in keyof ExportServiceContract]: AppRoute } {
    return {
        docInfosCsv: {
            description: "Get a CSV of document infos",
            path: "/docinfoscsv/:accountId",
            verb: HTTPVerb.GET,
            validationRules: [
                [fromParams, "accountId", validateAccountId],
            ],
            successStatus: HTTPStatusCode.OK
        },
        colInfosCsv: {
            description: "Get a CSV of collection infos",
            path: "/colinfoscsv/:accountId",
            verb: HTTPVerb.GET,
            validationRules: [
                [fromParams, "accountId", validateAccountId],
            ],
            successStatus: HTTPStatusCode.OK
        },
        exportPublication: {
            description: "Export publication to pdf",
            path: "/export/:publicationId",
            verb: HTTPVerb.POST,
            validationRules: [
                [fromParams, "publicationId", validatePublicationId],
                [fromBody, "domain", validateStringInput],
            ],
            successStatus: HTTPStatusCode.OK
        },
        getPdfExportOptionsForBinder: {
            description: "Get pdf export options for binder",
            path: "/pdfexportoptions/:binderId/:languageCode",
            verb: HTTPVerb.GET,
            validationRules: [
                [fromParams, "binderId", validateBinderId],
                [fromParams, "languageCode", validateLanguageCode],
            ],
            successStatus: HTTPStatusCode.OK
        },
        previewExportPublication: {
            description: "Preview HTML of exportable pdf",
            path: "/export-preview/:publicationId",
            verb: HTTPVerb.POST,
            validationRules: [
                [fromParams, "publicationId", validatePublicationId],
                [fromBody, "domain", validateStringInput],
            ],
            successStatus: HTTPStatusCode.OK
        },
    };
}
