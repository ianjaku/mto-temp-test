import { BinderStatus, FindBindersStatusesQueryParams } from "../../repositoryservice/v3/contract";
import { BindersServiceClient, RequestHandler } from "../../client";
import { GlobalUsagePerMonthRow, UserActionType } from "../../trackingservice/v1/contract";
import PublicAPIContract, {
    CreateUserResult,
    DeleteUserResult,
    IPublicApiUserActionFilter,
    IPublicApiUserActionSummary,
    PlgSignupContext,
    TallyWebhookPayload
} from "./contract";
import { BindersServiceClientConfig } from "../../config";
import { Config } from "../../../config";
import { UploadableFile } from "../../imageservice/v1/contract";
import getRoutes from "./routes";

export class PublicApiServiceClient
    extends BindersServiceClient
    implements Partial<PublicAPIContract> {
    constructor(endpointPrefix: string, requestHandler: RequestHandler) {
        super(endpointPrefix, getRoutes(), requestHandler);
    }

    findBindersStatuses(options: FindBindersStatusesQueryParams = {}): Promise<BinderStatus[]> {
        return this.handleRequest("findBindersStatuses", {
            queryParams: options
        });
    }

    generateApiToken(
        accountId: string,
    ): Promise<string> {
        return this.handleRequest("generateApiToken", {
            body: {
                accountId,
            }
        });
    }

    getApiToken(
        accountId: string,
    ): Promise<string> {
        return this.handleRequest("getApiToken", {
            pathParams: {
                accountId,
            }
        });
    }

    createUser(
        accountId: string,
        login: string,
        displayName: string,
        firstName?: string,
        lastName?: string,
        password?: string
    ): Promise<CreateUserResult> {
        return this.handleRequest("createUser", {
            pathParams: {
                accountId,
            },
            body: {
                login,
                displayName,
                firstName,
                lastName,
                password,
            }
        });
    }

    deleteUser(
        accountId: string,
        userId: string,
    ): Promise<DeleteUserResult> {
        return this.handleRequest("deleteUser", {
            pathParams: {
                accountId,
                userId,
            }
        });
    }

    static fromConfig(
        config: Config,
        version: string,
        requestHandler: RequestHandler
    ): PublicApiServiceClient {
        const versionedPath = BindersServiceClientConfig.getVersionedPath(
            config,
            "public-api",
            version
        );
        return new PublicApiServiceClient(versionedPath, requestHandler);
    }

    globalUsagePerMonth(): Promise<GlobalUsagePerMonthRow[]> {
        return this.handleRequest("globalUsagePerMonth", {})
    }

    async tallyWebhookPlgSignup(payload: TallyWebhookPayload, signupContext: PlgSignupContext): Promise<void> {
        return this.handleRequest("tallyWebhookPlgSignup", {
            headers: {
                "x-binders-template-collection-id": signupContext.templateCollectionId,
                "x-binders-trial-account-id": signupContext.trialAccountId,
                "tally-signature": signupContext.tallySignature,
            },
            body: payload,
        });
    }

    async searchUserActions(
        filter: IPublicApiUserActionFilter,
    ): Promise<IPublicApiUserActionSummary[]> {
        return this.handleRequest("searchUserActions", {
            pathParams: {
                accountId: filter.accountId,
            },
            queryParams: {
                binderIds: filter.binderIds?.join(","),
                endIso8601Date: filter.endIso8601Date ? new Date(filter.endIso8601Date).toISOString() : undefined,
                endUtcTimestamp: filter.endUtcTimestamp,
                itemIds: filter.itemIds?.join(","),
                skipOwnerReadActions: filter.skipOwnerReadActions ? String(true) : undefined,
                skipUnpublished: filter.skipUnpublished ? String(true) : undefined,
                startIso8601Date: filter.startIso8601Date ? new Date(filter.startIso8601Date).toISOString() : undefined,
                startUtcTimestamp: filter.startUtcTimestamp,
                userActionTypes: filter.userActionTypes?.map(e => UserActionType[e]).join(","),
                userGroupIds: filter.userGroupIds?.join(","),
                userIds: filter.userIds?.join(","),
            },
        });
    }

    generateOneTakeManual(accountId: string, collectionId: string, attachments: UploadableFile[]): Promise<{ readerLink: string }> {
        return this.handleUpload("generateOneTakeManual", { pathParams: { accountId, collectionId } }, { file: attachments });
    }
}
