import {
    DocumentAncestors,
    ReaderFeedbackConfig
} from "@binders/client/lib/clients/repositoryservice/v3/contract";
import {
    FEATURE_AG5,
    FEATURE_ANONYMOUS_RATING,
    FEATURE_READER_COMMENTING,
    FEATURE_READER_RATING,
    FEATURE_READ_CONFIRMATION
} from "@binders/client/lib/clients/accountservice/v1/contract";
import { AG5Client } from "./ag5/client";
import { IReaderFeedbackConfigRepository } from "../repositories/readerFeedbackConfigRepository";
import { Logger } from "@binders/binders-service-common/lib/util/logging";

/**
 * Computes the {@link ReaderFeedbackConfig} for an item based on its config
 * or when missing, the aggregated config of its parents.
 * Note: Resolved configurations will resolve `undefined` flag values to `true`
 * @param itemId the id of the item to resolve the config for
 * @param ancestors a {@link DocumentAncestors} record of item id and its direct parents
 * @param configs the configs of the item and all its ancestors
 */
export function resolveReaderFeedbackConfigForItem(
    itemId: string,
    ancestors: DocumentAncestors,
    configs: Record<string, ReaderFeedbackConfig>
): ReaderFeedbackConfig {
    const parentsWithConfig: ReaderFeedbackConfig[] = [];
    const visitedIds = new Set<string>();
    const toVisit = [itemId];
    while (toVisit.length > 0) {
        const currentItemId = toVisit.shift();
        const currentItemConfig = configs[currentItemId];
        if (isConfigDefined(currentItemConfig)) {
            parentsWithConfig.push(currentItemConfig);
        } else {
            const notVisitedAncestors = ancestors[currentItemId]?.filter(ancestorId => !visitedIds.has(ancestorId)) ?? [];
            toVisit.push(...notVisitedAncestors);
        }
        visitedIds.add(currentItemId);
    }

    if (parentsWithConfig.length === 0) {
        // Flag has been enabled but no item level feedback setting found, return defaults
        return {
            readerCommentsEnabled: true,
            readerRatingEnabled: true,
            readConfirmationEnabled: false,
        };
    }

    const aggregatedReaderCommentsEnabled = parentsWithConfig
        .map(config => config.readerCommentsEnabled ?? true)
        .some(config => config === true);

    const aggregatedReaderRatingEnabled = parentsWithConfig
        .map(config => config.readerRatingEnabled ?? true)
        .some(config => config === true);

    const aggregatedReadConfirmationEnabled = parentsWithConfig
        .map(config => config.readConfirmationEnabled ?? false)
        .some(config => config === true);

    return {
        readerCommentsEnabled: aggregatedReaderCommentsEnabled,
        readerRatingEnabled: aggregatedReaderRatingEnabled,
        readConfirmationEnabled: aggregatedReadConfirmationEnabled,
    };
}

/**
 * We consider a defined config, any config, that has at least one
 * of the properties set to a value that is not null or undefined
 */
function isConfigDefined(config?: ReaderFeedbackConfig): boolean {
    return config?.readerRatingEnabled != null || config?.readerCommentsEnabled != null || config?.readConfirmationEnabled != null;
}

export function isNoReaderFeedbackFeatureEnabled(accountFeatures: string[]): boolean {
    return !accountFeatures.includes(FEATURE_READER_COMMENTING) &&
        !accountFeatures.includes(FEATURE_READER_RATING) &&
        !accountFeatures.includes(FEATURE_READ_CONFIRMATION);
}

export async function resolveReadConfirmationEnabled(
    itemId: string,
    accountFeatures: string[],
    readerFeedbackConfig: ReaderFeedbackConfig,
    logger: Logger,
): Promise<boolean> {
    if (accountFeatures.includes(FEATURE_READ_CONFIRMATION) && readerFeedbackConfig.readConfirmationEnabled) {
        return true;
    }
    if (accountFeatures.includes(FEATURE_AG5)) {
        try {
            const ag5Client = AG5Client.get();
            const skills = await ag5Client.getAllSkills();
            return skills.some(skill => skill.documentId === itemId);
        } catch (error) {
            logger.error(`Failed to fetch AG5 skills: ${error}`, "resolveReadConfirmationEnabled");
            return false;
        }
    }
    return false;
}

/**
 * Resolves the part of the reader feedback config that depends on the feature flag + config
 * It returns readerFeedbackConfig to be used in resolveReadConfirmationEnabled later on
 */
async function resolveStaticReaderFeedbackConfig(
    itemId: string,
    ancestors: DocumentAncestors,
    accountFeatures: string[],
    readerFeedbackConfigRepository: IReaderFeedbackConfigRepository,
    userId?: string
): Promise<Partial<ReaderFeedbackConfig> & { readerFeedbackConfig?: ReaderFeedbackConfig }> {
    if (isNoReaderFeedbackFeatureEnabled(accountFeatures)) {
        return {};
    }

    const ancestorItemIds = new Set(Object.values(ancestors).flatMap(ids => ids));
    const configs = await readerFeedbackConfigRepository.getForItems([...ancestorItemIds, itemId]);
    const readerFeedbackConfig = resolveReaderFeedbackConfigForItem(itemId, ancestors, configs);
    const readerRatingEnabled = accountFeatures.includes(FEATURE_READER_RATING) && readerFeedbackConfig.readerRatingEnabled;
    if (!userId) {
        return {
            readerCommentsEnabled: false,
            readerRatingEnabled: readerRatingEnabled && accountFeatures.includes(FEATURE_ANONYMOUS_RATING),
        };
    }
    const readerCommentsEnabled = accountFeatures.includes(FEATURE_READER_COMMENTING) && readerFeedbackConfig.readerCommentsEnabled;
    return { readerRatingEnabled, readerCommentsEnabled, readerFeedbackConfig };
}

export async function resolveReaderFeedbackConfig(
    itemId: string,
    ancestors: DocumentAncestors,
    accountFeatures: string[],
    readerFeedbackConfigRepository: IReaderFeedbackConfigRepository,
    logger: Logger,
    userId?: string
): Promise<ReaderFeedbackConfig> {
    const { readerCommentsEnabled, readerRatingEnabled, readerFeedbackConfig } = await resolveStaticReaderFeedbackConfig(
        itemId,
        ancestors,
        accountFeatures,
        readerFeedbackConfigRepository,
        userId,
    );
    const readConfirmationEnabled = userId && readerFeedbackConfig && await resolveReadConfirmationEnabled(
        itemId,
        accountFeatures,
        readerFeedbackConfig!,
        logger,
    );
    return {
        readerCommentsEnabled,
        readerRatingEnabled,
        readConfirmationEnabled,
    }
}