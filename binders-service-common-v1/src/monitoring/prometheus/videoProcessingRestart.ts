import * as prometheusClient from "prom-client";
import { createCounter, getMetricName } from "../prometheus";

let videoProcessingRestartsCounter: prometheusClient.Counter | undefined;

const VISUAL_ID_LABEL = "visual_id";
const JOB_STATE_LABEL = "job_state";

export const createVideoProcessingRestartsCounter = (): void => {
    videoProcessingRestartsCounter = createCounter(
        getMetricName("video_processing_restarts"),
        "Counter tracking the total number of video processing restarts",
        [VISUAL_ID_LABEL, JOB_STATE_LABEL],
    );
};

export const incrementVideoProcessingRestartsCounterByOne = (visualId: string, jobState: string): void => {
    videoProcessingRestartsCounter?.inc({
        [VISUAL_ID_LABEL]: visualId,
        [JOB_STATE_LABEL]: jobState,
    }, 1);
};
