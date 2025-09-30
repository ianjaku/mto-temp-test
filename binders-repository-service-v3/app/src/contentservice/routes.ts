import { ContentService, ContentServiceFactory } from "./service";
import {
    AccountMemberParams
} from "@binders/binders-service-common/lib/middleware/authorization";
import { AccountServiceContract } from "@binders/client/lib/clients/accountservice/v1/contract";
import { ApplicationToken, } from "@binders/binders-service-common/lib/middleware/authentication";
import {
    AuthorizationServiceContract
} from "@binders/client/lib/clients/authorizationservice/v1/contract";
import { ContentServiceContract } from "@binders/client/lib/clients/contentservice/v1/contract";
import { ServiceRoute } from "@binders/binders-service-common/lib/middleware/app";
import { WebRequest } from "@binders/binders-service-common/lib/middleware/request";
import { documentAuthorization } from "../repositoryservice/authorization";
import getAppRoutes from "@binders/client/lib/clients/contentservice/v1/routes";

export function getServiceRoutes(
    serviceFactory: ContentServiceFactory,
    azClient: AuthorizationServiceContract,
    accountClient: AccountServiceContract,
): { [name in keyof ContentServiceContract]: ServiceRoute } {
    const appRoutes = getAppRoutes();
    const { docEdit } = documentAuthorization(azClient);

    function withService<T>(f: (service: ContentService, request: WebRequest) => Promise<T>): (request: WebRequest) => Promise<T> {
        return function (request: WebRequest) {
            const service = serviceFactory.forRequest(request);
            return f(service, request);
        };
    }

    return {
        fileUpload: {
            ...appRoutes.fileUpload,
            serviceHandler: (request, response) => {
                const service = serviceFactory.forRequest(request)
                return service.fileUpload(request.params.accountId, [], request, response);
            },
            authentication: ApplicationToken,
            authorization: AccountMemberParams(accountClient),
        },
        forwardFileUpload: {
            ...appRoutes.forwardFileUpload,
            serviceHandler: (request, response) => {
                const service = serviceFactory.forRequest(request)
                return service.forwardFileUpload(request.params.accountId, request, undefined, response);
            },
        },
        generateManual: {
            ...appRoutes.generateManual,
            serviceMethod: withService((service, request) =>
                service.generateManual({ ...request.body, userId: request.user?.userId }),
            ),
            authentication: ApplicationToken,
            authorization: docEdit("collectionId", true),
        },
        optimizeChunkContent: {
            ...appRoutes.optimizeChunkContent,
            serviceMethod: withService((service, request) =>
                service.optimizeChunkContent({
                    accountId: request.body.accountId,
                    binderId: request.body.binderId,
                    chunkIdx: request.body.chunkIdx,
                    langIdx: request.body.langIdx,
                    save: request.body.save,
                    userId: request.user?.userId,
                })
            ),
            authentication: ApplicationToken,
            authorization: docEdit("binderId", true),
        },
        optimizeBinderContent: {
            ...appRoutes.optimizeBinderContent,
            serviceMethod: withService((service, request) =>
                service.optimizeBinderContent({
                    accountId: request.body.accountId,
                    binderId: request.body.binderId,
                    langIdx: request.body.langIdx,
                    save: request.body.save,
                    userId: request.user?.userId,
                })
            ),
            authentication: ApplicationToken,
            authorization: docEdit("binderId", true),
        },
        updateVisualTrimSettings: {
            ...appRoutes.updateVisualTrimSettings,
            serviceMethod: withService((service, request) =>
                service.updateVisualTrimSettings(
                    request.body.accountId,
                    request.params.binderId,
                    request.body.visualIdx,
                    request.body.chunkIdx,
                    request.body.startTimeMs,
                    request.body.endTimeMs,
                )
            ),
            authentication: ApplicationToken,
            authorization: docEdit("binderId"),
        },
    };
}
