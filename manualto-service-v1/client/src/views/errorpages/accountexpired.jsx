import * as React from "react";
import { TranslationKeys } from "@binders/client/lib/react/i18n/translations";
import { withTranslation } from "@binders/client/lib/react/i18n";

import "../../main.styl";

class AccountExpired extends React.Component {
    render() {
        const { t } = this.props;
        return (
            <div className="reader-component-errorbox-wrapper">
                <div className="reader-component-errorbox">
                    <p className="reader-component-errorbox-title">{t(TranslationKeys.Account_ExpiredInfo)}</p>
                    <p className="reader-component-errorbox-description">{t(TranslationKeys.Account_ReactivateInfo)}</p>
                </div>
            </div>
        )
    }
}

export default withTranslation()(AccountExpired);
