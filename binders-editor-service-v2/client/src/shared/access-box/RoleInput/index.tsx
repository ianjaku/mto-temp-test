import * as React from "react";
import {
    IAclRestrictionSet,
    Role,
    TRANSLATOR_PSEUDO_ID
} from "@binders/client/lib/clients/authorizationservice/v1/contract";
import Dropdown from "@binders/ui-kit/lib/elements/dropdown";
import LanguageRestrictionInput from "./LanguageRestrictionInput";
import { TranslationKeys as TK } from "@binders/client/lib/react/i18n/translations";
import { buildNewDropdownRoles } from "./helpers";
import { isMobileView } from "@binders/ui-kit/lib/helpers/rwd";
import { useAbsolutePositioningContext } from "../../Layout/absolutePositioningContext";
import { useCallback } from "react";
import { useTranslation } from "@binders/client/lib/react/i18n";

const { useMemo } = React;

interface IRoleInputProps {
    uiRoles: UIRole[];
    includeTranslatorPseudoRole: boolean;
    onSelectRole: (role: UIRole) => void;
    selectedRole: UIRole;
    featuresDialects?: boolean;
}

export type UIRole = Role & {
    restrictionSet?: IAclRestrictionSet,
    dbRoleName?: string,
    isRestrictedVariant?: boolean,
}; // includes Roles and pseudo roles

const RoleInput: React.FC<IRoleInputProps> = ({ uiRoles, onSelectRole, selectedRole, featuresDialects }) => {

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { t }: { t: any } = useTranslation();
    const { absolutePositioningTarget } = useAbsolutePositioningContext();

    // eslint-disable-next-line react-hooks/exhaustive-deps
    const elements = useMemo(() => buildNewDropdownRoles(uiRoles, t), [uiRoles]);

    const handleSelectRole = useCallback((roleName: string) => {
        const role = uiRoles.find(r => r.name === roleName);
        onSelectRole(role);
    }, [onSelectRole, uiRoles]);

    const onSelectLanguage = useCallback((langCode: string) => {
        onSelectRole({
            ...selectedRole,
            restrictionSet: { languageCodes: [langCode] },
        });
    }, [selectedRole, onSelectRole]);

    const renderRoles = useCallback(() => {
        return (
            <div className="roleInput-selection">
                <Dropdown
                    onSelectElement={handleSelectRole}
                    selectedElementId={selectedRole?.name}
                    type={t(TK.General_Roles)}
                    elements={elements}
                    showBorders={isMobileView()}
                    dropdownElementsPortalTarget={absolutePositioningTarget}
                    elementsClassName="roleInput-selection-elements"
                    dropUp={isMobileView()}
                />
            </div>
        );
    }, [elements, handleSelectRole, selectedRole, t, absolutePositioningTarget]);

    const maybeRenderRestrictions = useCallback(() => {
        if (selectedRole?.roleId === TRANSLATOR_PSEUDO_ID) {
            return (
                <LanguageRestrictionInput
                    onSelectLanguage={onSelectLanguage}
                    featuresDialects={featuresDialects}
                />
            );
        }
        return null;
    }, [selectedRole, onSelectLanguage, featuresDialects]);

    return (
        <div className="accessBoxSection-newAcls-roleInput">
            {renderRoles()}
            {maybeRenderRestrictions()}
        </div>
    );
}

export default RoleInput;