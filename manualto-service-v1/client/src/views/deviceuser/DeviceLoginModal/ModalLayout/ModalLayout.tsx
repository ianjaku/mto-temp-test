import * as React from "react";
import { APIVerifyPassword } from "../../../../api/credentials";
import { FC } from "react";
import { FaIconSignOutAlt } from "@binders/client/lib/react/icons/font-awesome";
import Modal from "@binders/ui-kit/lib/elements/modal";
import { ModalLogo } from "./ModalLogo/ModalLogo";
import { PasswordModal } from "../PasswordModal/PasswordModal";
import { TK } from "@binders/client/lib/react/i18n/translations";
import { useCurrentUser } from "../../../../stores/hooks/user-hooks";
import { useShowModal } from "@binders/ui-kit/lib/compounds/modals/ModalViewProvider";
import { useTranslation } from "@binders/client/lib/react/i18n";
import "./ModalLayout.styl";


export const ModalLayout: FC<{
    hideLogoutButton?: boolean;
    hideBg?: boolean;
    zIndexBump?: number;
}> = (props) => {
    const { t } = useTranslation();
    const bgDark = window.bindersBranding.stylusOverrideProps?.bgDark;
    const showPasswordModal = useShowModal(PasswordModal);
    const currentUser = useCurrentUser();

    const logout = () => {
        showPasswordModal({
            displayName: currentUser.displayName,
            submitButtonText: t(TK.General_Logout),
            onSubmit: async (password) => {
                const isValid = await APIVerifyPassword(currentUser.login, password);
                if (!isValid) return false;
                window.location.href = "/logout";
                return true;
            }
        })
    }

    return (
        <Modal
            classNames="modalLayout"
            uncloseable={true}
            withoutFooter
            withoutBg={props.hideBg}
            withoutPadding
            withoutHeaderPadding
            zIndexBump={props.zIndexBump}
            additionalHeaderChildren={[
                {
                    element: <div className="modalLayout-header-spacer"></div>
                },
                {
                    element: <ModalLogo />
                },
                {
                    element: props.hideLogoutButton ?
                        (
                            <div className="modalLayout-header-spacer"></div>
                        ) :
                        (
                            <label
                                className="modalLayout-logoutBtn"
                                onClick={() => logout()}
                            >
                                <FaIconSignOutAlt />
                            </label>
                        )
                }
            ]}
            headerColor={bgDark || undefined}
        >
            <div className="modalLayout-content">
                {props.children}
            </div>
        </Modal>
    )
}
