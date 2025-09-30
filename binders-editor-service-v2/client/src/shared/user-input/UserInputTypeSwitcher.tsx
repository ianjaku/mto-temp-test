import * as React from "react";
import Dropdown from "@binders/ui-kit/lib/elements/dropdown";
import { TranslationKeys as TK } from "@binders/client/lib/react/i18n/translations";
import { useAbsolutePositioningContext } from "../Layout/absolutePositioningContext";
import { useTranslation } from "@binders/client/lib/react/i18n";

export enum UserInputType {
    Group = "group",
    GroupIntersection = "group-intersection",
    User = "user",
}

const USER_INPUT_TYPES = {
    [UserInputType.User]: {
        id: UserInputType.User,
        label: TK.User_User,
        icon: "person_add",
    },
    [UserInputType.Group]: {
        id: UserInputType.Group,
        label: TK.User_UsergroupShort,
        icon: "group_add",
    },
    [UserInputType.GroupIntersection]: {
        id: UserInputType.GroupIntersection,
        label: TK.User_UsergroupIntersection,
        icon: "join_inner",
    }
}

const UserInputTypeSwitcher: React.FC<{
    enabledUserTypes?: UserInputType[];
    onSelectType: (type: UserInputType) => void;
    selectedType: UserInputType;
}> = ({ enabledUserTypes, onSelectType, selectedType }) => {
    const { absolutePositioningTarget } = useAbsolutePositioningContext();
    const { t } = useTranslation();

    const elements = (enabledUserTypes ?? [UserInputType.User, UserInputType.Group]).map(id => ({
        ...USER_INPUT_TYPES[id],
        label: t(USER_INPUT_TYPES[id].label),
    }));

    return (
        <Dropdown
            onSelectElement={onSelectType}
            selectedElementId={selectedType}
            type={"User input type"}
            elements={elements}
            showBorders={false}
            dropdownElementsPortalTarget={absolutePositioningTarget}
            className="userInputTypeSwitcher"
            elementsClassName="userInputTypeSwitcher-selection-elements"
        />
    )
}

export default UserInputTypeSwitcher;
