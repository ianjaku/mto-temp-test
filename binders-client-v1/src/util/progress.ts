import { humanizeDuration, round } from "./formatting";

export type UnitFormatter = (units: number) => string;
export const DefaultUnitFormatter: UnitFormatter = (units) => round(units, 2).toLocaleString();

export class Progress {
    readonly elapsed: number;
    readonly speed: number;
    readonly eta: number;

    constructor(
        readonly processed: number,
        readonly failed: number,
        readonly total: number,
        private readonly startedAt: Date,
    ) {
        this.elapsed = (new Date().getTime() - startedAt.getTime());
        this.speed = this.elapsed === 0 ? 0 : processed / this.elapsed;
        this.eta = this.speed === 0 ? 0 : (total - processed) / this.speed;
    }

    static empty(): Progress {
        return new Progress(0, 0, 0, new Date());
    }

    static finite(total: number): Progress {
        return new Progress(0, 0, total, new Date());
    }

    reset(): Progress {
        return new Progress(0, 0, this.total, new Date());
    }

    setProcessed(processed: number): Progress {
        return new Progress(Math.min(processed, this.total), this.failed, this.total, this.startedAt);
    }

    setFailed(fails: number): Progress {
        return new Progress(this.processed, fails, this.total, this.startedAt);
    }

    setTotal(total: number): Progress {
        return new Progress(this.processed, this.failed, total, this.startedAt);
    }

    incTotal(by = 1): Progress {
        return this.setTotal(this.total + by);
    }

    tick(): Progress {
        return this.tickBy(1);
    }

    tickBy(by: number): Progress {
        return this.setProcessed(this.processed + by);
    }

    tickFailed(): Progress {
        return this.setFailed(this.failed + 1);
    }

    formatElapsed(): string {
        return humanizeDuration(this.elapsed);
    }

    formatETA(): string {
        return humanizeDuration(this.eta);
    }

    formatSpeedAvg(unitFormatter: (units: number) => string = DefaultUnitFormatter): string {
        return `${unitFormatter(1000 * this.speed)}/s`;
    }

    formatDefault(unitFormatter: (units: number) => string = DefaultUnitFormatter): string {
        return [
            `Progress: ${this.formatProgressAbs(unitFormatter)} (${this.formatProgressPct()})`,
            `Failed: ${this.failed}`,
            `Elapsed: ${this.formatElapsed()}`,
            `ETA: ${this.formatETA()}`,
            `Speed: ${this.formatSpeedAvg(unitFormatter)}`,
        ].join(", ");
    }

    formatProgressAbs(unitFormatter: (units: number) => string = DefaultUnitFormatter): string {
        const processedStr = unitFormatter(this.processed).padStart(unitFormatter(this.total).length, " ");
        return `${processedStr} / ${unitFormatter(this.total)}`;
    }

    formatProgressPct(): string {
        if (this.total === 0) {
            return "0.00%";
        }
        const progressPct = round(100 * this.processed / this.total, 2);
        const progressStr = `${(progressPct).toFixed(2)}`.padStart(5, " ");
        return `${progressStr}%`;
    }

}

