import { ApiTokenRepository, ApiTokenRepositoryFactory } from "./repositories/apiTokensRepository";
import {
    BackendAccountServiceClient,
    BackendContentServiceClient,
    BackendCredentialServiceClient,
    BackendImageServiceClient,
    BackendRepoServiceClient,
    BackendRoutingServiceClient,
    BackendTrackingServiceClient,
    BackendUserServiceClient
} from "@binders/binders-service-common/lib/apiclient/backendclient";
import {
    BinderStatus,
    DocumentCollection,
    FindBindersStatusesQueryParams,
    Publication
} from "@binders/client/lib/clients/repositoryservice/v3/contract";
import { CollectionConfig, getMongoLogin } from "@binders/binders-service-common/lib/mongo/config";
import LaunchDarklyService, {
    IFeatureFlagService
} from "@binders/binders-service-common/lib/launchdarkly/server";
import { PlgError, PublicApiError } from "./errorhandler";
import PublicAPIContract, {
    CreateUserResult,
    DeleteUserResult,
    IPublicApiUserActionFilter,
    IPublicApiUserActionSummary,
    PlgSignupContext,
    PublicCollection,
    PublicPublication,
    PublicationNotFound,
    TallyWebhookPayload,
    ViewPortDimensions
} from "@binders/client/lib/clients/publicapiservice/v1/contract";
import {
    ServerEvent,
    captureServerEvent
} from "@binders/binders-service-common/lib/tracking/capture";
import { UploadableFile, Visual } from "@binders/client/lib/clients/imageservice/v1/contract";
import { User, UserType } from "@binders/client/lib/clients/userservice/v1/contract";
import {
    extractIdFromUrl,
    isPlaceholderVisual
} from "@binders/client/lib/clients/imageservice/v1/visuals";
import { AccountServiceClient } from "@binders/client/lib/clients/accountservice/v1/client";
import { ApiTokenModel } from "./repositories/models/apiTokenModel";
import { AuthenticatedSession } from "@binders/client/lib/clients/model";
import {
    AuthorizationServiceClient
} from "@binders/client/lib/clients/authorizationservice/v1/client";
import {
    BackendAuthorizationServiceClient
} from "@binders/binders-service-common/lib/authorization/backendclient";
import {
    BinderRepositoryServiceClient
} from "@binders/client/lib/clients/repositoryservice/v3/client";
import { Config } from "@binders/client/lib/config/config";
import { ContentServiceClient } from "@binders/client/lib/clients/contentservice/v1/client";
import { CredentialServiceClient } from "@binders/client/lib/clients/credentialservice/v1/client";
import { GlobalUsagePerMonthRow } from "@binders/client/lib/clients/trackingservice/v1/contract";
import { ImageServiceClient } from "@binders/client/lib/clients/imageservice/v1/client";
import { LDFlags } from "@binders/client/lib/launchdarkly";
import { Logger } from "@binders/binders-service-common/lib/util/logging";
import { ManageMemberTrigger } from "@binders/client/lib/clients/accountservice/v1/contract";
import { ONE_YEAR } from "@binders/client/lib/util/time";
import { RoutingServiceClient } from "@binders/client/lib/clients/routingservice/v1/client";
import { TrackingServiceClient } from "@binders/client/lib/clients/trackingservice/v1/client";
import { UserServiceClient } from "@binders/client/lib/clients/userservice/v1/client";
import { WebRequest } from "@binders/binders-service-common/lib/middleware/request";
import collectionFormatter from "./formatters/collection";
import { getReaderLocationForAccount } from "@binders/binders-service-common/lib/util/url";
import { getTallyField } from "@binders/binders-service-common/lib/tally";
import { getUserName } from "@binders/client/lib/clients/userservice/v1/helpers";
import i18next from "@binders/client/lib/i18n";
import publicationFormatter from "./formatters/publication";
import { splitEvery } from "ramda";

const getRepoClient = async (config: Config, user: AuthenticatedSession, accountIdProvider?: () => string) => {
    return BackendRepoServiceClient.fromConfig(config, "public-api", user.jwt, accountIdProvider);
};


const getTrackingService = async (config: Config) => {
    return BackendTrackingServiceClient.fromConfig(config, "public-api");
}

