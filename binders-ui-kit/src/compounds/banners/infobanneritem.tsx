/**
 * A generic banner component that shows a banner at the top of the screen.
 */

import * as React from "react";
import Close from "../../elements/icons/Close";
import { ViewersStore } from "./viewerstore";
import { withTranslation } from "@binders/client/lib/react/i18n";
import "./banner.styl";

export interface IInfoBannerState {
    userUnderstands: boolean;
}

export interface IInfoBannerProps {
    t: (v: string) => string;
    name: string; // A generic identifier, can be anything as long as it is unique
    text: string;
    buttonText?: string; // Only shows a button if the button text is given
    viewerIdentifier?: string; // An identifier for the viewer -> show once per viewer on this device if given
    cooldownHours?: number; // Show once every x hours. Default: no cooldown

    // Define a Date range when the banner should be shown
    hideBefore?: Date;
    hideAfter?: Date;

    // By default, the button will close the banner except for when this parameter is given.
    onButtonClick?: (helpers: { hideBanner: () => void }) => void; 
}

class InfoBannerItem extends React.Component<IInfoBannerProps, IInfoBannerState> {
    
    private viewersStore: ViewersStore | null = null;
    
    constructor(props: IInfoBannerProps) {
        super(props);
        this.state = {
            userUnderstands: false,
        }
        if (props.cooldownHours) {
            this.viewersStore = new ViewersStore(
                props.name,
                props.cooldownHours ?? 0
            )
        }
        this.hideBanner = this.hideBanner.bind(this);
        this.onButtonClick = this.onButtonClick.bind(this);
    }


    public hideBanner() {
        if (this.viewersStore != null) {
            this.viewersStore.logView(this.props.viewerIdentifier);
        }
        this.setState({userUnderstands: true});
    }

    public onButtonClick() {
        if (this.props.onButtonClick == null) {
            return this.hideBanner();
        }
        return this.props.onButtonClick({
            hideBanner: () => this.hideBanner()
        });
    }

    public render() {
        if (
            (this.props.hideBefore && this.props.hideBefore > new Date()) ||
            (this.props.hideAfter && this.props.hideAfter < new Date()) ||
            this.state.userUnderstands ||
            this.viewersStore?.hasSeen(this.props.viewerIdentifier)
        ) return null;

        const { text, buttonText } = this.props;
        return (
            <div className="infoBanner-message-item">
                <span>{text}</span>
                {buttonText && (
                    <button className="infoBanner-confirmButton" onClick={this.onButtonClick}>
                        {buttonText}
                    </button>
                )}
                <span className="infoBanner-close" onClick={this.hideBanner}>
                    <span className="infoBanner-closeIcon">
                        <Close />
                    </span>
                </span>
            </div>
        );
    }
}


export default withTranslation()(InfoBannerItem);
