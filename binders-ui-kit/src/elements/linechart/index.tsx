import * as React from "react";
import { VictoryAxis, VictoryBar, VictoryLine, VictoryTooltip } from "victory";
import { TFunction } from "@binders/client/lib/i18n";
import { TranslationKeys } from "@binders/client/lib/react/i18n/translations";
import vars from "../../variables";
import { withTranslation } from "@binders/client/lib/react/i18n";

export interface ILineChartDataItem {
    x: string | number;
    y: number;
    label?: string;
    fill?: string;
}

export interface ILineChartDataSet {
    data: ILineChartDataItem[];
    lineColor?: string;
    yLabelTransform?: (value) => void;
    yAxisLabel?: string;
    renderAsBars?: boolean;
}

export interface ILineChartProps {
    dataSets: ILineChartDataSet[];
    useMinimumYDomain?: boolean;
    xAxisLabel?: string;
    yLabelsRenderVertically?: boolean;
    yDomain?: number[];
    hatchLastBar?: boolean;
    repositionOffsetY?: boolean;
    fontSize?: number;
}

export interface IDomain {
    x?: number[];
    y: number[];
}

export interface IDomainPadding {
    x?: number;
    y: number;
}

class FakeToolTip extends React.Component<unknown, unknown> {
    public render() {
        return <div />;
    }
}

export interface ILineChartState {
    domains: IDomain[];
    domainPadding: IDomainPadding;
    xDomainValues: number[];
    xDomainLabels: string[];
    fontSize: string;
    error?: string;
    noTooltips?: boolean; // https://github.com/FormidableLabs/victory/issues/964
}

class LineChart extends React.Component<ILineChartProps, ILineChartState> {
    private wrapper: Element;
    private t: TFunction;

    constructor(props: ILineChartProps & { t: TFunction }) {
        super(props);
        this.t = props.t;
        this.getChartData = this.getChartData.bind(this);
        this.renderDataSet = this.renderDataSet.bind(this);
        this.state = {
            domainPadding: undefined,
            domains: undefined,
            fontSize: undefined,
            xDomainLabels: undefined,
            xDomainValues: undefined,
        };
    }

    public componentDidMount() {
        this.buildDomains();
        if (this.wrapper) {
            this.calculateFontSize();
        }
    }


    public componentDidUpdate(prevProps: ILineChartProps) {
        const { dataSets } = this.props;
        const { dataSets: prevDataSets } = prevProps;
        const { fontSize } = this.state;
        if (dataSets !== prevDataSets) {
            this.buildDomains();
        }
        if (this.wrapper && !fontSize) {
            this.calculateFontSize();
        }
    }

    public componentDidCatch(error, errorInfo) {
        // eslint-disable-next-line no-console
        console.error("component caught error", error, "info", errorInfo);
        if (this.state.noTooltips) {
            this.setState({
                error,
            });
        } else {
            const errorMessage = (typeof error === "string") ?
                error :
                (error && error.message);
            this.setState({
                noTooltips: errorMessage.includes("Maximum call stack size exceeded"),
            });
        }
    }

    private addXPadding(domain: IDomain): IDomain {
        return ({
            x: domain.x ?
                ([domain?.x[0]-1, domain?.x[1] + 1]) :
                domain.x,
            y: domain.y
        });
    }