/** Headers that are forwarded to the binders service for the one take manual. */
const FORWARDED_HEADER_NAMES = [
    "host",
    "user-agent",
    "content-length",
    "accept",
    "content-type",
    "x-forwarded-for",
    "x-forwarded-host",
    "x-forwarded-proto",
    "accept-encoding",
];

type UserResult = User & { alreadyExists: boolean };
export class PublicApiService implements PublicAPIContract {

    constructor(
        private readonly config: Config,
        private readonly apiTokenRepo: ApiTokenRepository,
        private readonly authorizationClient: AuthorizationServiceClient,
        private readonly contentClient: ContentServiceClient,
        private readonly credentialClient: CredentialServiceClient,
        private readonly repoClient: BinderRepositoryServiceClient,
        private readonly userClient: UserServiceClient,
        private readonly imageClient: ImageServiceClient,
        private readonly accountClient: AccountServiceClient,
        private readonly routingClient: RoutingServiceClient,
        private readonly trackingClient: TrackingServiceClient,
        private readonly featureFlagService: IFeatureFlagService,
        private readonly logger: Logger,
    ) { }

    async findBindersStatuses(
        session?: AuthenticatedSession,
        options: FindBindersStatusesQueryParams = {}
    ): Promise<BinderStatus[]> {
        const accountId = this.resolveAccountId(session);
        const binderRepo = await getRepoClient(this.config, session, () => accountId);
        return await binderRepo.findBindersStatuses(accountId, options);
    }

    private async populateCollection(
        collection: DocumentCollection,
        repoClient: BinderRepositoryServiceClient,
    ): Promise<PublicCollection> {
        const collectionElements = await repoClient.findItemsForEditor(
            {
                binderIds: [...collection.elements.map(c => c.key), collection.id],
                accountId: collection.accountId,
            },
            {
                cdnnify: true,
                binderSearchResultOptions: {
                    maxResults: collection.elements.length + 1,
                    summary: false,
                    omitContentModules: true,
                },
                ancestorThumbnailsOptions: {
                    inheritAncestorThumbnails: true,
                }
            },
            collection.accountId,
        );
        const fullCollection = <DocumentCollection>collectionElements.find(
            c => c.id === collection.id
        );
        return collectionFormatter(
            fullCollection,
            [],
            collectionElements.filter(c => c.id !== collection.id),
            this.getVisualFromImageService(fullCollection),
        );
    }

    async listCollections(user?: AuthenticatedSession): Promise<PublicCollection[]> {
        const accounts = await this.accountClient.getAccountsForUser(user.userId);
        if (!accounts) {
            throw new Error(`No accounts for userId ${user.userId}`);
        }

        const accountIds = accounts.map(acc => acc.id);
        const repoClient = await getRepoClient(this.config, user);
        const collections = await repoClient.findCollectionsFromClient({ accountIds }, { maxResults: 10000 });
        const collectionBatches = splitEvery(5, collections);

        const publicCollections = collectionBatches.reduce(async (reducedPromise, collectionBatch) => {
            const reduced = await reducedPromise;
            const publicCollectionBatch = await Promise.all(
                collectionBatch.map(collection => this.populateCollection(collection, repoClient))
            );
            return reduced.concat(publicCollectionBatch);
        }, Promise.resolve([] as PublicCollection[]));

        return publicCollections;
    }

    resolveAccountId(user?: AuthenticatedSession): string | undefined {
        if (!user) {
            this.logger.error("User is required", "PublicApiService.resolveUserAccount");
            throw new Error("User is required");
        }
        if ((user.accountIds || []).length === 0) {
            this.logger.error("No accountIds found in user", "PublicApiService.resolveUserAccount");
            throw new Error("No accountIds found in user");
        }
        if (user.accountIds.length > 1) this.logger.warn(`Session has multiple accountIds in scope (${user.accountIds.join()}). Using first one for request`, "PublicApiService.resolveUserAccount");
        return user.accountIds[0];
    }

    async findCollection(
        collectionId: string,
        user?: AuthenticatedSession,
    ): Promise<PublicCollection> {
        const accountId = this.resolveAccountId(user);
        const repoClient = await getRepoClient(this.config, user, () => accountId);
        const collection = await repoClient.getCollection(collectionId);
        return this.populateCollection(collection, repoClient);
    }

