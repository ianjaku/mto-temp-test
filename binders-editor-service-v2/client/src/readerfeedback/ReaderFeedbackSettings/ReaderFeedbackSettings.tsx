import * as React from "react";
import {
    InheritedSettingsItem,
    ReaderFeedbackConfig
} from "@binders/client/lib/clients/repositoryservice/v3/contract";
import {
    UpdateReaderFeedbackConfigParams,
    useItemAndAncestorsFeedbackConfigs,
} from "../../documents/hooks";
import { useCallback, useEffect, useMemo } from "react";
import { InheritedSettingsNavigator } from "../../shared/InheritedSettingsNavigator/InheritedSettingsNavigator";
import ReaderFeedbackSetting from "./ReaderFeedbackSetting";
import { TranslationKeys as TK } from "@binders/client/lib/react/i18n/translations";
import circularProgress from "@binders/ui-kit/lib/elements/circularprogress";
import { hasAnyReaderFeedbackDefined } from "./helpers";
import { omit } from "ramda";
import { useTranslation } from "@binders/client/lib/react/i18n";
import "./ReaderFeedbackSettings.styl";

export const ReaderFeedbackSettings: React.FC<{
    currentItem: InheritedSettingsItem;
    goToItem: (item: InheritedSettingsItem) => void;
    item: InheritedSettingsItem;
    setCurrentItem: (item: InheritedSettingsItem) => void;
    setUpdateParams: (params: UpdateReaderFeedbackConfigParams) => void;
    updateParams: UpdateReaderFeedbackConfigParams;
}> = ({
    currentItem,
    goToItem,
    item,
    setCurrentItem,
    setUpdateParams,
    updateParams,
}) => {
    const { t } = useTranslation();
    const { data = {}, isLoading: readerFeedbackConfigsLoading } = useItemAndAncestorsFeedbackConfigs(item?.id);

    const itemIds = Object.keys(data);
    const parentItems = Object.values(data)
        .filter(itemConfig => itemConfig.id !== item?.id)
        .map(itemConfig => omit(["config"], itemConfig));

    const dbReaderFeedbackConfigs = React.useMemo(() => {
        const configs: Record<string, ReaderFeedbackConfig> = {};
        for (const entry of Object.values(data)) {
            configs[entry.id] = {
                ...entry.config,
                itemId: entry.id,
            }
        }
        return configs;
    }, [data]);

    const currentItemSetting = useMemo<ReaderFeedbackConfig>(() => {
        if (updateParams?.config) return updateParams?.config;
        if (!currentItem || !dbReaderFeedbackConfigs) return undefined;
        return dbReaderFeedbackConfigs[currentItem.id] ?? { itemId: currentItem.id };
    }, [currentItem, updateParams, dbReaderFeedbackConfigs]);

    const computedParentSetting  = useMemo<ReaderFeedbackConfig>(() => {
        const readerRatingParent = parentItems.find(isi => dbReaderFeedbackConfigs?.[isi.id]?.readerRatingEnabled ?? true);
        const readerCommentsParent = parentItems.find(isi => dbReaderFeedbackConfigs?.[isi.id]?.readerCommentsEnabled ?? true);
        const readConfirmationParent = parentItems.find(isi => dbReaderFeedbackConfigs?.[isi.id]?.readConfirmationEnabled ?? false);
        return ({
            readerRatingEnabled: readerRatingParent ? dbReaderFeedbackConfigs[readerRatingParent.id].readerRatingEnabled : false,
            readerCommentsEnabled: readerCommentsParent ? dbReaderFeedbackConfigs[readerCommentsParent.id].readerCommentsEnabled : false,
            readConfirmationEnabled: readConfirmationParent ? dbReaderFeedbackConfigs[readConfirmationParent.id].readConfirmationEnabled : false,
        });
    }, [parentItems, dbReaderFeedbackConfigs]);

    const shouldOverrideParent = useMemo(
        () => !currentItemSetting ? undefined : hasAnyReaderFeedbackDefined(currentItemSetting),
        [currentItemSetting],
    );

    const resetDirtySetting = useCallback(() => setUpdateParams(null), [setUpdateParams]);

    const setOverrideSettings = useCallback((isOverridden: boolean) => {
        const dbReaderFeedbackConfig = dbReaderFeedbackConfigs?.[currentItem?.id];
        const currentIsOverride = hasAnyReaderFeedbackDefined(dbReaderFeedbackConfig);
        if (currentIsOverride === isOverridden) {
            resetDirtySetting();
            return;
        }
        setUpdateParams({
            itemId: item.id,
            config: {
                ...dbReaderFeedbackConfig,
                readerCommentsEnabled: isOverridden ? false : undefined,
                readerRatingEnabled: isOverridden ? false : undefined,
                readConfirmationEnabled: isOverridden ? false : undefined,
            },
        });
    }, [currentItem?.id, dbReaderFeedbackConfigs, item.id, resetDirtySetting, setUpdateParams]);

    useEffect(() => {
        if (itemIds && !currentItem) {
            setCurrentItem(item);
        }
    }, [item, itemIds, currentItem, setCurrentItem]);

    const rootClassNames = "readerfeedbackSettings"

    if (readerFeedbackConfigsLoading) {
        return (
            <div className={rootClassNames}>
                <div className="readerfeedbackSettings-loader">
                    {circularProgress()}
                </div>
            </div>
        )
    }

    return (
        <div className={rootClassNames}>
            <InheritedSettingsNavigator<ReaderFeedbackConfig>
                computedParentSetting={computedParentSetting}
                configs={dbReaderFeedbackConfigs}
                goToItem={goToItem}
                hasParentWithConfig={!!parentItems?.length}
                item={currentItem}
                itemSetting={currentItemSetting}
                parentItems={parentItems}
                setDirtySetting={config => setUpdateParams(config ? { itemId: item.id, config } : null)}
                setOverrideParentSettings={() => setOverrideSettings(true)}
                setUseParentSettings={() => setOverrideSettings(false)}
                settingComponent={ReaderFeedbackSetting}
                shouldOverrideParent={shouldOverrideParent}
                inheritSettingsMessage={t(TK.DocManagement_FeedbackSettings_Inherit)}
                overrideSettingsMessage={t(TK.DocManagement_FeedbackSettings_Override)}
            />
        </div>
    )
}

export default ReaderFeedbackSettings;
