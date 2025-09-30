import * as React from "react";
import * as immutable from "immutable";
import {
    MeasuredRequest,
    Report,
    RequestReport,
    TestRunner,
    TestRunnerCallbacks
} from "./util";
import Refresh from "@binders/ui-kit/lib/elements/button/RefreshButton";
import Table from "@binders/ui-kit/lib/elements/Table/SimpleTable";
import { buildTestSet } from "./tests";
import { useState } from "react";
import "./performance.styl";

const tableHeaders = ["Case", "Status", "Duration", "Last start", ""];

const testset = buildTestSet();

export default function Performance(): React.ReactElement {
    const [report, setReport] = useState<Report>(immutable.Map());

    const initializeTestCases = (keys: string[], repetitions = 1) => {
        setReport(prev => keys.reduce(
            (acc, key) => acc.set(key, RequestReport.initialize(repetitions)),
            prev
        ));
    };

    const initializeTestCase = (key: string, repetition = 0) => {
        setReport(prev => {
            const currentReport = prev.get(key);
            return prev.set(key, currentReport.resetMeasurement(repetition));
        });
    };

    const startTestCase = (key: string, repetition = 0) => {
        setReport(prev => {
            const currentReport = prev.get(key);
            return prev.set(key, currentReport.startMeasurement(repetition));
        });
    };

    const completeTestCase = (key: string, result: "success" | "error", durationInMs: number, repetition = 0) => {
        setReport(prev => {
            const currentReport = prev.get(key);
            const newReport = currentReport.completeMeasurement(result, durationInMs, repetition);
            return prev.set(key, newReport);
        });
    };

    const callbacks: TestRunnerCallbacks = {
        initializeTestCase,
        startTestCase,
        completeTestCase,
    }

    const runAll = () => runTests(callbacks, testset);

    React.useEffect(
        () => initializeTestCases(testset.map(t => t.name)),
        []
    );

    const { tableData, anyRunning } = buildTableData(callbacks, report);
    const canRun = !anyRunning;
    return (
        <div className="tabs-content">
            <div className="performance-section">
                <h1>Performance</h1>
                <div className="performance-run-all">
                    <span>Run all tests</span>
                    <Refresh onClick={runAll} disabled={!canRun} />
                </div>
                <Table
                    customHeaders={tableHeaders}
                    data={tableData}
                />
            </div>
        </div>
    )
}

function getTestRunner(callbacks: TestRunnerCallbacks) {
    const testOptions = {
        repeats: 1,
        callbacks
    }
    return new TestRunner(testOptions)
}

function runTests(callbacks: TestRunnerCallbacks, requests: MeasuredRequest[]): Promise<Report> {
    const runner = getTestRunner(callbacks);
    return runner.run(requests);
}

function buildDurationCell(t: MeasuredRequest, durationInMs: number | undefined) {
    if (durationInMs == undefined) {
        return "";
    }
    const humanDuration = `${durationInMs} ms`;
    const delay = 100.0 * ((durationInMs / t.expectedTimings.maximum) - 1);
    const delayUi = delay.toFixed(2);
    const suffix = delay <= 0 ? delayUi : `+${delayUi}`;
    const color = delay <= 0 ? "green" : "red";
    const style = { color };
    return (
        <span style={style}>{humanDuration} ({suffix} %)</span>
    )
}

function testToTableRow(callbacks: TestRunnerCallbacks, t: MeasuredRequest, report: Report) {
    const requestReport = report ? report.get(t.name) : undefined;
    const onClick = () => runTests(callbacks, [t]);
    const result = requestReport?.result;
    const canRun = result !== "running";
    return [
        t.name,
        result,
        buildDurationCell(t, requestReport?.durationInMs),
        requestReport?.start?.toISOString(),
        (<Refresh onClick={onClick} disabled={!canRun} />)
    ]
}

function buildTableData(callbacks: TestRunnerCallbacks, report: Report | undefined) {
    const tableData = testset.map(t => testToTableRow(callbacks, t, report));
    const anyRunning = tableData.some(d => d[1] === "running");
    return {
        tableData,
        anyRunning
    }
}