    private getVisualFromImageService(
        collection: DocumentCollection,
    ): () => Promise<Visual> {
        return async () => {
            if (isPlaceholderVisual(collection.thumbnail.medium)) {
                return null;
            }
            const urlWithActiveImageId = collection.thumbnail.medium;
            const imageId = extractIdFromUrl(urlWithActiveImageId);
            if (imageId == null) return null;
            const targetId = collection.thumbnail?.ancestorCollectionId ?? collection.id;
            const visuals = await this.imageClient.listVisuals(targetId);
            if (visuals == null || visuals.length === 0) return null;
            for (const visual of visuals) {
                if (
                    visual.id === imageId ||
                    visual?.originalVisualData?.originalId === imageId
                ) {
                    return visual;
                }
            }
            return visuals[visuals.length - 1];
        };
    }

    async findPublication(
        accountId: string,
        documentId: string,
        languageCode: string,
        format: "html" | "richtext",
        dimensions: ViewPortDimensions,
        user?: AuthenticatedSession,
    ): Promise<PublicPublication> {
        const repoClient = await getRepoClient(this.config, user, () => accountId);
        try {
            const result = await repoClient.findPublications(
                documentId,
                {
                    languageCodes: [languageCode],
                    isActive: 1,
                },
                {
                    cdnnify: true,
                    binderSearchResultOptions: {
                        maxResults: 1,
                        summary: false,
                    },
                },
            );
            if (result.length === 0) {
                throw new PublicationNotFound(`Could not find ${languageCode} publication for document ${documentId}`);
            }

            const publication = result[0];
            const visuals = await this.imageClient.listVisuals(documentId, { cdnnify: true });
            return publicationFormatter(<Publication>publication, format, visuals, dimensions);
        } catch (err) {
            if (err.statusCode == 404) {
                throw new PublicationNotFound(`Could not find ${languageCode} publication for document ${documentId}`);
            }
            throw err;
        }
    }

    async generateApiToken(
        accountId: string,
        userId?: string,
        auditLog?: (token: string) => Promise<void>,
    ): Promise<string> {
        if (userId == null) throw new Error("UserId cannot be null");

        const existingToken = await this.apiTokenRepo.getForUser(accountId, userId);

        let newToken: ApiTokenModel;
        if (existingToken == null) {
            newToken = ApiTokenModel.create(accountId, userId);
        } else {
            newToken = existingToken.generateNewUuid();
        }
        auditLog(newToken.uuid);

        await this.apiTokenRepo.store(newToken);
        return newToken.uuid;
    }

    async getApiToken(accountId: string, userId?: string): Promise<string> {
        if (userId == null) throw new Error("UserId cannot be null");
        const token = await this.apiTokenRepo.getForUser(accountId, userId);
        if (token == null) return null;
        return token.uuid;
    }

    async globalUsagePerMonth(): Promise<GlobalUsagePerMonthRow[]> {
        const trackingserviceClient = await getTrackingService(this.config);
        const byMonth = await trackingserviceClient.globalUsagePerMonth();
        const results = [];
        for (const monthKey of Object.keys(byMonth)) {
            results.push({
                monthKey,
                ...byMonth[monthKey]
            });
        }
        return results;
    }

    async createUser(
        accountId: string,
        login: string,
        displayName: string,
        firstName?: string,
        lastName?: string,
        password?: string,
    ): Promise<CreateUserResult> {
        const user = await this.createOrFetch(login, displayName, firstName, lastName);
        if (user.alreadyExists) {
            await this.accountClient.addMember(accountId, user.id, ManageMemberTrigger.PUBLIC_API);
        } else {
            await Promise.all([
                password ? this.credentialClient.createCredential(user.id, user.login, password) : Promise.resolve(),
                this.accountClient.addMember(accountId, user.id, ManageMemberTrigger.PUBLIC_API),
            ]);
        }
        return { userId: user.id }
    }

