import { getFailedSteps, getStepLogs, getTestCases } from "./api";

type TestCategory = "UNIT" | "INTEGRATION" | "PLAYWRIGHT" | "DEVELOP_ENV";

interface TestCaseFailure {
    category: TestCategory;
    suite: string;
    case: string;
    timedOut: false;
}

interface TestTimeout {
    category: TestCategory;
    timedOut: true;
}

type TestFailure = TestCaseFailure | TestTimeout;

type PipelineFailure =
    "OTHER" |
    "DEPLOY_FAILED" |
    TestFailure
;

type PipelineResult = "SUCCESS" | "FAILED" | "STOPPED" | "IN_PROGRESS" | "PAUSED";

export interface PipelineStatus {
    status: PipelineResult;
    buildNumber: number;
    failures: PipelineFailure[];
    durationInSeconds: number;
    createdOn: Date;
    completedOn?: Date;
}

export interface FailedSuite {
    category: TestCategory;
    suite: string;
    count: number;
    pipelines: number[];
}

export function isPipelineSuccessFul(pipeline) {
    return pipeline?.state?.name === "COMPLETED" &&
        pipeline?.state?.result?.name === "SUCCESSFUL";
}

function isUnitTestCommand(command: string): boolean {
    return command.includes("unitTests.ts");
}
function isIntegrationTestCommand(command: string): boolean {
    return command.includes("runTestsOnStaging.ts") &&
        command.includes("--test-type=INTEGRATION")
}

function isPlaywrightTestCommand(command: string): boolean {
    return command.includes("runTestsOnStaging.ts") &&
        command.includes("--test-type=PLAYWRIGHT")
}


function extractFailedUnitTestCases(lines: string[]): PipelineFailure[] {
    const failedPackages = lines.map(line => {
        const matches = line.match(/unittest\s+@binders\/(\S+)\s+FAIL/);
        if (matches) {
            return matches[1]
        }
        return undefined;
    });
    return failedPackages
        .filter(p => !!p)
        .map(p => ({
            category: "UNIT",
            suite: p,
            case: "n/a",
            timedOut: false
        }));
}

function extractFailedIntegrationTestCases(lines: string[]): PipelineFailure[] {
    const failedPackages = lines.map(line => {
        const matches = line.match(/integrationtest\s+@binders\/(\S+)\s+FAIL/);
        if (matches) {
            return matches[1]
        }
        return undefined;
    });
    return failedPackages
        .filter(p => !!p)
        .map(p => ({
            category: "INTEGRATION",
            suite: p,
            case: "n/a",
            timedOut: false
        }));
}

async function mapFailedUnitTestStep(token, step): Promise<PipelineFailure|PipelineFailure[]> {
    const logs = await getStepLogs(token, step);
    const lines = logs.split("\n");
    return extractFailedUnitTestCases(lines);
}
async function mapFailedIntegrationTestStep(token, step): Promise<PipelineFailure|PipelineFailure[]> {
    const logs = await getStepLogs(token, step);
    const lines = logs.split("\n");
    return extractFailedIntegrationTestCases(lines);
}

async function mapFailedE2ETestStep(token, step, category): Promise<PipelineFailure|PipelineFailure[]> {
    try {
        const cases = await getTestCases(token, step);
        return cases.map(testCase => ({
            category,
            suite: testCase.package_name,
            case: testCase.fully_qualified_name,
            timedOut: false
        }));
    } catch (e) {
        if (e.error?.error?.detail?.includes("No test report exists for the step with the uuid provided")) {
            return {
                category,
                timedOut: true
            }
        }
        throw e;
    }
}

async function mapFailedPlaywrightTestStep(token, step): Promise<PipelineFailure|PipelineFailure[]> {
    return mapFailedE2ETestStep(token, step, "PLAYWRIGHT");
}

function isDeployCommand(command: string) {
    return command.includes("/deploy.ts")
}


export async function mapStepToFailures(token: string, step): Promise<PipelineFailure | PipelineFailure[]> {
    const commands = step.script_commands.map(sc => sc.command);
    if (commands.some(isUnitTestCommand)) {
        return mapFailedUnitTestStep(token, step);
    }
    if (commands.some(isIntegrationTestCommand)) {
        return mapFailedIntegrationTestStep(token, step);
    }
    if (commands.some(isPlaywrightTestCommand)) {
        return mapFailedPlaywrightTestStep(token, step);
    }
    if (commands.some(isDeployCommand)) {
        return "DEPLOY_FAILED";
    }
    return "OTHER";
}