    public render() {
        const {
            dataSets,
            xAxisLabel,
            yLabelsRenderVertically,
        } = this.props;
        const {
            domains,
            xDomainLabels,
            xDomainValues,
            fontSize,
            error,
        } = this.state;
        if (!domains) {
            return null;
        }
        if (error) {
            return (
                <p>
                    {this.t(TranslationKeys.Analytics_ChartNotRenderedError)}
                </p>
            );
        }
        return (
            <div className="linechart-wrapper" ref={ el => this.wrapper = el }>
                {/* IE needs explicit height on svg */}
                <svg viewBox={"0 0 500 340"} height="475">
                    <defs>
                        <pattern id="chart-stripes"
                            width="10"
                            height="10"
                            patternUnits="userSpaceOnUse"
                            patternTransform="rotate(45 0 0)"
                        >
                            <line
                                x1="0"
                                y1="0"
                                x2="0"
                                y2="10"
                                style={{ stroke: "rgb(250, 194, 66)", strokeWidth: 8 }}
                            />
                        </pattern>
                    </defs>
                    <g transform="translate(20, 0)">
                        <VictoryAxis
                            tickValues={xDomainValues}
                            tickFormat={xDomainLabels}
                            style={{
                                axisLabel: {
                                    fontSize,
                                    padding: 40,
                                },
                                grid: { stroke: vars.lightGreyColor, strokeWidth: 1 },
                                tickLabels: {
                                    angle: yLabelsRenderVertically ? 90 : 0,
                                    fontFamily: vars.defaultFontName,
                                    fontSize,
                                    padding: yLabelsRenderVertically ? 20 : 5,
                                    verticalAnchor: "middle",
                                },
                                ticks: {
                                    size: 10,
                                },
                            }}
                            label={xAxisLabel}
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            domain={(yLabelsRenderVertically ? this.addXPadding(domains[0])  : domains[0] ) as any}
                            standalone={false}
                            crossAxis={true}
                            offsetY={this.calculateOffsetY()}
                        />
                        {this.renderYAxes()}
                        {dataSets.map(this.renderDataSet)}
                    </g>
                </svg>
            </div>
        );
    }

    private calculateOffsetY() {
        const { repositionOffsetY } = this.props;
        const { domains } = this.state;
        if (repositionOffsetY === undefined || !repositionOffsetY) {
            return undefined;
        }
        const unitHeightInPx = 48.5; // height of space between y axis ticks
        const tickCount = 5;
        const [firstDomain] = domains;
        if (firstDomain.y[0] === 0) {
            return undefined;
        }
        if (firstDomain.y[1] === 0) {
            return tickCount * unitHeightInPx;
        }
        const avg = (firstDomain.y[1] - firstDomain.y[0]) / tickCount;
        let y = firstDomain.y[0];
        let tickIndexOfZero = 0;
        while (tickIndexOfZero < tickCount) {
            y += avg;
            if (y > 0) {
                return (tickIndexOfZero + 1) * unitHeightInPx;
            }
            tickIndexOfZero++;
        }
        return firstDomain.y[1];
    }

    private calculateFontSize() {
        if (this.props.fontSize) {
            this.setState({
                fontSize: `${this.props.fontSize} px`,
            });
            return;
        }
        const { width } = this.wrapper.getBoundingClientRect();
        const fontSize = `${Math.round(width * (-0.008) + 16)} px`;
        this.setState({
            fontSize,
        });
    }

    private buildDomains() {
        const { dataSets } = this.props;
        const primaryDataSet = dataSets[0];
        const domainPadding = { x: 10, y: 10 };
        const xDomainValues = primaryDataSet.data.map((_, index) => index + 1);
        const xDomainLabels = primaryDataSet.data.map(dataItem => dataItem.x + "");
        const extendData = primaryDataSet.data.length < 10;
        const firstXValue = [...xDomainValues].shift();
        const lastXValue = [...xDomainValues].pop();
        const xDomain = [
            firstXValue - ( extendData ? 1 : 0),
            lastXValue + ( extendData ? 1 : 0),
        ];
        const domains = dataSets.map(dataSet => {
            const y = dataSet.data.reduce((reduced, dataItem) => {
                let [lowestSoFar, highestSoFar] = reduced;
                if (dataItem.y < lowestSoFar) {
                    (lowestSoFar = dataItem.y);
                }
                if (dataItem.y > highestSoFar) {
                    (highestSoFar = dataItem.y);
                }
                return [lowestSoFar, highestSoFar];
            }, [0, 0]);
            if (y[0] === 0 && y[1] < 10) { // minimum y is 10
                return {
                    x: xDomain,
                    y: [ 0, 10 ],
                };
            }
            return {
                x: xDomain,
                y,
            };
        });
        this.setState({
            domainPadding,
            domains,
            xDomainLabels,
            xDomainValues,
        });
    }

