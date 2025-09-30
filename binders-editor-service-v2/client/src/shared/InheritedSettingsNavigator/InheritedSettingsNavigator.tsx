import * as React from "react";
import { InheritedSettingsItem } from "@binders/client/lib/clients/repositoryservice/v3/contract";
import RadioButton from "@binders/ui-kit/lib/elements/RadioButton";
import circularProgress from "@binders/ui-kit/lib/elements/circularprogress";
import cx from "classnames";
import "./InheritedSettingsNavigator.styl";

export type SettingComponentProps<S> = {
    configs: Record<string, S>;
    disabled?: boolean;
    goToItem?: (item: InheritedSettingsItem) => void;
    isLoading?: boolean;
    parentItems: InheritedSettingsItem[];
    setDirtySetting?: (setting: S) => void;
    setting: S;
}

export function InheritedSettingsNavigator<S>({
    computedParentSetting,
    configs,
    goToItem,
    hasParentWithConfig,
    item,
    itemSetting,
    parentItems,
    setDirtySetting,
    setOverrideParentSettings,
    setUseParentSettings,
    settingComponent: SettingComponent,
    shouldOverrideParent,
    inheritSettingsMessage,
    overrideSettingsMessage,
}: {
    computedParentSetting?: S;
    configs: Record<string, S>;
    goToItem?: (item: InheritedSettingsItem) => void;
    hasParentWithConfig: boolean;
    item: InheritedSettingsItem;
    itemSetting: S;
    parentItems?: InheritedSettingsItem[];
    setDirtySetting?: (setting: S) => void;
    setOverrideParentSettings: () => void;
    setUseParentSettings: () => void;
    settingComponent: React.ComponentType<SettingComponentProps<S>>;
    shouldOverrideParent: boolean | undefined;
    inheritSettingsMessage: string;
    overrideSettingsMessage: string;
}): React.ReactElement {
    const isUsingParentSettings = shouldOverrideParent === false;
    const isOverridingParentSettings = !isUsingParentSettings || !hasParentWithConfig;

    const overrideParentSettingsToggleMarkup = (
        <RadioButton
            label={overrideSettingsMessage}
            checked={shouldOverrideParent}
            onChange={setOverrideParentSettings}
            iconSize="medium"
        />
    );

    const useParentSettingsToggleMarkup = (
        <RadioButton
            label={(
                <div className="inheritedSettingsNavigator-titleLinkWrapper">
                    {inheritSettingsMessage}
                </div>
            )}
            checked={shouldOverrideParent === false}
            onChange={setUseParentSettings}
            iconSize="medium"
        />
    );

    const itemSettingsMarkup = (
        <SettingComponent
            parentItems={[]}
            configs={{}}
            setting={itemSetting ?? computedParentSetting}
            setDirtySetting={setDirtySetting}
        />
    );

    const parentSettingsMarkup = (
        <SettingComponent
            parentItems={parentItems}
            configs={configs}
            setting={computedParentSetting}
            goToItem={goToItem}
            disabled
        />
    );

    const rootClassNames = "inheritedSettingsNavigator";

    if (!item) {
        return (
            <div className={rootClassNames}>
                <div className="inheritedSettingsNavigator-loading">
                    {circularProgress()}
                </div>
            </div>
        );
    }

    return (
        <div className={ rootClassNames }>
            { hasParentWithConfig && (
                <div className={ cx(
                    "inheritedSettingsSection",
                    "transition-colors",
                    { "inheritedSettingsSection--isActive": isUsingParentSettings }
                ) }>
                    <div className="inheritedSettingsSection-header">
                        <div className="inheritedSettingsNavigator-radiobuttonWrapper">
                            { useParentSettingsToggleMarkup }
                        </div>
                    </div>
                    <div className="inheritedSettingsSection-settingWrapper">
                        { parentSettingsMarkup }
                    </div>
                </div>
            ) }

            <div className={ cx(
                "inheritedSettingsSection",
                "transition-colors",
                { "inheritedSettingsSection--isActive": isOverridingParentSettings }
            ) }>
                <div className="inheritedSettingsSection-header">
                    <div className="inheritedSettingsNavigator-radiobuttonWrapper">
                        { hasParentWithConfig && overrideParentSettingsToggleMarkup }
                    </div>
                </div>
                { isOverridingParentSettings && (
                    <div className="inheritedSettingsSection-settingWrapper">
                        { itemSettingsMarkup }
                    </div>
                ) }
            </div>
        </div>
    )
}

export default InheritedSettingsNavigator;
