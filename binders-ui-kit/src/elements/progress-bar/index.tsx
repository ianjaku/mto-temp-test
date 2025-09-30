import * as React from "react";
import MaterialSlider, { SliderProps } from "@material-ui/core/Slider";
import { TranslationKeys } from "@binders/client/lib/react/i18n/translations";
import colors from "../../variables/index";
import i18next from "@binders/client/lib/react/i18n";
import moment from "moment";
import { withStyles } from "@material-ui/core/styles";
import "./progress-bar.styl";

export interface IProgressBarProps {
    percentage: number;
    color?: string;
    height?: number;
    borderRadius?: number;
    hideValue?: boolean;
    width?: number;
    lastUpdated?: Date;
}


export interface IProgressBarComponent extends SliderProps {
    barColor?: string;
    height?: number;
    borderRadius?: number;
    width?: number;
}

const DEFAULT_PROPS: IProgressBarComponent = {
    barColor: colors.progressColor,
    borderRadius: 4,
    height: 8,
    width: 100,
};

const ThumbComponent: React.FunctionComponent = () => <span />;

const ProgressBarWrapper = (props) => {
    const borderRadius = props.borderRadius || DEFAULT_PROPS.borderRadius;
    const height = props.height || DEFAULT_PROPS.height;
    const barColor = props.barColor || DEFAULT_PROPS.barColor;
    const width = props.width || DEFAULT_PROPS.width;

    const styles = {
        root: {
            color: barColor,
            height,
            width: `${width}px`,
        },
        track: {
            height,
            borderRadius,
        },
        rail: {
            height,
            borderRadius,
            color: colors.borderGrayColor,
        }
    };

    return withStyles(styles)(MaterialSlider);
}

const calculateLastUpdated = (date: Date): string => {
    const lastUpdated = moment(date).locale(i18next.language || "en").fromNow()
    return i18next.t(TranslationKeys.Edit_ProgressInfo, { lastUpdated: lastUpdated })
}

const ProgressBar: React.FunctionComponent<IProgressBarProps> = (props) => {
    const { hideValue, percentage, lastUpdated } = props;
    const value = React.useMemo(() => Math.round(percentage * 100), [percentage]);
    const ProgressBarComponent = ProgressBarWrapper({ ...props, barColor: props.color });
    const lastUpdatedInfo = React.useMemo(() => calculateLastUpdated(lastUpdated), [lastUpdated])
    return (
        <div className="progress-bar">
            <ProgressBarComponent
                min={0.00}
                max={1.00}
                defaultValue={percentage}
                ThumbComponent={ThumbComponent}
            />
            <span className="value">{hideValue ? "" : `${value}%`}</span>
            {lastUpdated && <span className="progress-bar-lastUpdated">{lastUpdatedInfo}</span>}
        </div>
    )
}

export default ProgressBar;
