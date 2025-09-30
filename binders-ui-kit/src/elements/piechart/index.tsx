import * as React from "react";
import { VictoryPie } from "victory";

export interface IPieChartDataItem {
    label: string;
    percentage: number;
}

export interface IPieChartProps {
    data: IPieChartDataItem[];
    colorScale?: string[];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
class PieChart extends React.Component<IPieChartProps, any> {

    private static defaultProps = {
        colorScale: ["#cedd91", "#8b103a", "#0e5992", "#4c33cb", "#5e693f",
            "#289179", "#97e15e", "#bbe37c", "#3aeb2b", "#2eca2c", "#f97771"],
    };

    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    constructor(props) {
        super(props);
        this.getChartData = this.getChartData.bind(this);
    }

    public render(): JSX.Element {
        return (
            <div className="piechart-wrapper">
                <VictoryPie
                    data={this.getChartData()}
                    colorScale={this.props.colorScale}
                    innerRadius={70}
                    padding={60}
                />
            </div>
        );
    }

    // eslint-disable-next-line @typescript-eslint/ban-types
    private getChartData(): object[] {
        return this.props.data.map((dataItem, index) => {
            return {
                label: dataItem.label,
                x: index,
                y: dataItem.percentage,
            };
        });
    }
}

export default PieChart;
