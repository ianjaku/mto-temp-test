import * as React from "react";
import { TranslationKeys } from "@binders/client/lib/react/i18n/translations";
import { VictoryPie } from "victory";
import cx from "classnames";
import { withTranslation } from "@binders/client/lib/react/i18n";
import "../stats.styl";
import "./readsperlanguage.styl";

export interface IReadsPerLanguageStatItem {
    languageName: string;
    reads: number;
    isMachineTranslation?: boolean;
}

export interface IReadsPerLanguageProps {
    data: IReadsPerLanguageStatItem[];
    colorScale?: string[];
    showLegend?: boolean;
    title?: string;
}

export interface IReadPerLanguageChartData {
    label: string;
    x: number;
    y: number;
    isMachineTranslation: boolean;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
class ReadsPerLanguageStat extends React.Component<IReadsPerLanguageProps, any> {

    static defaultProps = {
        colorScale: [
            "#cedd91",
            "#8b103a",
            "#0e5992",
            "#4c33cb",
            "#5e693f",
            "#289179",
            "#97e15e",
            "#bbe37c",
            "#3aeb2b",
            "#2eca2c",
            "#f97771",
        ],
        showLegend: true,
    };

    private t;

    constructor(props) {
        super(props);
        this.t = props.t;
        this.getChartData = this.getChartData.bind(this);
        this.renderChart = this.renderChart.bind(this);
    }

    public renderLegend(chartData: IReadPerLanguageChartData[], colorScale: string[], showLegend = true) {

        const chartDataSorted = chartData.sort((a, b) => {
            if (a.label === "other") {
                return 1;
            }
            return b.label === "other" ? -1 : b.y - a.y;
        });

        return showLegend ?
            (
                <div className="piechart-legend-wrapper">
                    <ul className="piechart-legend">
                        {chartDataSorted.map((data, index) => {
                            return (
                                <li key={`clr${index}`}>
                                    <div
                                        className="color"
                                        style={{ backgroundColor: colorScale[index] }}
                                    />
                                    <span className={data.isMachineTranslation ? "machine-translation" : ""}>
                                        {`${data.label} : ${data.y} ${this.t(TranslationKeys.Analytics_View, { count: data.y })}`}
                                        {data.isMachineTranslation ? `(${this.t(TranslationKeys.Edit_MachineTranslation)})` : ""}
                                    </span>
                                </li>
                            )
                        }
                        )}
                    </ul>
                </div>
            ) :
            undefined;
    }

    public renderChart() {
        const { colorScale, showLegend } = this.props;
        const chartData = this.getChartData();
        const className = `reads-per-language-stat ${showLegend ? "show-legend" : ""}`;
        return (
            <div className={className}>
                <svg width={300} height={300}>
                    <VictoryPie
                        standalone={false}
                        data={chartData}
                        colorScale={colorScale}
                        innerRadius={40}
                        padding={60}
                        width={300}
                        height={300}
                    />
                </svg>
                {this.renderLegend(chartData, colorScale, showLegend)}
            </div>
        );
    }

    public render() {
        const { data } = this.props;
        const isEmpty = data.length === 0;
        return (
            <div className={cx("reads-per-language-stat", { "reads-per-language--empty": isEmpty })}>
                <div className={cx("reads-per-language-stat-header", "stats-header")}>
                    <h2 className={cx("reads-per-language-stat-header-title", "stats-header-title")}>
                        {this.props.title}
                    </h2>
                </div>
                <div className="stats-body">
                    {
                        isEmpty ?
                            (
                                <p>{this.t(TranslationKeys.Analytics_NoViewsYet)}</p>
                            ) :
                            this.renderChart()
                    }
                </div>
            </div>
        )
    }

    private aggregateLanguageViews(chartData: IReadPerLanguageChartData[]) {
        const views = chartData.reduce((count, chartDataEntry) => count + chartDataEntry.y, 0);
        return {
            x: 5,
            y: views,
            label: this.t(TranslationKeys.General_Other),
            isMachineTranslation: false,
        };
    }

    private getChartData(): IReadPerLanguageChartData[] {
        const { data } = this.props;
        let chartData = data.map((item, index) => {
            return {
                isMachineTranslation: item.isMachineTranslation || false,
                label: item.languageName,
                x: index,
                y: item.reads,
            };
        });
        if (chartData.length > 5) {
            chartData = [...chartData.slice(0, 4), this.aggregateLanguageViews(chartData.slice(4))];
        }
        return chartData;
    }
}

export default withTranslation()(ReadsPerLanguageStat);
