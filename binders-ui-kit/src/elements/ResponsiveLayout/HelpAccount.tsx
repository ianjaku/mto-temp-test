import * as React from "react";
import { EditorEvent, captureFrontendEvent } from "@binders/client/lib/thirdparty/tracking/capture";
import { useCallback, useMemo } from "react";
import { Account } from "@binders/client/lib/clients/accountservice/v1/contract";
import HelpIcon from "@material-ui/icons/Help";
import { TranslationKeys as TK } from "@binders/client/lib/react/i18n/translations";
import cx from "classnames";
import { useTranslation } from "@binders/client/lib/react/i18n";
import { withProtocol } from "@binders/client/lib/util/uri";

export const HelpAccount: React.FC<{
    account?: Account;
    className?: string;
}> = ({ account, className }) => {
    const { t } = useTranslation();
    const accountDomain = useMemo(() => account?.domains?.at(0), [account]);
    const onClick = useCallback(() => {
        const win = window.open(withProtocol(accountDomain), "_blank");
        win.focus();
        captureFrontendEvent(EditorEvent.NavbarButtonClicked, { button: "HELP" });
    }, [accountDomain]);

    if (!accountDomain) return <div />;
    return (
        <li className={cx("navbar-main-navigation-list-item", className)}>
            <div className="navbar-main-navigation-list-item-link" onClick={onClick}>
                <span className="navbar-main-navigation-list-item-icon"><HelpIcon /></span>
                <label className="navbar-main-navigation-list-item-label">{t(TK.General_Help)}</label>
            </div>
        </li>
    );
}