    private renderYAxes() {
        const { dataSets } = this.props;
        const { domains, domainPadding, fontSize } = this.state;
        const multipleDataSets = dataSets.length > 1;
        return dataSets.map((dataSet, i) => {
            const { yAxisLabel, yLabelTransform } = dataSet;
            const orientation = { 0: "left", 1: "right"}[i];
            return (
                <VictoryAxis
                    key={`lcY-${i}`}
                    dependentAxis={true}
                    tickCount={5}
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    tickFormat={yLabelTransform ? ((y) => yLabelTransform(y)) as any : ((y) => (y % 1 === 0) ? y : "")} // default tickFormat fn is: don't show if y is floating point
                    style={{
                        ...(i === 0 ? { grid: { stroke: vars.lightGreyColor, strokeWidth: 1 }} : {}),
                        axisLabel: {
                            padding: 35,
                            ...(multipleDataSets ? { stroke: dataSet.lineColor } : {}),
                            fontSize,
                            fontWeight: "normal",
                        },
                        tickLabels: {
                            fontFamily: vars.defaultFontName,
                            fontSize,
                            ...(multipleDataSets ? { stroke: dataSet.lineColor } : {}),
                        },
                    }}
                    label={yAxisLabel}
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    domain={domains[i] as any}
                    domainPadding={domainPadding}
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    orientation={orientation as any}
                    standalone={false}
                />
            );
        });
    }

    private renderDataSet(dataSet: ILineChartDataSet, i: number) {
        const domain = this.state.domains[i];
        const { hatchLastBar, yLabelsRenderVertically } = this.props;
        const { domainPadding, fontSize, noTooltips } = this.state;
        const chartData = this.getChartData(dataSet);
        const labelComponent = noTooltips ?
            <FakeToolTip /> :
            (
                <VictoryTooltip
                    renderInPortal={true}
                    orientation="bottom"
                    y={250}
                    flyoutPadding={{ top: 0, bottom: 0, left: 10, right: 10 }}
                />
            );
        return dataSet.renderAsBars ?
            (
                <VictoryBar
                    key={`bar${i}`}
                    data={chartData}
                    alignment="middle"
                    style={{
                        data: {
                            fill: this.fillBarFn(
                                chartData.length - 1,
                                hatchLastBar,
                                dataSet.lineColor,
                            ),
                            width: getBarWidth(chartData.length),
                        },
                        labels: {
                            fontSize,
                        },
                    }}
                    labelComponent={labelComponent}
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    domain={(yLabelsRenderVertically ? this.addXPadding(domain) : domain) as any}
                    standalone={false}
                />
            ) :
            (
                <VictoryLine
                    key={`line${i}`}
                    data={chartData}
                    labelComponent={labelComponent}
                    style={{
                        data: { stroke: dataSet.lineColor, pointerEvents: "none" },
                    }}
                    interpolation="monotoneX"
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    domain={(yLabelsRenderVertically ? this.addXPadding(domain) : domain) as any}
                    domainPadding={domainPadding}
                    standalone={false}
                />
            );
    }

    private fillBarFn(
        lastDataIndex: number,
        hatchLastBar: boolean,
        defaultColor: string,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ): (d: any) => string {
        return (d) => {
            const isLastBar = d.datum?.eventKey === lastDataIndex;
            return isLastBar && hatchLastBar ? "url(#chart-stripes)" : defaultColor;
        };
    }

    private getChartData(dataSet: ILineChartDataSet): ILineChartDataItem[] {
        const max = dataSet.data.length > 0 ? Math.max(...dataSet.data.map(({y}) => y)) : 0;
        const zeroValue = max > 0 ? max * 0.008 : 0.08;
        return dataSet.data.map((dataItem, index) => {
            return {
                label: dataItem.label,
                x: index + 1,
                y: dataItem.y === 0 ? zeroValue : dataItem.y,
                eventKey: index,
            };
        });
    }

}

const getBarWidth = (datasetSize: number): number => {
    if (datasetSize > 40) {
        return 5;
    } else if (datasetSize > 31) {
        return 7;
    } else if (datasetSize > 20) {
        return 10;
    } else {
        return 15;
    }
}

export default withTranslation()(LineChart);
