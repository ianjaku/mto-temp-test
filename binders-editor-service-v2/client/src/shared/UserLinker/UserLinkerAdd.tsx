import * as React from "react";
import { Tooltip, TooltipPosition, hideTooltip, showTooltip } from "@binders/ui-kit/lib/elements/tooltip/Tooltip";
import Button from "@binders/ui-kit/lib/elements/button";
import type { FC } from "react";
import IconInfo from "@binders/ui-kit/lib/elements/icons/Info";
import { TranslationKeys as TK } from "@binders/client/lib/react/i18n/translations";
import UserInput from "../user-input/UserInput";
import { UserInputType } from "../user-input/UserInputTypeSwitcher";
import cx from "classnames";
import { mergeGroupNames } from "./utils";
import { useDirtyStateSaveAction } from "./useDirtyStateSaveAction";
import { useTranslation } from "@binders/client/lib/react/i18n";
import { useUserLinker } from "./useUserLinker";
import { useUserLinkerContext } from "./userLinkerContext";

const UserLinkerAdd: FC = () => {
    const { t } = useTranslation();
    const userLinkerProps = useUserLinkerContext();

    const {
        addBtnCaption,
        allowUserCreation,
        dirtyStateId,
        disallowGroups,
        enabledUserTypes,
        hideAddWhenEmptyInput,
        hideFieldLabels,
        inlineAddBtn,
        messageOverrides,
        needsEditorAccess,
        onCreateUsers,
        onLinkUsers,
        onLinkUsergroupIntersection,
        userIdsIgnoreList,
        linkedTargetsFilter,
    } = userLinkerProps;

    const {
        selectedUserInputType,
        selectedItems,
        setSelectedUserInputType,
        setSelectedItems,
        saveAction,
        isLoading,
    } = useUserLinker({
        allowUserCreation,
        initialUserInputType: UserInputType.User,
        onCreateUsers,
        onLinkUsers,
        onLinkUsergroupIntersection,
    })

    useDirtyStateSaveAction(selectedItems.length > 0, saveAction, !dirtyStateId);

    const tooltipRef = React.useRef<Tooltip>();
    const tooltipHref: string | null = t(TK.User_UsergroupIntersectionHelpLink);
    const hasTooltipHref = tooltipHref?.length > 0;
    const isAddEnabled = selectedUserInputType === UserInputType.GroupIntersection ?
        selectedItems.length > 1 :
        selectedItems.length > 0;

    const usergroupIntersectionHelp = selectedItems.length < 2 ?
        t(TK.User_UsergroupIntersectionHelpNone) :
        t(TK.User_UsergroupIntersectionHelpSome, {
            groups: mergeGroupNames(selectedItems.map(si => si.label), t(TK.General_And)),
        });

    return (
        <div className="userLinker-section">
            {!hideFieldLabels && (
                <label className="userLinker-section-title">
                    {t(TK.User_UserLinkerLinkUser)}
                </label>
            )}
            <div className={cx("userLinkerAdd-userInput", { "userLinkerAdd-userInput--inlineAddBtn": inlineAddBtn })}>
                <UserInput
                    allowUserCreation={allowUserCreation}
                    disallowGroups={disallowGroups}
                    enabledUserTypes={enabledUserTypes}
                    itemFilter={item => linkedTargetsFilter?.(item.value) ?? true}
                    messageOverrides={messageOverrides}
                    needsEditorAccess={needsEditorAccess}
                    saveOnBlur
                    selectedUserInputType={selectedUserInputType}
                    selectedItems={selectedItems}
                    setSelectedUserInputType={setSelectedUserInputType}
                    setSelectedItems={setSelectedItems}
                    userIdsIgnoreList={userIdsIgnoreList}
                    wrapChips
                />
                <div className="userLinkerAdd-userInput-btns">
                    {!hideAddWhenEmptyInput || selectedItems.length > 0 ?
                        (
                            <Button
                                className="userLinkerAdd-userInput-btns-add"
                                text={addBtnCaption ?? t(TK.General_Add)}
                                onClick={saveAction}
                                inactiveWithLoader={isLoading}
                                isEnabled={isAddEnabled}
                            />
                        ) :
                        null}
                </div>
            </div>
            {selectedUserInputType === UserInputType.GroupIntersection && (
                <div className={cx(
                    "userLinker-section-title userLinker-section-tooltip",
                    "m-0 inline-flex items-center",
                )}>
                    <a
                        className={cx(
                            "tooltip-button",
                            "p-2 pl-0 items-center",
                            hasTooltipHref && "active cursor-pointer"
                        )}
                        href={tooltipHref}
                        target="_blank"
                        onMouseOver={(e) => tooltipRef.current && showTooltip(e, tooltipRef.current, TooltipPosition.RIGHT)}
                        onMouseOut={(e) => hideTooltip(e, tooltipRef.current)}
                    ><IconInfo /></a>
                    <Tooltip ref={ref => { tooltipRef.current = ref }} message={t(TK.User_UsergroupIntersectionTooltip)} />
                    <span>{usergroupIntersectionHelp}</span>
                </div>
            )}
        </div>
    )
}

export default UserLinkerAdd;
