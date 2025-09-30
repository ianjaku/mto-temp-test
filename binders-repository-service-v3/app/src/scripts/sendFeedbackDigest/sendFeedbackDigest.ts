/* eslint-disable no-console */
import {
    BackendCommentServiceClient,
    BackendRepoServiceClient,
    BackendRoutingServiceClient,
    BackendUserServiceClient
} from "@binders/binders-service-common/lib/apiclient/backendclient";
import {
    Binder,
    PublicationFindResult,
    UserOwner
} from "@binders/client/lib/clients/repositoryservice/v3/contract";
import {
    DomainFilter,
    ISemanticLink
} from "@binders/client/lib/clients/routingservice/v1/contract";
import { Logger, LoggerBuilder } from "@binders/binders-service-common/lib/util/logging";
import { MailgunConfig, MailgunMailer } from "@binders/binders-service-common/lib/mail/mailgun";
import { User, UserPreferences } from "@binders/client/lib/clients/userservice/v1/contract";
import { endOfDay, startOfDay, subDays } from "date-fns";
import { BinderComment } from "../../commentservice/repositories/models/binderComment";
import { BinderFeedbackModel } from "../../repositoryservice/repositories/feedbackrepository";
import {
    BinderRepositoryServiceClient
} from "@binders/client/lib/clients/repositoryservice/v3/client";
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import { CommentThreadOrigin } from "@binders/client/lib/clients/commentservice/v1/contract";
import { TransactionalMailMarkup } from "@binders/binders-service-common/lib/mail/markup";
import { buildMailMarkup } from "./mailMarkup";
import { buildUserName } from "@binders/client/lib/clients/userservice/v1/helpers";
import { createDigestInfo } from "./helpers";
import { sendMail } from "./mailSend";
import { uniq } from "ramda";

export type CommentInfo = BinderComment & { publicationId: string, binderId: string, accountId: string };
export type ActionableComment = CommentInfo & { userOwners: UserOwner[], commentThreadOrigin: CommentThreadOrigin };
export type ActionableFeedback = BinderFeedbackModel & { userOwners: UserOwner[], link: string };

export type LookupData = {
    domainFilters: DomainFilter[];
    preferencesMap: { [ownerId: string]: UserPreferences };
    binders: Binder[];
    publications: PublicationFindResult[];
    owners: User[];
    users: User[];
    semanticLinks: { [binderId: string]: ISemanticLink[] };
    devEditorLocation: string,
    logger: Logger,
}

export interface DigestInfo {
    comments: ActionableComment[];
    feedbacks: ActionableFeedback[];
}

export interface FeedbackMap {
    [ownerId: string]: DigestInfo;
}

export interface SendFeedbackDigestReport {
    [ownerId: string]: { mailHtml: string };
}

const composeMail = async (
    ownerId: string,
    digestInfo: DigestInfo,
    lookupData: LookupData,
): Promise<TransactionalMailMarkup | undefined> => {
    if (digestInfo.comments.length || digestInfo.feedbacks.length) {
        const ownerPreferences = lookupData.preferencesMap[ownerId];
        const ownerUser = lookupData.owners.find(u => u.id === ownerId);
        const userName = ownerUser && buildUserName(ownerUser, { preferFirstName: true, noFallbackToId: true });
        return buildMailMarkup(digestInfo, userName, lookupData, ownerPreferences);
    }
    return undefined;
}

