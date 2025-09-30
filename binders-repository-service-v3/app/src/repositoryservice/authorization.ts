import {
    AdminDocument,
    Authorization,
    EditDocument,
    MultiDocumentAdmin,
    MultiDocumentView,
    PublishDocument,
    PublishDocumentAsTranslator,
    ReviewDocument,
    ViewDocument,
    authorize,
} from "@binders/binders-service-common/lib/middleware/authorization";
import { AuthorizationServiceContract } from "@binders/client/lib/clients/authorizationservice/v1/contract";
import { BindersRepositoryServiceContract } from "@binders/client/lib/clients/repositoryservice/v3/contract";
import { PublicationNotFound } from "@binders/client/lib/clients/publicapiservice/v1/contract";
import { WebRequest } from "@binders/binders-service-common/lib/middleware/request";

export function documentAuthorization(
    azClient: AuthorizationServiceContract,
) {

    function docAdmin(key: string, reqParam = "params"): Authorization {
        return authorize(async req => {
            const ver = AdminDocument(async req => Promise.resolve(req[reqParam][key]));
            const res = await ver(req);
            return res;
        }, azClient);
    }

    function docEdit(key: string, keyInBody?: boolean): Authorization {
        return authorize(async req => {
            const ver = EditDocument(async req => {
                return await Promise.resolve(keyInBody ? req.body[key] : req.params[key])
            });
            const res = await ver(req);
            return res;
        }, azClient);
    }

    function docPublish(key: string, keyInBody?: boolean): Authorization {
        return authorize(PublishDocument(req => Promise.resolve(keyInBody ? req.body[key] : req.params[key])), azClient);
    }

    function docRead(key: string, keyInBody = false): Authorization {
        return authorize(ViewDocument(req => Promise.resolve(keyInBody ? req.body[key] : req.params[key])), azClient);
    }

    function docReviewApprove(key: string): Authorization {
        return authorize(ReviewDocument(req => Promise.resolve(req.body[key])), azClient);
    }

    function docTranslate(key: string, languageCodesExtractor: (req: WebRequest) => string[] | undefined, keyInBody?: boolean): Authorization {
        return authorize(
            PublishDocumentAsTranslator(
                async (req): Promise<string> => keyInBody ? req.body[key] : req.params[key],
                async (req) => ({ languageCodes: languageCodesExtractor(req) ?? [] }))
            , azClient);
    }

    function multiDocAdmin(key: string): Authorization {
        return MultiDocumentAdmin(azClient, key);
    }

    function multiDocRead(key: string): Authorization {
        return MultiDocumentView(azClient, key);
    }

    return {
        docAdmin,
        docEdit,
        docPublish,
        docRead,
        docReviewApprove,
        docTranslate,
        multiDocAdmin,
        multiDocRead,
    };
}

export function publicationAuthorization(
    azClient: AuthorizationServiceContract,
    repoClient: BindersRepositoryServiceContract,
) {

    function publicationRead(key: string): Authorization {
        const extractor = async (request: WebRequest) => {
            const publicationId = request.params[key] ?? request.body[key];
            try {
                const publication = await repoClient.getPublication(publicationId, { skipPopulateVisuals: true });
                return publication.binderId;
            } catch (e) {
                throw new PublicationNotFound(`publicationId: ${publicationId}`);
            }
        };
        return authorize(ViewDocument(extractor), azClient);
    }

    return {
        publicationRead,
    }
}
