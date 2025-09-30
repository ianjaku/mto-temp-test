import { AuthenticatedSession, EntityNotFound } from "../../model";
import { GlobalUsagePerMonthRow, IFindUserActionsFilter, IUserActionSummary } from "../../trackingservice/v1/contract";
import { BinderStatus } from "../../repositoryservice/v3/contract";
import { UploadableFile } from "../../imageservice/v1/contract";

export type FitBehavior = "fit" | "crop";

export type TextChunk = {
    content: string;
};

export type VisualChunk = {
    bgColor?: string;
    mime: string;
    fitBehavior: FitBehavior;
    id: string;
    url: string;
};

export type PublicPublication = {
    id: string;
    documentId: string;
    languageCode: string;
    title: string;
    coverVisual: VisualChunk;
    textChunks: TextChunk[];
    visualChunks: VisualChunk[][];
};

export type ViewPortDimensions = {
    width: number;
    height: number;
};

export type PublicItemTitles = {
    [languageCode: string]: string
};

export type PublicCollectionItem = {
    id: string;
    kind: "document" | "collection";
    titles: PublicItemTitles;
}

export type PublicCollection = {
    id: string;
    coverVisual: VisualChunk;
    titles: PublicItemTitles;
    items: PublicCollectionItem[];
};

export type CreateUserResult = {
    userId: string;
}
export type DeleteUserResult = {
    userId: string;
}

export interface PublicAPIContract {
    findBindersStatuses(): Promise<BinderStatus[]>;

    listCollections(): Promise<PublicCollection[]>;
    findPublication(
        accountId: string,
        documentId: string,
        languageCode: string,
        format: "html" | "richtext",
        viewportDimensions: ViewPortDimensions,
        user?: AuthenticatedSession,
    ): Promise<PublicPublication>;
    findCollection(collectionId: string): Promise<PublicCollection>;

    generateApiToken(accountId: string): Promise<string>;
    getApiToken(accountId: string): Promise<string | null>;
    globalUsagePerMonth(): Promise<GlobalUsagePerMonthRow[]>;

    createUser(
        accountId: string,
        login: string,
        displayName: string,
        firstName?: string,
        lastName?: string,
        password?: string
    ): Promise<CreateUserResult>;
    deleteUser(accountId: string, userId: string): Promise<DeleteUserResult>;

    tallyWebhookPlgSignup(payload: TallyWebhookPayload, signupContext: PlgSignupContext): Promise<void>;
    searchUserActions(
        filter: IPublicApiUserActionFilter,
    ): Promise<IPublicApiUserActionSummary[]>;
    generateOneTakeManual(accountId: string, collectionId: string, attachments: UploadableFile[]): Promise<{ readerLink: string }>;
}

export type IPublicApiUserActionFilter = Pick<IFindUserActionsFilter,
    | "accountId"
    | "binderIds"
    | "itemIds"
    | "skipUnpublished"
    | "userActionTypes"
    | "userGroupIds"
    | "userIds"
> & {
    startUtcTimestamp?: number,
    endUtcTimestamp?: number,
    skipOwnerReadActions?: boolean,
    startIso8601Date?: Date,
    endIso8601Date?: Date,
}

export type IPublicApiUserActionSummary = Omit<IUserActionSummary, "userActionTranslationKey"> & {
    userActionName: string;
};

export type TallyWebhookPayload = {
    eventId: string;
    createdAt: string;
    data: {
        responseId: string;
        submissionId: string;
        respondentId: string;
        formId: string;
        formName: string;
        createdAt: string;
        fields: {
            key: string;
            label: string;
            type: string;
            value: string;
        }[];
    };
}

export type PlgSignupContext = {
    tallySignature: string;
    templateCollectionId: string;
    trialAccountId: string;
}

export class PublicationNotFound extends EntityNotFound { }

export default PublicAPIContract;
