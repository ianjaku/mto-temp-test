import * as React from "react";
import Close from "../../elements/icons/Close";
import { TranslationKeys as TK } from "@binders/client/lib/react/i18n/translations";
import { isIE } from "@binders/client/lib/react/helpers/browserHelper";
import { withTranslation } from "@binders/client/lib/react/i18n";
import "./banner.styl";

export interface IIEWarningState {
    userUnderstands: boolean;
    isIE: boolean;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
class IEWarningBanner extends React.Component<any, IIEWarningState> {
    private t;

    constructor(props) {
        super(props);
        this.t = props.t;
        this.state = {
            userUnderstands: false,
            isIE: isIE(),
        }

        this.hideWarning = this.hideWarning.bind(this);

    }


    public hideWarning() {
        this.setState({ userUnderstands: true })

    }

    public render() {
        const { userUnderstands, isIE } = this.state;
        return (userUnderstands || !isIE) ?
            <div /> :
            (
                <div className="infoBanner">
                    <div className="infoBanner-wrapper">
                        <p className="infoBanner-message">
                            <span>{this.t(TK.General_DontUseIEWarning)}</span>
                            <a href="https://www.google.com/chrome" className="infoBanner-learnMore">Chrome</a>
                            <a href="https://www.mozilla.org" className="infoBanner-learnMore">Firefox</a>
                            <button className="infoBanner-confirmButton" onClick={this.hideWarning}>
                                {this.t(TK.General_GotIt)}
                            </button>
                            <span className="infoBanner-close" onClick={this.hideWarning}>
                                <span className="infoBanner-closeIcon">
                                    <Close />
                                </span>
                            </span>
                        </p>
                    </div>
                </div>
            );
    }
}


export default withTranslation()(IEWarningBanner);