const getLookupData = async (
    feedbackMap: FeedbackMap,
    repoServiceClient: BinderRepositoryServiceClient
): Promise<LookupData> => {
    const config = BindersConfig.get();
    const routingServiceClient = await BackendRoutingServiceClient.fromConfig(config, "sendFeedbackDigest");
    const userServiceClient = await BackendUserServiceClient.fromConfig(config, "sendFeedbackDigest");

    const ownerIds = Object.keys(feedbackMap);
    const accountIds = uniq(Object.values(feedbackMap).reduce((acc, digestInfo) =>
        [
            ...acc,
            ...digestInfo.comments.map(c => c.accountId),
            ...digestInfo.feedbacks.map(f => f.accountId),
        ], []));
    const publicationIds = uniq(Object.values(feedbackMap).reduce((acc, digestInfo) =>
        [
            ...acc,
            ...digestInfo.feedbacks.map(f => f.publicationId),
        ], []));
    const binderIds = uniq(Object.values(feedbackMap).reduce((acc, digestInfo) =>
        [
            ...acc,
            ...digestInfo.comments.map(c => c.binderId),
        ], []));
    const userIds = uniq(Object.values(feedbackMap).reduce((acc, digestInfo) =>
        [
            ...acc,
            ...digestInfo.comments.map(c => c.userId),
            ...digestInfo.feedbacks.map(f => f.userId),
        ], []))
        .filter(id => id != null);

    const domainFilters = accountIds.length && await routingServiceClient.getDomainFiltersForAccounts(accountIds, { includeBranding: true });
    const preferencesMap = ownerIds.length && await userServiceClient.getPreferencesMulti(ownerIds);
    const owners = ownerIds.length && await userServiceClient.getUsers(ownerIds);
    const binders = binderIds.length && await repoServiceClient.findBindersBackend({ ids: binderIds }, { maxResults: 9999 });
    const publications = publicationIds.length && await repoServiceClient.findPublicationsBackend({ ids: publicationIds }, { maxResults: 9999 });
    const users = userIds.length && await userServiceClient.findUserDetailsForIds(userIds);
    const semanticLinks = binderIds.length && await routingServiceClient.findSemanticLinksMulti(binderIds);
    const devEditorLocation = config.getString("services.editor.externalLocation").get();
    const logger = LoggerBuilder.fromConfig(config, "sendFeedbackDigest");
    return {
        domainFilters: domainFilters || [],
        preferencesMap: preferencesMap || {},
        owners: owners || [],
        binders: binders || [],
        publications: publications || [],
        users: users || [],
        semanticLinks: semanticLinks || {},
        devEditorLocation,
        logger,
    };
}

export const sendFeedbackDigest = async (
    digestPeriodDaysAgo: number,
    dryRun = false,
    accountId?: string
): Promise<SendFeedbackDigestReport> => {
    const config = BindersConfig.get();
    const repoServiceClient = await BackendRepoServiceClient.fromConfig(config, "sendFeedbackDigest");
    const commentServiceClient = await BackendCommentServiceClient.fromConfig(config, "sendFeedbackDigest");

    const createdAfter = startOfDay(subDays(new Date(), digestPeriodDaysAgo));
    const createdBefore = endOfDay(subDays(new Date(), digestPeriodDaysAgo));

    const newComments = await commentServiceClient.getComments({ createdAfter, createdBefore });
    const newFeedbacks = await repoServiceClient.getFeedbacks({ createdAfter, createdBefore, accountId });
    const mailgunConfig = await MailgunConfig.fromConfig(config);
    const mailer = new MailgunMailer(mailgunConfig.apiKey, mailgunConfig.domain);

    const feedbackMap = await createDigestInfo(newComments, newFeedbacks, commentServiceClient, repoServiceClient, accountId);

    if (!Object.keys(feedbackMap).length) {
        console.log("No feedback found");
        return undefined;
    }

    const lookupData = await getLookupData(feedbackMap, repoServiceClient);

    const report: SendFeedbackDigestReport = {};
    for (const [ownerId, digestInfo] of Object.entries(feedbackMap)) {
        try {
            const mailMarkup = await composeMail(ownerId, digestInfo, lookupData);
            if (!dryRun) {
                const owner = lookupData.owners.find(o => o.id === ownerId);
                await sendMail(mailer, mailMarkup, owner.login);
            }
            if (mailMarkup) {
                report[ownerId] = { mailHtml: mailMarkup.html };
            }
        } catch (e) {
            console.error("Error composing mail", e);
        }
    }

    return report;

}
