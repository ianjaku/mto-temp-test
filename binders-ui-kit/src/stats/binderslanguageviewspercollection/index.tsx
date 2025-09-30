import * as React from "react";
import LineChart, { ILineChartDataSet } from "../../elements/linechart";
import { TranslationKeys } from "@binders/client/lib/react/i18n/translations";
import vars from "../../variables";
import { withTranslation } from "@binders/client/lib/react/i18n";
import "../stats.styl";
import "./timeperchunk.styl";

export interface ILanguageStats {
    languageCode: string;
    amount: number;
}

export interface IBindersLanguageViewsPerCollectionProps {
    languageStats: ILanguageStats[];
    timeLineColor?: string;
    wordsLineColor?: string;
    title?: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
class BindersLanguageViewsPerCollection extends React.Component<IBindersLanguageViewsPerCollectionProps, any> {
    static defaultProps = {
        timeLineColor: "#154360",
        wordsLineColor: vars.accentColor,
    };
    private t;

    constructor(props) {
        super(props);
        this.t = props.t;
        this.extractLanguageViewsData = this.extractLanguageViewsData.bind(this);
        this.getHighestYValue = this.getHighestYValue.bind(this);
    }

    public render() {
        return (
            <div className="timeperchunk-stat">
                <div className="stats-header">
                    <h2 className="stats-header-title">
                        { this.props.title }
                    </h2>
                </div>
                <div className="stats-body">
                    <LineChart
                        dataSets={[
                            this.buildLanguageCountDataSet(),
                        ]}
                        xAxisLabel={this.t(TranslationKeys.General_Languages)}
                        yDomain={[10, this.getHighestYValue()]}
                    />
                </div>
            </div>
        );
    }

    private buildLanguageCountDataSet(): ILineChartDataSet {
        return {
            data: this.extractLanguageViewsData(),
            lineColor: this.props.wordsLineColor,
            renderAsBars: true,
            yAxisLabel: this.t(TranslationKeys.Analytics_View, { count: 2 }),
        };
    }

    private extractLanguageViewsData() {
        return this.props.languageStats.map(stat => ({
            label: `${stat.amount} ${this.t(TranslationKeys.Analytics_View, {count: stat.amount})}`,
            x: stat.languageCode,
            y: stat.amount,
        }));
    }

    private getHighestYValue(): number {
        return this.props.languageStats.reduce((max, stat) => {
            if (stat.amount > max) {
                max = stat.amount;
            }
            return max;
        }, 0);
    }
}

export default withTranslation()(BindersLanguageViewsPerCollection);
