import * as React from "react";
import Button from "@binders/ui-kit/lib/elements/button"
import { TranslationKeys as TK } from "@binders/client/lib/react/i18n/translations";
import { parse } from "qs";
import { withTranslation } from "@binders/client/lib/react/i18n";

import "../../main.styl";

class Unauthorized extends React.Component {
    render() {
        const { history, location: { search }, t } = this.props;
        const { msg } = parse(search.substr(1));
        const goHome = () => history.push("/");
        const errMsg = msg || t(TK.Acl_NoAccessToContent);
        return (
            <div className="reader-component-errorbox-wrapper">
                <div className="reader-component-errorbox">
                    <p>{errMsg}</p>
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

export default withTranslation()(Unauthorized);