    private async createOrFetch(login: string, displayName: string, firstName: string, lastName: string): Promise<UserResult> {
        try {
            const newUser = await this.userClient.createUser(
                login,
                getUserName({ displayName, firstName, lastName }),
                firstName,
                lastName,
                UserType.Individual,
            );
            return {
                ...newUser,
                alreadyExists: false,
            }
        } catch (e) {
            if (e.statusCode === 400 && e.errorDetails === "Login already in use") {
                const existingUser = await this.userClient.getUserByLogin(login);
                return {
                    ...existingUser,
                    alreadyExists: true,
                };
            }
            throw e;
        }
    }

    async deleteUser(
        accountId: string,
        userId: string,
    ): Promise<DeleteUserResult> {
        await this.accountClient.removeMember(accountId, userId, ManageMemberTrigger.PUBLIC_API);
        return { userId }
    }

    async tallyWebhookPlgSignup(
        tallyPayload: TallyWebhookPayload,
        signupContext: PlgSignupContext,
    ): Promise<void> {
        const { trialAccountId, templateCollectionId } = signupContext;
        const logData = { trialAccountId, templateCollectionId };
        try {
            const companyName = getTallyField("INPUT_TEXT", "Company name", tallyPayload);
            const firstName = getTallyField("INPUT_TEXT", "First name", tallyPayload);
            const lastName = getTallyField("INPUT_TEXT", "Last name", tallyPayload);
            const login = getTallyField("INPUT_EMAIL", "Work email", tallyPayload);
            await this.accountClient.bootstrapTrialEnvironment({
                trialAccountId,
                companyName,
                login,
                lastName,
                firstName,
                templateCollectionId,
            })
            this.logger.info("Boostrap successful.", "tallyWebhookPlgSignup", logData);
        } catch (err) {
            this.logger.logException(err, "tallyWebhookPlgSignup")
            this.logger.error(`Boostrap failed with ${err.message}. Webhook will not finish.`, "tallyWebhookPlgSignup", logData)
            throw new PlgError("Bootstrap failed", "bootstrap_failed")
        }
    }

    async searchUserActions(
        filter: IPublicApiUserActionFilter,
    ): Promise<IPublicApiUserActionSummary[]> {
        const startDate = filter.startUtcTimestamp ? new Date(filter.startUtcTimestamp) : filter.startIso8601Date;
        const endDate = filter.endUtcTimestamp ? new Date(filter.endUtcTimestamp) : filter.endIso8601Date;
        if (!startDate || !endDate) {
            throw new PublicApiError(
                "Date filter is missing. Please, specify `startUtcTimestamp`, or `startIso8601Date` and `endUtcTimestamp`, or `endIso8601Date` query parameters.",
                "date_filter_missing",
            );
        }
        if (endDate.getTime() < startDate.getTime()) {
            throw new PublicApiError(
                "Date filter is invalid. End date must follow the start date.",
                "date_filter_invalid",
            )
        }
        if (endDate.getTime() - startDate.getTime() > ONE_YEAR) {
            throw new PublicApiError(
                "Date filter is too wide. The maximum distance between start and end date is 1 year",
                "date_filter_too_wide",
            )
        }
        if (!filter.userActionTypes.length) {
            throw new PublicApiError(
                "User action type filter is missing. Please, specify `userActionTypes` query parameter.",
                "user_action_type_filter_missing",
            )
        }
        const result = await this.trackingClient.searchUserActions({
            accountId: filter.accountId,
            binderIds: filter.binderIds,
            itemIds: filter.itemIds,
            recursive: true,
            skipUnpublished: filter.skipUnpublished,
            startRange: {
                rangeStart: startDate,
                rangeEnd: endDate,
            },
            userGroupIds: filter.userGroupIds,
            userIds: filter.userIds,
            userIsAuthor: filter.skipOwnerReadActions,
            userActionTypes: filter.userActionTypes,
        });
        return result.userActions.map(ua => ({
            ...ua,
            userActionTranslationKey: undefined,
            userActionName: i18next.t(ua.userActionTranslationKey),
        }));
    }

