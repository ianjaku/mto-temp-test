import { IBoundary } from "./highlight";

export class BoundaryLoop {

    private currentTimeout: number | null = null;
    private isPaused = false;
    private currentIndex = 0;

    constructor(
        private audio: HTMLAudioElement,
        private boundaries: IBoundary[],
        private handleBoundary: (boundary: IBoundary | null) => void,
        private variance = 4
    ) {}

    pause(): void {
        this.isPaused = true;
        if (this.currentTimeout != null) {
            clearTimeout(this.currentTimeout);
        }
    }

    stop(): void {
        this.callHandleBoundary(null);
        this.currentIndex = 0;
        if (this.currentTimeout != null) {
            clearTimeout(this.currentTimeout);
        }
    }
    
    start(): void {
        this.isPaused = false;
        if (this.currentIndex >= this.boundaries.length) {
            this.callHandleBoundary(null);
            return;
        }
        
        const boundary = this.boundaries[this.currentIndex];
        const timeUntilBoundaryMS = boundary.offsetMS - this.currentTimeMS();

        // If we're behind, skip this word
        if (timeUntilBoundaryMS < -this.variance) {
            this.currentIndex += 1;
            return this.start()
        }

        // If we're a little bit ahead, higlight this word and go to the next
        if (timeUntilBoundaryMS < this.variance) {
            this.callHandleBoundary(boundary);
            this.currentIndex += 1;
            return this.start();
        }

        // Wait for boundary to become active
        this.currentTimeout = setTimeout(
            () => this.handleTimeout(boundary),
            timeUntilBoundaryMS
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ) as any;
    }

    private handleTimeout(boundary: IBoundary): void {
        if (this.isPaused) return;

        const timeUntilBoundaryMS = boundary.offsetMS - this.currentTimeMS();
        if (timeUntilBoundaryMS > this.variance) {
            return this.start();
        }

        this.currentIndex += 1;
        this.start();
        this.callHandleBoundary(boundary);
    }

    private currentTimeMS(): number {
        return this.audio.currentTime * 1000;
    }

    private callHandleBoundary(boundary: IBoundary | null): void {
        if (this.isPaused) return;
        this.handleBoundary(boundary);
    }

    static fromAudioEvents(
        audio: HTMLAudioElement,
        boundaries: IBoundary[],
        handleBoundary: (boundary: IBoundary | null) => void
    ): BoundaryLoop {
        const loop = new BoundaryLoop(
            audio,
            boundaries,
            handleBoundary
        )
        audio.addEventListener("play", () => {
            loop.start();
        });
        audio.addEventListener("pause", () => {
            loop.pause();
        });
        audio.addEventListener("reset", () => {
            loop.stop();
        })

        return loop;
    }
}
