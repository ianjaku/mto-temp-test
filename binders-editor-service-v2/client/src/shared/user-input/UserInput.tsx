import * as React from "react";
import type { ComponentClass, Dispatch, FC, SetStateAction } from "react";
import { searchGroups, searchUsers } from "../../users/actions";
import { useCallback, useState } from "react";
import { useUserInput, useUserInputIdFilter } from "./useUserInput";
import Autocomplete from "@binders/ui-kit/lib/elements/autocomplete";
import type { ChipComponentProps } from "@binders/ui-kit/lib/elements/autocomplete/contract";
import { EMAIL_DOMAINS_TO_HIDE_IN_TABLE } from "@binders/client/lib/clients/userservice/v1/constants";
import type { IAutocompleteItem } from "@binders/ui-kit/lib/elements/autocomplete";
import RoleInput from "../access-box/RoleInput";
import type { UIRole } from "../access-box/RoleInput";
import type { UserInputMessageOverrides } from "./useUserInputAutocomplete";
import { UserInputType } from "./UserInputTypeSwitcher";
import UserInputTypeSwitcher from "./UserInputTypeSwitcher";
import cx from "classnames";
import debounce from "lodash.debounce";
import { isMobileView } from "@binders/ui-kit/lib/helpers/rwd";
import { useActiveAccountId } from "../../accounts/hooks";
import { useUserInputAutocomplete } from "./useUserInputAutocomplete";
import "./UserInput.styl";

export type IUserInputProps = {
    ChipComponent?: FC<ChipComponentProps> | ComponentClass<ChipComponentProps>;
    allowUserCreation?: boolean;
    disallowGroups?: boolean;
    enabledUserTypes?: UserInputType[];
    featuresDialects?: boolean;
    hideIcon?: boolean;
    hideTypeSelector?: boolean;
    includeTranslatorPseudoRole?: boolean;
    itemFilter?: (item: IAutocompleteItem) => boolean;
    maxAllowedSelectedItems?: number;
    messageOverrides?: UserInputMessageOverrides;
    needsEditorAccess?: boolean;
    onAutocompleteInputRef?: (ref: HTMLTextAreaElement) => void;
    onSelectRole?: (role: UIRole) => void;
    saveOnBlur?: boolean;
    selectedUserInputType?: UserInputType;
    selectedItems: IAutocompleteItem[];
    selectedRole?: UIRole;
    setSelectedUserInputType?: Dispatch<SetStateAction<UserInputType>>;
    setSelectedItems: (items: IAutocompleteItem[]) => void;
    uiRoles?: UIRole[];
    userIdsIgnoreList?: string[];
    userItemFormatter?: (item: IAutocompleteItem) => IAutocompleteItem;
    wrapChips?: boolean;
}

export const UserInput: FC<IUserInputProps> = ({
    selectedItems,
    setSelectedItems,
    userIdsIgnoreList,
    userItemFormatter,
    ...props
}) => {
    const itemFormatter = userItemFormatter ?? defaultItemFormatter;
    const accountId = useActiveAccountId();

    const [managedSelectedUserInputType, setManagedSelectedUserInputType] = useState<UserInputType>(props.selectedUserInputType ?? UserInputType.User);

    const userInputType = props.setSelectedUserInputType ? props.selectedUserInputType : managedSelectedUserInputType;
    const setUserInputType = props.setSelectedUserInputType ?? setManagedSelectedUserInputType;

    const itemIdFilter = useUserInputIdFilter({
        userIdsIgnoreList,
        userInputType,
    });

    const autocomplete = useUserInputAutocomplete({
        accountId,
        disallowGroups: props.disallowGroups,
        hideTypeSelector: props.hideTypeSelector,
        itemFilter: props.itemFilter,
        itemFormatter,
        itemIdFilter,
        messageOverrides: props.messageOverrides,
        needsEditorAccess: props.needsEditorAccess,
        searchGroups,
        searchUsers,
        userInputType,
    });

    const userInput = useUserInput(
        { autocomplete, selectedItems, setSelectedItems },
        { selectedUserInputType: userInputType, setSelectedUserInputType: setUserInputType },
    );

    const {
        ChipComponent,
        allowUserCreation,
        disallowGroups,
        enabledUserTypes,
        featuresDialects,
        hideTypeSelector,
        hideIcon,
        includeTranslatorPseudoRole,
        maxAllowedSelectedItems,
        onSelectRole,
        saveOnBlur,
        selectedRole,
        uiRoles,
        wrapChips,
    } = props;

    const renderRoleInput = useCallback(() => {
        return (
            <RoleInput
                uiRoles={uiRoles}
                onSelectRole={onSelectRole}
                includeTranslatorPseudoRole={includeTranslatorPseudoRole}
                selectedRole={selectedRole}
                featuresDialects={featuresDialects}
            />
        )
    }, [featuresDialects, includeTranslatorPseudoRole, onSelectRole, selectedRole, uiRoles]);

    return (
        <div className={cx("userInput", {
            "userInput--showTypeSelector": !disallowGroups && !hideTypeSelector,
            "userInput--hideIcon": hideIcon,
        })}>
            <Autocomplete
                ChipComponent={ChipComponent}
                allowItemCreation={allowUserCreation && userInputType === UserInputType.User} // note: ad-hoc creation of groups is not supported
                data={autocomplete.autocompleteData}
                hideIcon={hideIcon}
                isLoading={autocomplete.isLoading}
                maxAllowedSelectedItems={maxAllowedSelectedItems}
                noMatchesOverride={autocomplete.noMatchesOverride}
                onAddNewClick={userInput.onAddNewChip}
                onDeleteChipClick={userInput.onDeleteChip}
                onInputRef={props.onAutocompleteInputRef}
                onUpdateSearchTerm={debounce(autocomplete.onUpdateSearchTerm, 500)}
                placeholder={autocomplete.placeholder}
                renderLeadingSlot={!disallowGroups && !hideTypeSelector ?
                    () => (
                        <UserInputTypeSwitcher
                            enabledUserTypes={enabledUserTypes}
                            onSelectType={setUserInputType}
                            selectedType={userInputType}
                        />
                    ) :
                    undefined}
                renderTrailingSlot={uiRoles && !isMobileView() && renderRoleInput}
                saveOnBlur={saveOnBlur}
                selectedItems={selectedItems}
                totalResults={autocomplete.autocompleteFilteredCount}
                wrapChips={wrapChips}
            />
            {uiRoles && isMobileView() && renderRoleInput()}
        </div>
    )
}

const defaultItemFormatter = (item: IAutocompleteItem) => {
    const { id, label, value } = item;
    if (id.startsWith("uid")) {
        const val = EMAIL_DOMAINS_TO_HIDE_IN_TABLE.some(d => value.includes(d)) ? "" : ` <${value}>`;
        return { label: `${label}${val}`, rawLabel: label, value, id };
    }
    return { label, rawLabel: label, value, id };
};

export default UserInput;
