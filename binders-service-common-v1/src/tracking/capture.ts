import { createPosthogClient } from "./createPosthogClient";


// See capture.ts#EditorEvent for naming conventions
export enum ServerEvent {
    ContentV1AzureOpenAiUsageIncreased = "content-v1: Usage of Azure OpenAI API increased",
    ContentV1OptimizeBinderFirstFail = "content-v1: First call to LLM failed",
    ContentV1OptimizeBinderAllFailed = "content-v1: All retries to LLM failed",
    ContentV1OptimizeBinderDone = "content-v1: Binder optimized",

    ContentV1OneTakeManualFileUploaded = "content-v1: One Take Manual - File uploaded",
    ContentV1OneTakeManualUsageIncreased = "content-v1: One Take Manual - Usage increased",
    ContentV1OneTakeManualFailed = "content-v1: One Take Manual - Failed",
    ContentV1OneTakeManualTiming = "content-v1: One Take Manual - Timing",

    EnableFeature = "Enable feature",
    DisableFeature = "Disable feature",

    DocumentCreated = "Document Created",
    CollectionCreated = "Collection Created",
    DocumentPublished = "Document Published",
    DocumentEdited = "Document Edited",

    ReaderCommentCreated = "Comments: Reader Comment Created",
    CommentThreadResolved = "Comments: Comment Thread Resolved",
    EditorCommentThreadCreated = "Comments: Editor Comment Thread Created",
    EditorCommentCreated = "Comments: Editor Comment Created",

    RatingCreated = "Ratings: Rating Created",
    RatingUpdated = "Ratings: Rating Updated",

    InviteFormView = "Invite: Form View",
    InviteAcceptSuccess = "Invite: Accept Success",

    ReaderPageLoad = "Reader: Page Load",

    TrialEnvironmentBootstrapped = "Trial Environment: New environment was bootstrapped",

    AccountMemberAdded = "Account Member: Added",
    AccountMemberAddedMany = "Account Member: Added many",
    AccountMemberRemoved = "Account Member: Removed",

    AclUpdated = "ACL: Updated",

    PublicApiSearchUserActions = "public-api-v1: User Actions Search",

    DuplicateTextModuleKeys = "Duplicate text module keys detected", // MT-5467

    OneTakeManualFromCorpSiteCreated = "One Take Manual from corp site created",
}

export const captureServerEvent = async (
    name: ServerEvent,
    identity: {
        accountId: string,
        userId: string,
    },
    properties?: Record<string, unknown>
) => {
    const client = await createPosthogClient();
    if (client == null) return;
    client.capture({
        distinctId: identity.userId,
        event: "backend:" + name,
        properties,
        groups: {
            Account: identity.accountId
        }
    });
}

interface PosthogAccountProperties {
    name: string;
    membersCount: number;
    totalLicenses: number;
    maxNumberOfLicenses: number;
    totalPublicDocuments: number;
    maxPublicCount: number;
    createdAt: Date | string;
    expirationDate: Date | string;
    readerExpirationDate: Date | string;
    domain: string;
    enabledFeatures: string[];
    rootCollectionId: string;
}

export enum InternalToolEvent {
    PipelineResult = "pipeline-result",
    PipelineFailure = "pipeline-failure",
}

export async function captureInternalToolEvent(
    name: InternalToolEvent,
    properties: Record<string, unknown>,
    timestamp?: Date
) {

    const client = await createPosthogClient();
    client.capture({
        distinctId: "internal-tool",
        event: "internal-tool:" + name,
        properties,
        timestamp: timestamp || new Date()
    });
    await client.flush();
    await client.shutdown();
}

export const updatePosthogAccountProperties = async (
    accountId: string,
    properties: Partial<PosthogAccountProperties>
) => {
    const client = await createPosthogClient();
    if (client == null) return;
    client?.groupIdentify({
        groupType: "Account",
        groupKey: accountId,
        properties
    });
}
