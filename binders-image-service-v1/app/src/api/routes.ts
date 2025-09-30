import {
    AccountServiceContract,
    FEATURE_READER_COMMENTING
} from  "@binders/client/lib/clients/accountservice/v1/contract";
import {
    Allow,
    Authorization,
    EditDocument,
    MultiAuthorizationAnd,
    MultiAuthorizationOr,
    MultiDocument,
    ViewDocument,
    accountIdFromRequest,
    authorize,
    buildUrlTokenAuth
} from  "@binders/binders-service-common/lib/middleware/authorization";
import {
    ApplicationToken,
    ApplicationTokenOrPublic,
    Public
} from  "@binders/binders-service-common/lib/middleware/authentication";
import {
    AuthorizationServiceContract,
    PermissionName
} from  "@binders/client/lib/clients/authorizationservice/v1/contract";
import {
    IVideoIndexerResultFilter,
    ImageServiceContractBuilder,
    VisualFitBehaviour
} from  "@binders/client/lib/clients/imageservice/v1/contract";
import { ImageServiceBuilder, WebRequest as RequestWithProps } from "./service";
import { AccountAclScope } from "@binders/client/lib/clients/authorizationservice/v1/tokenacl";
import {
    BindersRepositoryServiceContract
} from  "@binders/client/lib/clients/repositoryservice/v3/contract";
import { ResourceType } from "@binders/client/lib/clients/authorizationservice/v1/contract";
import { ServiceRoute } from "@binders/binders-service-common/lib/middleware/app";
import { Unauthorized } from "@binders/client/lib/clients/model";
import { WebRequest } from "@binders/binders-service-common/lib/middleware/request";
import { getAllPathsToRootCollection } from "@binders/client/lib/ancestors";
import getAppRoutes from "@binders/client/lib/clients/imageservice/v1/routes";

