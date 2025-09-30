import * as React from "react";
import {
    FEATURE_READER_COMMENTING,
    FEATURE_READER_RATING,
    FEATURE_READ_CONFIRMATION
} from "@binders/client/lib/clients/accountservice/v1/contract";
import { useEffect, useMemo, useState } from "react";
import Checkbox from "@binders/ui-kit/lib/elements/checkbox";
import { CollectionLink } from "../../shared/InheritedSettingsNavigator/CollectionLink";
import { ReaderFeedbackConfig } from "@binders/client/lib/clients/repositoryservice/v3/contract";
import { SettingComponentProps } from "../../shared/InheritedSettingsNavigator/InheritedSettingsNavigator";
import { TK } from "@binders/client/lib/react/i18n/translations";
import cx from "classnames";
import { useActiveAccountFeatures } from "../../accounts/hooks";
import { useTranslation } from "@binders/client/lib/react/i18n";

export const ReaderFeedbackSetting: React.FC<SettingComponentProps<ReaderFeedbackConfig>> = ({
    configs,
    disabled,
    goToItem,
    isLoading,
    parentItems,
    setDirtySetting,
    setting,
}) => {
    const { t } = useTranslation();
    const features = useActiveAccountFeatures();
    const featuresReaderCommenting = features.includes(FEATURE_READER_COMMENTING);
    const featuresReaderRating = features.includes(FEATURE_READER_RATING);
    const featuresReadConfirmation = features.includes(FEATURE_READ_CONFIRMATION);
    const [isDirty, setIsDirty] = useState<boolean>(false);
    const [readerCommentsEnabled, setReaderCommentsEnabled] = useState<boolean | null | undefined>();
    const [readerRatingEnabled, setReaderRatingEnabled] = useState<boolean | null | undefined>();
    const [readConfirmationEnabled, setReadConfirmationEnabled] = useState<boolean | null | undefined>();

    // It identifies only the parents whose settings are actually being used, based on inheritance rules
    const parentItemsWithInheritableCommentsSetting = useMemo(() =>
        setting?.readerCommentsEnabled === false ?
            parentItems.filter(item => configs?.[item.id]?.readerCommentsEnabled === false) :
            parentItems.filter(item => configs?.[item.id]?.readerCommentsEnabled ?? true),
    [configs, parentItems, setting?.readerCommentsEnabled]);

    // It identifies only the parents whose settings are actually being used, based on inheritance rules
    const parentItemsWithInheritableRatingSetting = useMemo(() =>
        setting?.readerRatingEnabled === false ?
            parentItems.filter(item => configs?.[item.id]?.readerRatingEnabled === false) :
            parentItems.filter(item => configs?.[item.id]?.readerRatingEnabled ?? true),
    [configs, parentItems, setting?.readerRatingEnabled]);

    // It identifies only the parents whose settings are actually being used, based on inheritance rules
    const parentItemsWithInheritableReadConfirmationSetting = useMemo(() =>
        setting?.readConfirmationEnabled !== true ?
            parentItems.filter(item => configs?.[item.id]?.readConfirmationEnabled !== true) :
            parentItems.filter(item => configs?.[item.id]?.readConfirmationEnabled ?? false),
    [configs, parentItems, setting?.readConfirmationEnabled]);

    const toggleReaderCommentsEnabled = () => {
        setReaderCommentsEnabled(v => v == null ? false : !v);
        setIsDirty(true);
    }
    const toggleReaderRatingEnabled = () => {
        setReaderRatingEnabled(v => v == null ? false : !v);
        setIsDirty(true);
    }
    const toggleReadConfirmationEnabled = () => {
        setReadConfirmationEnabled(v => !v);
        setIsDirty(true);
    }

    useEffect(() => {
        if (setting?.readerCommentsEnabled !== undefined) {
            setReaderCommentsEnabled(setting.readerCommentsEnabled);
        }
        if (setting?.readerRatingEnabled !== undefined) {
            setReaderRatingEnabled(setting.readerRatingEnabled);
        }
        if (setting?.readConfirmationEnabled !== undefined) {
            setReadConfirmationEnabled(setting.readConfirmationEnabled);
        }
        setIsDirty(false);
    }, [setting]);

    useEffect(() => {
        if (isDirty) {
            const dirtyReaderFeedbackConfig: ReaderFeedbackConfig = {
                ...setting,
                readerCommentsEnabled,
                readerRatingEnabled,
                readConfirmationEnabled,
            }
            setDirtySetting(dirtyReaderFeedbackConfig);
        }
    }, [isDirty, setting, readerCommentsEnabled, readerRatingEnabled, setDirtySetting, readConfirmationEnabled]);

    return (
        <div className="readerfeedbackSetting">

            {featuresReaderCommenting && (
                <div className={cx(
                    "readerfeedbackSetting-checkboxwrapper",
                    { "readerfeedbackSetting-checkboxwrapper--disabled": (disabled || isLoading) }
                )}>
                    <Checkbox
                        checked={setting?.readerCommentsEnabled ?? true}
                        onCheck={toggleReaderCommentsEnabled}
                        disabled={disabled || isLoading}
                        iconSize="medium"
                        label={t(TK.ReaderFeedback_Setting_Comments)}
                    />
                    {parentItemsWithInheritableCommentsSetting.length > 0 ?
                        <div className="readerfeedbackSetting-checkboxwrapper-parentItems">
                            {parentItemsWithInheritableCommentsSetting.map(pi => (
                                <CollectionLink
                                    key={pi.id}
                                    collectionTitle={pi.title}
                                    onClick={() => goToItem(pi)}
                                    access={pi.access}
                                />
                            ))}
                        </div> :
                        null
                    }
                </div>
            )}

            {featuresReaderRating && (
                <div className={cx(
                    "readerfeedbackSetting-checkboxwrapper",
                    { "readerfeedbackSetting-checkboxwrapper--disabled": (disabled || isLoading) }
                )}>
                    <Checkbox
                        checked={setting?.readerRatingEnabled ?? true}
                        onCheck={toggleReaderRatingEnabled}
                        disabled={disabled || isLoading}
                        iconSize="medium"
                        label={t(TK.ReaderFeedback_Setting_Rating)}
                    />
                    {parentItemsWithInheritableRatingSetting.length > 0 ?
                        <div className="readerfeedbackSetting-checkboxwrapper-parentItems">
                            {parentItemsWithInheritableRatingSetting.map(pi => (
                                <CollectionLink
                                    key={pi.id}
                                    collectionTitle={pi.title}
                                    onClick={() => goToItem(pi)}
                                    access={pi.access}
                                />
                            ))}
                        </div> :
                        null
                    }
                </div>
            )}
            {featuresReadConfirmation && (
                <div className={cx(
                    "readerfeedbackSetting-checkboxwrapper",
                    { "readerfeedbackSetting-checkboxwrapper--disabled": (disabled || isLoading) }
                )}>
                    <Checkbox
                        checked={setting?.readConfirmationEnabled ?? false}
                        onCheck={toggleReadConfirmationEnabled}
                        disabled={disabled || isLoading}
                        iconSize="medium"
                        label={t(TK.ReaderFeedback_Setting_ReadConfirmation)}
                    />
                    {parentItemsWithInheritableReadConfirmationSetting.length > 0 ?
                        <div className="readerfeedbackSetting-checkboxwrapper-parentItems">
                            {parentItemsWithInheritableReadConfirmationSetting.map(pi => (
                                <CollectionLink
                                    key={pi.id}
                                    collectionTitle={pi.title}
                                    onClick={() => goToItem(pi)}
                                    access={pi.access}
                                />
                            ))}
                        </div> :
                        null
                    }
                </div>
            )}
        </div>
    )
}

export default ReaderFeedbackSetting;
