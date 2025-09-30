import * as React from "react";
import Close from "../../elements/icons/Close";
import { FaIconExclamationTriangle } from "@binders/client/lib/react/icons/font-awesome";
import { TranslationKeys as TK } from "@binders/client/lib/react/i18n/translations";
import { ViewersStore } from "./viewerstore";
import { withTranslation } from "@binders/client/lib/react/i18n";
import "./banner.styl";

export interface IIEWarningState {
    userUnderstands: boolean;
}

export interface IDownTimeWarningProps {
    t: (v: string) => string;
    viewerIdentifier: string;
}

export const SKIP_DOWNTIME_WARNING_ON_DOMAINS = ["demo.manual.to", "test.manual.to"];

class DownTimeWarning extends React.Component<IDownTimeWarningProps, IIEWarningState> {
    
    private viewersStore = new ViewersStore(
        "downtime-warning-viewers",
        20
    );
    
    constructor(props) {
        super(props);
        this.state = {
            userUnderstands: false,
        }
        this.hideWarning = this.hideWarning.bind(this);
    }


    public hideWarning() {
        this.viewersStore.logView(this.props.viewerIdentifier);
        this.setState({userUnderstands: true});
    }

    public render() {
        if (
            this.state.userUnderstands ||
            this.viewersStore.hasSeen(this.props.viewerIdentifier)
        ) return null;

        const { t } = this.props;
        return (
            <div className="infoBanner infoBanner--top infoBanner--danger">
                <div className="infoBanner-wrapper">
                    <div className="infoBanner-message">
                        <FaIconExclamationTriangle className={"danger-icon"} />
                        <span>{t(TK.General_DowntimeWarning)}</span>
                        <button className="infoBanner-confirmButton" onClick={this.hideWarning}>
                            {t(TK.General_GotIt)}
                        </button>
                        <span className="infoBanner-close" onClick={this.hideWarning}>
                            <span className="infoBanner-closeIcon">
                                <Close />
                            </span>
                        </span>
                    </div>
                </div>
            </div>
        );
    }
}


export default withTranslation()(DownTimeWarning);
