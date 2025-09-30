import * as React from "react";
import LineChartWithRanges from "../../elements/linechart/withRanges";
import "./docviews.styl";
import "../stats.styl";

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
const DocViewsStat = (props) => (
    <LineChartWithRanges {...props} cssPrefix="docviews-stat" />
);

export default DocViewsStat;
