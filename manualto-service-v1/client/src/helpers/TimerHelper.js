class Timer {
    static create() {
        return new Timer();
    }

    start() {
        this.startTime = Date.now();
        return this.startTime;
    }

    stop() {
        this.endTime = Date.now();
        return Date.now() - this.startTime;
    }

    difference() {
        return this.endTime - this.startTime;
    }
}

export default Timer;
