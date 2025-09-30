import * as immutable from "immutable";

type RequestResult = "pending" | "running" | "success" | "error";

interface Timings {
    normal: number;
    maximum: number;
}

interface Measurement {
    result: RequestResult;
    start?: Date;
    durationInMs?: number;
}

export interface MeasuredRequest {
    id: string;
    name: string;
    run (): Promise<void>;
    expectedTimings: Timings;
}


interface TestRunnerConfig {
    repeats: number;
    callbacks?: TestRunnerCallbacks;
}

export interface TestRunnerCallbacks {
    initializeTestCase(key: string, repetitions?: number): void;
    startTestCase(key: string, repetition?: number): void;
    completeTestCase(key: string, status: "error" | "success", duration: number, repetition?: number): void;
}

export type Report = immutable.Map<string, RequestReport>;
export class TestRunner {
    constructor(private config: TestRunnerConfig = { repeats: 1}) {

    }

    async run(requests: MeasuredRequest[]): Promise<Report> {
        const testKeys = requests.map(t => t.name);
        if (this.config.callbacks) {
            for (let i = 0; i < this.config.repeats; i++) {
                for (let j = 0; j < testKeys.length; j++) {
                    this.config.callbacks.initializeTestCase(testKeys[j], i);
                }
            }
        }
        let reportBuilder = ReportBuilder.intialize(testKeys, this.config.repeats);

        for (let i = 0; i < this.config.repeats; i++) {
            for (let j = 0; j < requests.length; j++) {
                const request = requests[j];
                let result: RequestResult = "success";
                const start = new Date();
                try {
                    reportBuilder = reportBuilder.startMeasurement(request.name, i);
                    if (this.config.callbacks) {
                        this.config.callbacks.startTestCase(request.name, i);
                    }
                    await request.run();
                } catch (err) {
                    result = "error";
                } finally {
                    const stop = new Date().getTime();
                    const durationInMs = stop - start.getTime();
                    if (this.config.callbacks) {
                        this.config.callbacks.completeTestCase(request.name, result, durationInMs, i);
                    }
                    reportBuilder = reportBuilder.completeMeasurement(request.name, result, durationInMs, i);
                }

            }
        }
        return reportBuilder.report;
    }
}

export class RequestReport implements Measurement {
    constructor(private measurements: immutable.List<Measurement> = immutable.List([])) {

    }

    get start(): Date {
        return this.measurements.get(0)?.start;
    }

    get result(): RequestResult {
        if (this.measurements.size === 0) {
            return undefined;
        }
        if (this.measurements.some(m => m.result === "running")) {
            return "running";
        }
        if (this.measurements.some(m => m.result === "pending")) {
            return "pending";
        }
        if (this.measurements.some(m => m.result === "error")) {
            return "error";
        }
        return "success";
    }

    get durationInMs(): number {
        const validMeasurments = this.measurements
            .filter(m => m.durationInMs !== undefined);
        if (validMeasurments.size === 0) {
            return undefined;
        }
        const sum = validMeasurments
            .reduce( (acc, m) => acc + m.durationInMs, 0);
        return sum / validMeasurments.size;
    }

    addNewMeasurement(): RequestReport {
        return new RequestReport(
            this.measurements.push({result: "pending"})
        );
    }

    resetMeasurement(repetition = 0): RequestReport {
        return new RequestReport(
            this.measurements.set(repetition, { result: "pending" })
        );
    }

    startMeasurement(repetition = 0): RequestReport {
        return new RequestReport(
            this.measurements.set(repetition, {
                result: "running",
                start: new Date()
            })
        )
    }

    completeMeasurement(result: "error" | "success", durationInMs: number, repetition = 0): RequestReport {
        const currentMeasurement = this.measurements.get(repetition);
        const measurement = {
            start: currentMeasurement.start,
            durationInMs,
            result
        };
        return new RequestReport(
            this.measurements.set(repetition, measurement)
        );
    }

    averageDuration(): number {
        throw new Error("not implemented");
    }
    percentile99Duration(): number {
        throw new Error("not implemented");
    }

    averagePercent(): number {
        throw new Error("not implemented");
    }
    percentile99Percent(): number {
        throw new Error("not implemented");
    }

    static initialize(repetitions: number): RequestReport {
        const element = { result: "pending"} as Measurement;
        const elements = [];
        for (let i = 0; i < repetitions; i++) {
            elements.push(element);
        }
        return new RequestReport(immutable.List.of(...elements));
    }
}


class ReportBuilder {

    constructor(readonly report: Report = immutable.Map()) {

    }

    startMeasurement(key: string, repetition = 0): ReportBuilder {
        const currentReport = this.report.get(key);
        return new ReportBuilder(
            this.report.set(
                key,
                currentReport.startMeasurement(repetition)
            )
        );
    }

    completeMeasurement(key: string, result: "error" | "success", durationInMs: number, repetition = 0): ReportBuilder {
        const currentReport = this.report.get(key);
        return new ReportBuilder(
            this.report.set(
                key,
                currentReport.completeMeasurement(result, durationInMs, repetition)
            )
        );
    }

    resetMeasurement(key: string, repetition = 0): ReportBuilder {
        const currentReport = this.report.get(key) || new RequestReport();
        return new ReportBuilder(
            this.report.set(
                key,
                currentReport.resetMeasurement(repetition)
            )
        );
    }

    static intialize(keys: string[], repetitions: number): ReportBuilder {
        return keys.reduce(
            (acc, key) => {
                let newAcc = acc;
                for (let i = 0; i < repetitions; i++) {
                    newAcc = newAcc.resetMeasurement(key, i);
                }
                return newAcc;
            }, new ReportBuilder()
        )
    }
}