export async function getPipelineStatus(token: string, pipeline): Promise<PipelineStatus> {
    if (isPipelineSuccessFul(pipeline)) {
        return {
            status: "SUCCESS",
            buildNumber: pipeline.build_number,
            failures: [],
            durationInSeconds: pipeline.duration_in_seconds,
            createdOn: new Date(pipeline.created_on),
            completedOn: pipeline.completed_on && new Date(pipeline.completed_on)
        }
    }
    return getPipelineFailures(token, pipeline);
}

function extractPipelineStatus(pipeline): PipelineResult {
    if (pipeline.state.name === "COMPLETED") {
        return pipeline.state.result?.name === "STOPPED" ? "STOPPED" : "FAILED";
    }
    if (pipeline.state.name === "IN_PROGRESS" && pipeline.state.stage?.name === "PAUSED") {
        return "PAUSED";
    }
    return pipeline.state.name;
}

async function getPipelineFailures(token: string, pipeline): Promise<PipelineStatus> {
    const failedSteps = await getFailedSteps(token, pipeline);
    const allFailures = [];
    for (const failedStep of failedSteps) {
        const failures = await mapStepToFailures(token, failedStep);
        allFailures.push(failures);
    }
    const failures = allFailures.flat();
    const status = extractPipelineStatus(pipeline);
    return {
        status,
        buildNumber: pipeline.build_number,
        failures,
        durationInSeconds: pipeline.duration_in_seconds,
        createdOn: new Date(pipeline.created_on),
        completedOn: pipeline.completed_on && new Date(pipeline.completed_on)
    }
}




export interface PipelineReport {
    start: Date;
    end: Date;
    pipelineCount: number;
    successfulCount: number;
    failedCount: number;
    failureReport: {
        [category: string]: {
            count: number,
            breakdown: {
                [suite: string]: {
                    count: number,
                    pipelines: number[]
                }
            }
        }
    }
}
export function buildPipelineReport(statuses: PipelineStatus[], start: Date, end: Date): PipelineReport {
    const report: PipelineReport = {
        pipelineCount: statuses.length,
        successfulCount: 0,
        failedCount: 0,
        failureReport: {},
        start,
        end
    }
    for (const status of statuses) {
        if (status.failures.length === 0) {
            report.successfulCount++;
        } else {
            report.failedCount++;
            for (const failure of status.failures) {
                if (failure === "DEPLOY_FAILED" || failure === "OTHER") {
                    report.failureReport[failure] = report.failureReport[failure] || { count: 0, breakdown: {} };
                    report.failureReport[failure].count++;
                    report.failureReport[failure].breakdown["n/a"] = report.failureReport[failure].breakdown["n/a"] || { count: 0, pipelines: [] };
                    report.failureReport[failure].breakdown["n/a"].count++;
                    const pipelines = report.failureReport[failure].breakdown["n/a"].pipelines;
                    if (!pipelines.includes(status.buildNumber)) {
                        pipelines.push(status.buildNumber);
                    }
                    continue;
                }
                report.failureReport[failure.category] = report.failureReport[failure.category] || { count: 0, breakdown: {} };
                report.failureReport[failure.category].count++;
                const suite = (failure as TestCaseFailure).suite || "TimedOut";
                report.failureReport[failure.category].breakdown[suite] = report.failureReport[failure.category].breakdown[suite] || { count: 0, pipelines: [] };
                report.failureReport[failure.category].breakdown[suite].count++;
                const pipelines = report.failureReport[failure.category].breakdown[suite].pipelines;
                if (!pipelines.includes(status.buildNumber)) {
                    pipelines.push(status.buildNumber);
                }
            }
        }
    }
    return report;
}


export function sortReport(report: PipelineReport): FailedSuite[] {
    const flatReport: FailedSuite[] = [];
    for (const category in report.failureReport) {
        const categoryReport = report.failureReport[category];
        for (const suite in categoryReport.breakdown) {
            const suiteReport = categoryReport.breakdown[suite];
            flatReport.push({
                category: category as TestCategory,
                suite,
                count: suiteReport.count,
                pipelines: suiteReport.pipelines
            });
        }
    }
    return flatReport.sort((a, b) => b.pipelines.length - a.pipelines.length);
}