import * as React from "react";
import DropDown, { IDropdownElement } from "../../elements/dropdown";
import LineChart, { ILineChartDataItem } from "../../elements/linechart";
import cx from "classnames";
import { pick } from "ramda";
import "./withRanges.styl";

export type { ILineChartDataItem } from "../../elements/linechart";

export interface ILineChartWithRangesProps {
    cssPrefix?: string;
    ranges: IRangeDefinition[];
    lineColor?: string;
    title?: string;
    defaultRange?: string;
    updateDefaultRange?: (key: string) => void;
    renderAsBars?: boolean;
    hatchLastBar?: boolean;
    repositionOffsetY?: boolean;
    fontSize?: number;
}

export interface ILineChartWithRangesState {
    range: IRangeDefinition;
    data: ILineChartDataItem[];
}

export type DataItemBuilder = () => ILineChartDataItem[];

export interface IRangeDefinition {
    id: string;
    label: string;
    build: DataItemBuilder;
}



class LineChartWithRanges extends React.Component<ILineChartWithRangesProps, ILineChartWithRangesState> {
    private datasets;
    private ddElements = [];
    private setActiveRangeWithSetDefault;
    private setActiveRangeNoSetting;
    constructor(props: ILineChartWithRangesProps) {
        super(props);
        this.setActiveRangeWithSetDefault = this.setActiveRange.bind(this, true);
        this.setActiveRangeNoSetting = this.setActiveRange.bind(this, false);
        this.state = {
            data: [],
            range: undefined,
        };
    }

    public componentDidMount(): void {
        this.datasets = (this.props.ranges.reduce(
            (obj, r) => {
                const data = r.build();
                obj[r.id] = { data, hasData: data.length > 0 };
                return obj;
            }, {},
        ));
        this.ddElements = this.getRangeDropdownElements();
        this.setActiveRangeNoSetting(this.props.defaultRange);
    }

    public componentDidUpdate(prevProps: ILineChartWithRangesProps): void {
        if (prevProps.ranges !== this.props.ranges) {
            this.setActiveRangeNoSetting(this.props.defaultRange);
        }
    }

    public render(): React.ReactNode {
        const {
            fontSize,
            lineColor,
            hatchLastBar,
            renderAsBars,
            repositionOffsetY,
        } = this.props;
        const { range, data } = this.state;
        const dataSet = { data, lineColor, renderAsBars };

        if (!range) {
            return <div />;
        }
        const cssPrefix = this.props.cssPrefix || "ranged-linechart";
        const yLabelsRenderVertically = data.length > 7;
        return (
            <div className={cssPrefix}>
                <div className={cx(`${cssPrefix}-header`, "stats-header")}>
                    <h2 className={cx(`${cssPrefix}-header-title`, "stats-header-title")}>{this.props.title}</h2>
                    <div className={cx(`${cssPrefix}-header-ranges`, "stats-header-ranges")}>
                        <DropDown
                            type="Range"
                            elements={this.ddElements}
                            onSelectElement={this.setActiveRangeWithSetDefault}
                            selectedElementId={range.id}
                            showBorders={false}
                            className={`${cssPrefix}-dropdown`}
                        />
                    </div>
                </div>
                <div className={cx(`${cssPrefix}-body`, "stats-body")}>
                    <LineChart
                        dataSets={[dataSet]}
                        yLabelsRenderVertically={yLabelsRenderVertically}
                        useMinimumYDomain={true}
                        hatchLastBar={hatchLastBar}
                        repositionOffsetY={repositionOffsetY}
                        fontSize={fontSize}
                    />
                </div>
            </div>
        );
    }

    private async setActiveRange(shouldSaveDefault: boolean, id?: string) {
        const { ranges, updateDefaultRange } = this.props;
        const range = id ?
            ranges.find(r => r.id === id) :
            ranges.length > 0 && ranges[0];
        if (!range) {
            return;
        }
        if (shouldSaveDefault && updateDefaultRange) {
            updateDefaultRange(range.id);
        }
        this.setState({
            data: this.datasets[range.id].data,
            range,
        });
    }

    private getRangeDropdownElements(): IDropdownElement[] {
        let ranges = this.props.ranges;
        const rangesWithDataIndex = Object.keys(this.datasets).findIndex(r => {
            return this.datasets[r].hasData;
        });
        if (rangesWithDataIndex >= 0) {
            ranges = ranges.slice(Math.max(rangesWithDataIndex - 1, 0));
        }
        ranges = ranges.map(range => pick(["id", "label", "build"], range));
        return ranges;
    }
}

export default LineChartWithRanges;