    async #validateAllowedCollectionIdForOneTakeManual(collectionId: string): Promise<void> {
        const allowedCollectionIdsCSV = await this.featureFlagService.getFlag<string>(
            LDFlags.ONE_TAKE_MANUAL_FROM_CORP_SITE_ALLOWED_COLLECTION_IDS,
            {}
        );
        if (!allowedCollectionIdsCSV.includes(collectionId)) {
            this.logger.error(
                `Collection ID ${collectionId} is not in the allowed list`,
                "generateOneTakeManual",
                { collectionId, allowedCollectionIdsCSV }
            );
            throw new PublicApiError(
                "Target collection ID is not allowed for one-take manual generation",
                "target_collection_not_allowed"
            );
        }
    }

    async generateOneTakeManual(
        accountId: string,
        collectionId: string,
        _: UploadableFile[],
        request?: WebRequest,
    ): Promise<{ readerLink: string }> {
        await this.#validateAllowedCollectionIdForOneTakeManual(collectionId);
        const forwardHeaders: Record<string, string> = {};
        for (const name of FORWARDED_HEADER_NAMES) {
            const v = request?.headers?.[name];
            if (typeof v === "string") forwardHeaders[name] = v;
        }

        const uploadResult = await this.contentClient.forwardFileUpload(accountId, request, forwardHeaders);
        const fileId = uploadResult.fileId;
        const binder = await this.contentClient.generateManual({
            accountId,
            collectionId,
            fileIds: [fileId],
            userId: "public-api",
        });
        await this.repoClient.publish(binder.id, ["en"], false);
        await this.authorizationClient.grantPublicReadAccess(accountId, binder.id);
        const readerLink = await getReaderLocationForAccount(this.routingClient, accountId, `/launch/${binder.id}`);

        captureServerEvent(
            ServerEvent.OneTakeManualFromCorpSiteCreated,
            { accountId, userId: "anonymous-corp-site-user" },
            { collectionId, readerLink },
        );
        return { readerLink };
    }
}

export class PublicApiServiceFactory {

    constructor(
        private readonly config: Config,
        private readonly apiTokenRepoFactory: ApiTokenRepositoryFactory,
        private readonly authorizationClient: AuthorizationServiceClient,
        private readonly contentClient: ContentServiceClient,
        private readonly credentialClient: CredentialServiceClient,
        private readonly repoClient: BinderRepositoryServiceClient,
        private readonly userClient: UserServiceClient,
        private readonly imageClient: ImageServiceClient,
        private readonly accountClient: AccountServiceClient,
        private readonly routingClient: RoutingServiceClient,
        private readonly trackingClient: TrackingServiceClient,
        private readonly featureFlagService: IFeatureFlagService,
    ) { }

    forRequest(req: { logger: Logger }): PublicApiService {
        return new PublicApiService(
            this.config,
            this.apiTokenRepoFactory.build(req.logger),
            this.authorizationClient,
            this.contentClient,
            this.credentialClient,
            this.repoClient,
            this.userClient,
            this.imageClient,
            this.accountClient,
            this.routingClient,
            this.trackingClient,
            this.featureFlagService,
            req.logger,
        );
    }

    static async fromConfig(
        config: Config,
        logger: Logger
    ): Promise<PublicApiServiceFactory> {
        const mongoLogin = getMongoLogin("public_api");
        const collectionConfig = await CollectionConfig.promiseFromConfig(config, "apitokens", mongoLogin);
        const authorizationClient = await BackendAuthorizationServiceClient.fromConfig(config, "public-api");
        const contentClient = await BackendContentServiceClient.fromConfig(config, "public-api");
        const credentialClient = await BackendCredentialServiceClient.fromConfig(config, "public-api");
        const repoClient = await BackendRepoServiceClient.fromConfig(config, "public-api");
        const userClient = await BackendUserServiceClient.fromConfig(config, "public-api");
        const imageClient = await BackendImageServiceClient.fromConfig(config, "public-api");
        const accountClient = await BackendAccountServiceClient.fromConfig(config, "public-api");
        const routingClient = await BackendRoutingServiceClient.fromConfig(config, "public-api");
        const trackingClient = await BackendTrackingServiceClient.fromConfig(config, "public-api");
        const featureFlagService = await LaunchDarklyService.create(config, logger);
        const factory = new ApiTokenRepositoryFactory(collectionConfig, logger);
        return new PublicApiServiceFactory(
            config,
            factory,
            authorizationClient,
            contentClient,
            credentialClient,
            repoClient,
            userClient,
            imageClient,
            accountClient,
            routingClient,
            trackingClient,
            featureFlagService,
        );
    }

}
