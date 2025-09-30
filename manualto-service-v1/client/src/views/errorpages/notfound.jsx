import * as React from "react";
import Button from "@binders/ui-kit/lib/elements/button"
import { TranslationKeys as TK } from "@binders/client/lib/react/i18n/translations";
import { withTranslation } from "@binders/client/lib/react/i18n";

import "../../main.styl";

class NotFound extends React.Component {
    render() {
        const { history, t } = this.props;
        const goHome = () => history.push("/");
        return (
            <div className="reader-component-errorbox-wrapper">
                <div className="reader-component-errorbox">
                    <p>{t(TK.General_ContentNotFound)}</p>
                    <Button
                        branded
                        CTA
                        text={t(TK.General_GoHome)}
                        onClick={goHome}
                    />
                </div>
            </div>
        )
    }
}

export default withTranslation()(NotFound);
