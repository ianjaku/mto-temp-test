import * as React from "react";
import { TranslationKeys } from "@binders/client/lib/react/i18n/translations";
import { getReaderDomain } from "../../util";
import { withTranslation } from "@binders/client/lib/react/i18n";

import "../../main.styl";

class DomainNotFound extends React.Component {
    render() {
        const { t } = this.props;
        return (
            <div className="reader-component-errorbox-wrapper">
                <div className="reader-component-errorbox">
                    <p>{t(TranslationKeys.General_DomainNotFound, {domain: getReaderDomain()})}</p>
                </div>
            </div>
        )
    }
}

export default withTranslation()(DomainNotFound);
