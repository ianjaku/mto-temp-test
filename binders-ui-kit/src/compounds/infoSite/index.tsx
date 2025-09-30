import * as React from "react";
import Button from "../../elements/button";

import "./infoSite.styl";

export interface IInfoSiteProps {
    info: string;
    feedbackHtml?: string;
    onButtonClick: () => void;
    buttonText: string;
    onSecondaryButtonClick?: () => void;
    secondaryButtonText?: string;
}

interface IInfoSiteState {
    isDone: boolean;
    isWorking: boolean;
    secondaryIsWorking: boolean;
}

class InfoSite extends React.Component<IInfoSiteProps, IInfoSiteState> {
    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    constructor(props) {
        super(props);
        this.state = {
            isDone: false,
            isWorking: false,
            secondaryIsWorking: false,
        };
        this.onClick = this.onClick.bind(this);
        this.onSecondaryClick = this.onSecondaryClick.bind(this);
    }

    public render(): JSX.Element {
        const { buttonText, info, feedbackHtml, onSecondaryButtonClick, secondaryButtonText } = this.props;
        const { isDone, isWorking, secondaryIsWorking } = this.state;
        const hasSecondaryButton = onSecondaryButtonClick && secondaryButtonText;
        return (
            <div className="infoSite">
                {(!isDone || !feedbackHtml) ?
                    (
                        <div>
                            <div className="infoSite-info">
                                <p>{info}</p>
                            </div>
                            <div className="infoSite-confirm">
                                <Button onClick={this.onClick} text={buttonText} inactiveWithLoader={isWorking} />
                            </div>
                            {
                                hasSecondaryButton && (
                                    <div className="infoSite-confirm">
                                        <Button onClick={this.onSecondaryClick} text={secondaryButtonText} inactiveWithLoader={secondaryIsWorking} />
                                    </div>
                                )
                            }
                        </div>
                    ) :
                    (
                        <div className="infoSite-info">
                            <div className="infoSite-info-description" dangerouslySetInnerHTML={{ __html: feedbackHtml }} />
                        </div>
                    )
                }

            </div >
        );
    }

    private async onClick() {
        this.setState({
            isWorking: true,
        });
        await this.props.onButtonClick();
        this.setState({
            isDone: true,
            isWorking: false,
        });
    }

    private async onSecondaryClick() {
        this.setState({
            secondaryIsWorking: true,
        });
        await this.props.onSecondaryButtonClick();
        this.setState({
            isDone: true,
            secondaryIsWorking: false,
        });
    }
}

export default InfoSite;