export function getServiceRoutes(
    imageServiceBuilder: ImageServiceBuilder,
    azClient: AuthorizationServiceContract,
    accountClient: AccountServiceContract,
    repoClient: BindersRepositoryServiceContract,
): { [name in keyof ImageServiceContractBuilder]: ServiceRoute<RequestWithProps> } {

    const appRoutes = getAppRoutes();

    function withService<T>(f: (service: ImageServiceContractBuilder, request: WebRequest) => Promise<T>): (request: WebRequest) => Promise<T> {
        return function (request: WebRequest) {
            return f(imageServiceBuilder, request);
        };
    }

    function docEdit(key: string): Authorization {
        return authorize(EditDocument(async req => {
            const binderId = req.params[key] ?? req.body[key];
            if (!binderId) throw new Unauthorized(`Item id not found with key "${key}".`);
            return binderId;
        }), azClient);
    }

    function docRead(key: string): Authorization {
        return authorize(ViewDocument(async req => req.params[key]), azClient);
    }

    function visualsRead(extractor: (req: WebRequest) => string[]): Authorization {
        return async (webRequest: RequestWithProps) => {
            const visualIds = extractor(webRequest);
            const binderIds = await imageServiceBuilder.getBinderIdsForVisualIds(webRequest, visualIds);
            const authorizeFunc = MultiDocument(azClient, async () => binderIds, PermissionName.VIEW);
            return authorizeFunc(webRequest);
        }
    }

    function featureEnabled(feature: string): Authorization {
        return async (request: WebRequest) => {
            const features = await accountClient.getAccountFeatures(accountIdFromRequest(request));
            if (!features.includes(FEATURE_READER_COMMENTING)) {
                throw new Unauthorized(`Feature ${feature} is not enabled for this account`);
            }
        }
    }

    function readerCommentsEnabledForItem(key: string): Authorization {
        return async (request: WebRequest) => {
            const itemId = request.params[key];
            const ancestors = await repoClient.getAncestors(itemId);
            const ancestorIds = Object.keys(ancestors);
            const configsById = await repoClient.getReaderFeedbackConfigForItems(ancestorIds);
            const configs = Object.values(configsById);

            // No configs found => enabled for all
            if (configs.length === 0) {
                return;
            }

            // If it's enabled for any of the ancestors, we're good
            const allPathsToParents = getAllPathsToRootCollection(itemId, ancestors);
            const hasOnePathEnabled = allPathsToParents.some(
                path => {
                    for (let i=path.length - 1; i >= 0; i--) {
                        const config = configsById[path[i]];
                        if (config && config.readerCommentsEnabled != null) {
                            return config.readerCommentsEnabled;
                        }
                    }
                    // When no setting is found on any of the parents,
                    // Default to true (inline with frontend behavior)
                    return true;
                });
            if (! hasOnePathEnabled) {
                throw new Unauthorized(`Reader comments are not enabled for item with id ${request.params[key]}`);
            }
        }
    }

    return {
        addLogo: {
            ...appRoutes.addLogo,
            serviceHandler: (request, response, next) => {
                return imageServiceBuilder.addLogo(
                    request.params.accountId,
                    undefined,
                    request,
                    response,
                    next
                );
            },
        },
        listVisuals: {
            ...appRoutes.listVisuals,
            serviceMethod: withService((service, request) => {
                const { params: { binderId, options: optionsSerialized } } = request;
                const options = optionsSerialized && optionsSerialized !== ":options" && JSON.parse(optionsSerialized);
                return service.listVisuals(
                    request,
                    binderId,
                    options,
                );
            }),
            authentication: ApplicationToken,
            authorization: docRead("binderId"),
        },
        getFeedbackAttachmentVisuals: {
            ...appRoutes.getFeedbackAttachmentVisuals,
            serviceMethod: withService((service, request) => {
                const { body: { options: optionsSerialized } } = request;
                const options = optionsSerialized && optionsSerialized !== ":options" && JSON.parse(optionsSerialized);
                return service.getFeedbackAttachmentVisuals(
                    request,
                    request.body.binderId,
                    options,
                );
            }),
            authentication: ApplicationToken,
            authorization: docRead("binderId"),
        },
        getVisual: {
            ...appRoutes.getVisual,
            serviceMethod: withService((service, request) => {
                const { params: { binderId, visualId, options: optionsSerialized } } = request;
                const options = optionsSerialized && optionsSerialized !== ":options" && JSON.parse(optionsSerialized);
                return service.getVisual(
                    request,
                    binderId,
                    visualId,
                    options,
                );
            }),
            authentication: ApplicationToken,
            authorization: docRead("binderId"),
        },
        getVisualByOriginalVisualData: {
            ...appRoutes.getVisualByOriginalVisualData,
            serviceMethod: withService((service, request) => {
                return service.getVisualByOriginalVisualData(
                    request,
                    request.params.originalBinderId,
                    request.params.originalVisualId,
                    request.params.binderId,
                );
            }),
        },
        duplicateVisuals: {
            ...appRoutes.duplicateVisuals,
            serviceMethod: withService((service, request) => {
                return service.duplicateVisuals(
                    request,
                    request.params.binderId,
                    request.params.targetId
                );
            }),
        },

        uploadVisual: {
            ...appRoutes.uploadVisual,
            serviceHandler: (request, response, next) => {
                const options = request.query.options ? JSON.parse(decodeURIComponent(request.query.options as string)) : {};
                return imageServiceBuilder.uploadVisual(
                    request.params.binderId,
                    undefined,
                    request.params.accountId,
                    request,
                    response,
                    next,
                    options,
                );
            },
            authentication: ApplicationToken,
            authorization: MultiAuthorizationOr([
                docEdit("binderId"),
                MultiAuthorizationAnd([
                    featureEnabled(FEATURE_READER_COMMENTING),
                    docRead("binderId"),
                    readerCommentsEnabledForItem("binderId"),
                ])
            ])
        },

        deleteImage: {
            ...appRoutes.deleteImage,
            serviceMethod: withService((service, request) => {
                return service.deleteImage(
                    request,
                    request.params.binderId,
                    request.params.imageId
                );
            }),
            authentication: ApplicationToken,
            authorization: docEdit("binderId")
        },
        deleteVisuals: {
            ...appRoutes.deleteVisuals,
            serviceMethod: withService((service, request) => {
                return service.deleteVisuals(
                    request,
                    request.body.binderId,
                    request.body.visualIds
                );
            }),
        },
        hardDeleteVisual: {
            ...appRoutes.hardDeleteVisual,
            serviceMethod: withService((service, request) => {
                return service.hardDeleteVisual(
                    request,
                    request.params.binderId,
                    request.params.visualId,
                );
            }),
        },
        hardDeleteVisuals: {
            ...appRoutes.hardDeleteVisuals,
            serviceMethod: withService((service, request) => {
                return service.hardDeleteVisuals(
                    request,
                    request.body.filter,
                );
            }),
        },
        updateVisualFitBehaviour: {
            ...appRoutes.updateVisualFitBehaviour,
            serviceMethod: withService((service, request) => {
                return service.updateVisualFitBehaviour(
                    request,
                    request.params.binderId,
                    request.params.visualId,
                    request.params.fitBehaviour as VisualFitBehaviour
                );
            }),
            authentication: ApplicationToken,
            authorization: docEdit("binderId"),
        },
        updateVisualRotation: {
            ...appRoutes.updateVisualRotation,
            serviceMethod: withService((service, request) => {
                return service.updateVisualRotation(
                    request,
                    request.params.binderId,
                    request.params.visualId,
                    request.params.rotation,
                );
            }),
            authentication: ApplicationToken,
            authorization: docEdit("binderId"),
        },
        updateVisualBgColor: {
            ...appRoutes.updateVisualBgColor,
            serviceMethod: withService((service, request) => {
                return service.updateVisualBgColor(
                    request,
                    request.params.binderId,
                    request.params.visualId,
                    request.params.bgColor
                );
            }),
            authentication: ApplicationToken,
            authorization: docEdit("binderId"),
        },
        updateVisualLanguageCodes: {
            ...appRoutes.updateVisualLanguageCodes,
            serviceMethod: withService((service, request) => {
                return service.updateVisualLanguageCodes(
                    request,
                    request.params.binderId,
                    request.params.visualId,
                    request.body.languageCodes
                );
            }),
            authentication: ApplicationToken,
            authorization: docEdit("binderId"),
        },
        updateVisualAudio: {
            ...appRoutes.updateVisualAudio,
            serviceMethod: withService((service, request) => {
                return service.updateVisualAudio(
                    request,
                    request.params.binderId,
                    request.params.visualId,
                    request.body.enabled,
                );
            }),
            authentication: ApplicationToken,
            authorization: docEdit("binderId"),
        },
        updateVisualAutoPlay: {
            ...appRoutes.updateVisualAutoPlay,
            serviceMethod: withService((service, request) => {
                return service.updateVisualAutoPlay(
                    request,
                    request.params.binderId,
                    request.params.visualId,
                    request.body.autoPlay
                );
            }),
            authentication: ApplicationToken,
            authorization: docEdit("binderId")
        },
        restartVideoProcessing: {
            ...appRoutes.restartVideoProcessing,
            serviceMethod: withService((service, request) => service.restartVideoProcessing(request)),
        },
        downloadScreenshot: {
            ...appRoutes.downloadScreenshot,
            serviceHandler: (request, response, next) => {
                const viewportWidth = parseInt(request.query.w as string, 10)
                const viewportHeight = parseInt(request.query.h as string, 10)
                return imageServiceBuilder.downloadScreenshot(
                    request.params.binderId,
                    request.params.visualId,
                    request.params.keyFrame,
                    request.params.format,
                    request,
                    response,
                    next,
                    viewportWidth,
                    viewportHeight,
                );
            },
            authentication: Public,
            authorization: buildUrlTokenAuth(req => ({ type: ResourceType.DOCUMENT, ids: [req.params.binderId] })),
        },
        downloadLogo: {
            ...appRoutes.downloadLogo,
            serviceHandler: (request, response, next) => {
                return imageServiceBuilder.downloadLogo(
                    request.params.accountId,
                    request.params.logoId,
                    request,
                    response,
                    next
                );
            },
            authentication: Public,
            authorization: buildUrlTokenAuth(req => ({ type: ResourceType.ACCOUNT, ids: [req.params.accountId], scopes: [AccountAclScope.BRANDING] })),
        },
        downloadVisualBestFit: {
            ...appRoutes.downloadVisualBestFit,
            serviceHandler: (request, response, next) => {
                const viewportWidth = parseInt(request.query.w as string, 10)
                const viewportHeight = parseInt(request.query.h as string, 10)
                return imageServiceBuilder.downloadVisualBestFit(
                    request.params.binderId,
                    request.params.visualId,
                    viewportWidth,
                    viewportHeight,
                    request,
                    response,
                    next
                );
            },
            authentication: Public,
            authorization: buildUrlTokenAuth(req => ({ type: ResourceType.DOCUMENT, ids: [req.params.binderId] })),
        },
        downloadVisual: {
            ...appRoutes.downloadVisual,
            serviceHandler: (request, response, next) => {
                return imageServiceBuilder.downloadVisual(
                    request.params.binderId,
                    request.params.visualId,
                    request.params.format,
                    request,
                    response,
                    next,
                );
            },
            authentication: Public,
            authorization: buildUrlTokenAuth(req => ({ type: ResourceType.DOCUMENT, ids: [req.params.binderId] })),
        },
        // downloadAvatar: {
        //     ...appRoutes.downloadAvatar,
        //     serviceHandler: (request, response, next) => {
        //         return imageServiceContractBuilder.downloadAvatar(
        //             request.params.userId,
        //             request,
        //             response,
        //             next
        //         );
        //     },
        //     ...defaultAccess
        // },
        downloadFont: {
            ...appRoutes.downloadFont,
            serviceHandler: (request, response, next) => {
                return imageServiceBuilder.downloadFont(
                    request.params.name,
                    request.params.weight,
                    request.params.style,
                    request,
                    response,
                    next
                );
            },
            authentication: Public,
            authorization: Allow,
        },
        downloadFontFace: {
            ...appRoutes.downloadFontFace,
            serviceHandler: (request, response, next) => {
                return imageServiceBuilder.downloadFontFace(
                    request.params.name,
                    request,
                    response,
                    next
                );
            },
            authentication: Public,
            authorization: Allow,
        },
        queryVideoDurations: {
            ...appRoutes.queryVideoDurations,
            serviceMethod: withService((service, request) => {
                return service.queryVideoDurations(
                    request,
                    request.body.videoIds,
                );
            }),
        },
        downloadManifest: {
            ...appRoutes.downloadManifest,
            serviceHandler: (request, response, next) => {
                return imageServiceBuilder.downloadManifest(
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    request.params.assetId as any,
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    request.params.manifest as any,
                    request.query.token as string,
                    request.query.streamingHostname as string,
                    request,
                    response,
                    next,
                );
            },
            authentication: Public,
            authorization: Allow,
        },
        manifestProxy: {
            ...appRoutes.manifestProxy,
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            serviceHandler: (request, response, next) => {
                return imageServiceBuilder.manifestProxy(
                    request.params.assetId as string,
                    request.params.qualityLevel as string,
                    request.params.manifest as string,
                    request.query.token as string,
                    request.query.streamingHostname as string,
                    request,
                    response,
                );
            },
            authentication: Public,
            authorization: Allow,
        },
        hlsProxy: {
            ...appRoutes.hlsProxy,
            serviceHandler: (request, response) => {
                return imageServiceBuilder.hlsProxy(
                    request.params.targetUrl,
                    request.params.token,
                    response,
                    request.logger
                )
            },
            authentication: Public,
            authorization: Allow
        },
        composeVisualFormatUrls: {
            ...appRoutes.composeVisualFormatUrls,
            serviceMethod: withService((service, request) => {
                return service.composeVisualFormatUrls(
                    request,
                    request.body.visualIds,
                    request.body.options,
                );
            }),
        },
        videoIndexerCallback: {
            ...appRoutes.videoIndexerCallback,
            serviceMethod: withService((service, request) => {
                return service.videoIndexerCallback(
                    request,
                    request.query.id as string,
                    request.query.state as string,
                );
            }),
            authentication: Public,
            authorization: Allow,
        },
        findVideoIndexerResults: {
            ...appRoutes.findVideoIndexerResults,
            serviceMethod: withService((service, request) => {
                return service.findVideoIndexerResults(
                    request,
                    JSON.parse(request.params.filter) as IVideoIndexerResultFilter,
                );
            }),
            authentication: Public,
            authorization: Allow,
        },
        indexVideo: {
            ...appRoutes.indexVideo,
            serviceMethod: withService((service, request) => {
                return service.indexVideo(
                    request,
                    request.body.visualId,
                    request.body.accountId,
                );
            }),
            authentication: Public,
            authorization: Allow,
        },
        getVisualIdByImageUrl: {
            ...appRoutes.getVisualIdByImageUrl,
            serviceMethod: withService((service, request) => service
                .getVisualIdByImageUrl(
                    request,
                    request.body.url
                )
            ),
        },
        createVideoSasTokens: {
            ...appRoutes.createVideoSasTokens,
            serviceMethod: withService((service, request) => service
                .createVideoSasTokens(
                    request,
                    request.body.videoIds
                )
            ),
            authentication: ApplicationTokenOrPublic,
            authorization: visualsRead(req => req.body.videoIds)
        },
        ensureScreenshotAt: {
            ...appRoutes.ensureScreenshotAt,
            serviceMethod: withService((service, request) => (
                service.ensureScreenshotAt(
                    request,
                    request.body.binderId,
                    request.body.visualId,
                    request.body.timestampMs,
                    request.body.accountId,
                )
            )),
            authorization: docEdit("binderId"),
            authentication: ApplicationToken
        }
    };
}