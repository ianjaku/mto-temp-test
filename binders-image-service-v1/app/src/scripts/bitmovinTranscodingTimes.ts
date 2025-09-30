/* eslint-disable no-console */
import BitmovinApi, { Encoding, PaginationResponse, Task } from "@bitmovin/api-sdk";
import { MailgunConfig, MailgunMailer } from "@binders/binders-service-common/lib/mail/mailgun";
import { endOfDay, startOfDay, subDays } from "date-fns";
import { error, info, ok } from "@binders/client/lib/util/cli";
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import RateLimiter from "@binders/binders-service-common/lib/util/rateLimiter";
import { fmtDateIso8601TimeLocalizedTZ } from "@binders/client/lib/util/date";
import { stripHTML } from "@binders/client/lib/util/html";

const config = BindersConfig.get();

const DAY_COUNT = 7;

const MessageTexts = {
    downloadStart: "Download of input file in progress",
    downloadFinish: "Download of input file finished",
    analyzingStart: "Analyzing input in progress",
    analyzingFinish: "Analyzing input finished",
    perTitleAnalysisSetupStart: "Per-Title analysis setup started",
    perTitleAnalysisSetupFinish: "Per-Title analysis setup finished",
    perTitleAnalysisStart: "Per-Title analysis started",
    perTitleAnalysisFinish: "Per-Title analysis finished",
    perTitleEncodingConfigurationStart: "Per-Title Encoding configuration started",
    perTitleEncodingConfigurationFinish: "Per-Title Encoding configuration finished",
    encodingStart: "Encoding in progress",
    encodingFinish: "Encoding has finished",
    generateManifestStart: "Start generating VoD manifest",
    generateManifestFinish: "Finished generating Vod manifest",
    generateDashManifestStart: "Start generating VoD DASH",
    generateDashManifestFinish: "Finished generating VoD DASH",
    generateHlsManifestStart: "Start generating VoD HLS",
    generateHlsManifestFinish: "Finished generating VoD HLS",
    progressiveMp4MuxingStart: "Progressive MP4 muxing in progress",
    progressiveMp4MuxingFinish: "Progressive MP4 muxing finished",
    encodingProcessFinished: "Encoding process finished",
}

type TaskDurations<D = number> = {
    [state: string]: D;
};

type TaskSummary = {
    encodingId: string;
    taskDurations: TaskDurations;
}

type TasksOverview = {
    taskDurationsMulti: TaskDurationsMulti;
    longestRunningEncoding: { encodingId: string, duration: number };
}

type TaskDurationsMulti = {
    [state: string]: number[];
};

type Report<D = number> = {
    median: TaskDurations<D>;
    average: TaskDurations<D>;
    min: TaskDurations<D>;
    max: TaskDurations<D>;
}

function format(duration: number | undefined): string {
    if (duration === undefined) {
        return "N/A";
    }
    const hours = Math.floor(duration / 3600000);
    const minutes = Math.floor((duration % 3600000) / 60000);
    const seconds = Math.floor((duration % 60000) / 1000);
    return `${hours > 0 ? hours + "h " : ""}${minutes > 0 ? minutes + "m " : ""}${seconds}s`;
}

function parseTask(encodingId: string, encodingTask: Task): TaskSummary {
    const findDate = (text: string): Date => encodingTask.messages.find(m => m.text.includes(text))?.date;

    const downloadStartDate = findDate(MessageTexts.downloadStart);
    const downloadEndDate = findDate(MessageTexts.downloadFinish);
    const analyzingStartDate = findDate(MessageTexts.analyzingStart);
    const analyzingEndDate = findDate(MessageTexts.analyzingFinish);
    const perTitleAnalysisSetupStartDate = findDate(MessageTexts.perTitleAnalysisSetupStart);
    const perTitleAnalysisSetupEndDate = findDate(MessageTexts.perTitleAnalysisSetupFinish);
    const perTitleAnalysisStartDate = findDate(MessageTexts.perTitleAnalysisStart);
    const perTitleAnalysisEndDate = findDate(MessageTexts.perTitleAnalysisFinish);
    const perTitleEncodingConfigurationStartDate = findDate(MessageTexts.perTitleEncodingConfigurationStart);
    const perTitleEncodingConfigurationEndDate = findDate(MessageTexts.perTitleEncodingConfigurationFinish);
    const encodingStartDate = findDate(MessageTexts.encodingStart);
    const encodingEndDate = findDate(MessageTexts.encodingFinish);
    const generateManifestStartDate = findDate(MessageTexts.generateManifestStart);
    const generateManifestEndDate = findDate(MessageTexts.generateManifestFinish);
    const generateDashManifestStartDate = findDate(MessageTexts.generateDashManifestStart);
    const generateDashManifestEndDate = findDate(MessageTexts.generateDashManifestFinish);
    const generateHlsManifestStartDate = findDate(MessageTexts.generateHlsManifestStart);
    const generateHlsManifestEndDate = findDate(MessageTexts.generateHlsManifestFinish);
    const progressiveMp4MuxingStartDate = findDate(MessageTexts.progressiveMp4MuxingStart);
    const progressiveMp4MuxingEndDate = findDate(MessageTexts.progressiveMp4MuxingFinish);
    const encodingProcessFinishedDate = findDate(MessageTexts.encodingProcessFinished);
    const taskSummary = {
        encodingId,
        taskDurations: {
            created: encodingTask.createdAt && encodingTask.queuedAt ? encodingTask.queuedAt.getTime() - encodingTask.createdAt.getTime() : undefined,
            queued: encodingTask.queuedAt && encodingTask.runningAt ? encodingTask.runningAt.getTime() - encodingTask.queuedAt.getTime() : undefined,
            downloading: downloadStartDate?.getTime() && downloadEndDate?.getTime() ? downloadEndDate.getTime() - downloadStartDate.getTime() : undefined,
            analyzing: analyzingStartDate?.getTime() && analyzingEndDate?.getTime() ? analyzingEndDate.getTime() - analyzingStartDate.getTime() : undefined,
            perTitleAnalysisSetup: perTitleAnalysisSetupStartDate?.getTime() && perTitleAnalysisSetupEndDate?.getTime() ? perTitleAnalysisSetupEndDate.getTime() - perTitleAnalysisSetupStartDate.getTime() : undefined,
            perTitleAnalysis: perTitleAnalysisStartDate?.getTime() && perTitleAnalysisEndDate?.getTime() ? perTitleAnalysisEndDate.getTime() - perTitleAnalysisStartDate.getTime() : undefined,
            perTitleEncodingConfiguration: perTitleEncodingConfigurationStartDate?.getTime() && perTitleEncodingConfigurationEndDate?.getTime() ? perTitleEncodingConfigurationEndDate.getTime() - perTitleEncodingConfigurationStartDate.getTime() : undefined,
            encoding: encodingStartDate?.getTime() && encodingEndDate?.getTime() ? encodingEndDate.getTime() - encodingStartDate.getTime() : undefined,
            generateVodManifest: generateManifestStartDate?.getTime() && generateManifestEndDate?.getTime() ? generateManifestEndDate.getTime() - generateManifestStartDate.getTime() : undefined,
            generateVodDashManifest: generateDashManifestStartDate?.getTime() && generateDashManifestEndDate?.getTime() ? generateDashManifestEndDate.getTime() - generateDashManifestStartDate.getTime() : undefined,
            generateVodHlsManifest: generateHlsManifestStartDate?.getTime() && generateHlsManifestEndDate?.getTime() ? generateHlsManifestEndDate.getTime() - generateHlsManifestStartDate.getTime() : undefined,
            progressiveMp4Muxing: progressiveMp4MuxingStartDate?.getTime() && progressiveMp4MuxingEndDate?.getTime() ? progressiveMp4MuxingEndDate.getTime() - progressiveMp4MuxingStartDate.getTime() : undefined,
            totalDuration: encodingProcessFinishedDate?.getTime() && encodingTask.createdAt?.getTime() ? encodingProcessFinishedDate.getTime() - encodingTask.createdAt.getTime() : undefined,
        }
    };
    return taskSummary;
}

async function getEncodings(bitmovinApi: BitmovinApi, from: Date, to: Date): Promise<Encoding[]> {
    let fetchedCount = 0;
    const MAX_REQUESTS_PER_MINUTE = 58; // bitmovin limit is 60
    const rateLimiter = new RateLimiter(MAX_REQUESTS_PER_MINUTE);
    const fetchItems = async (offset = 0): Promise<{ items: Encoding[], totalCount: number }> => {
        const paginationResult = await rateLimiter.run<PaginationResponse<Encoding>>(
            () => bitmovinApi.encoding.encodings.list({
                limit: 100,
                offset,
                createdAtNewerThan: from,
                createdAtOlderThan: to,
                includeTotalCount: true,
            }))
        fetchedCount += paginationResult.items.length;
        info(`${fetchedCount}/${paginationResult.totalCount} encodings fetched`);
        return { items: paginationResult.items, totalCount: paginationResult.totalCount };
    }
    const allItems = [];
    const { items, totalCount } = await fetchItems();
    allItems.push(...(items || []));
    while (allItems.length < totalCount) {
        const result = await fetchItems(allItems.length);
        allItems.push(...result.items);
    }
    return allItems;
}

async function getTaskOverview(from: Date, to: Date): Promise<TasksOverview> {
    const bitmovinApi = new BitmovinApi({
        apiKey: config.getString("bitmovin.apiKey").get(),
    });
    const encodings = await getEncodings(bitmovinApi, from, to);
    info(`${encodings.length} encodings in total`);
    const taskDurationsMulti: TaskDurationsMulti = {};

    info(`Found ${encodings.length} encodings`);
    let i = 1;

    let longestRunningEncoding = {
        encodingId: "",
        duration: 0,
    };

    for (const encoding of encodings) {
        if (!encoding.id) {
            error("No encoding id found", encoding);
            continue;
        }

        const MAX_REQUESTS_PER_MINUTE = 5995; // bitmovin limit is 6000
        const rateLimiter = new RateLimiter(MAX_REQUESTS_PER_MINUTE);
        const encodingTask = await rateLimiter.run<Task>(() => bitmovinApi.encoding.encodings.status(encoding.id));
        info(`${i++}/${encodings.length} encoding tasks fetched`)
        const taskSummary = parseTask(encoding.id, encodingTask);
        if (taskSummary.taskDurations.totalDuration && taskSummary.taskDurations.totalDuration > longestRunningEncoding.duration) {
            longestRunningEncoding = {
                encodingId: encoding.id,
                duration: taskSummary.taskDurations.totalDuration,
            };
        }

        for (const [state, duration] of Object.entries(taskSummary.taskDurations)) {
            if (duration !== undefined) {
                if (!taskDurationsMulti[state]) {
                    taskDurationsMulti[state] = [];
                }
                taskDurationsMulti[state].push(duration);
            }
        }

    }
    return {
        taskDurationsMulti,
        longestRunningEncoding,
    };
}

function aggregateTaskDurations(taskDurationsMulti: TaskDurationsMulti): Report {
    const report: Report = {
        median: {},
        average: {},
        max: {},
        min: {},
    };

    for (const [state, durations] of Object.entries(taskDurationsMulti)) {
        if (durations.length === 0) {
            continue;
        }
        const sortedDurations = durations.sort((a, b) => a - b);
        const sum = durations.reduce((acc, duration) => acc + duration, 0);
        const average = sum / durations.length;
        const median = sortedDurations[Math.floor(durations.length / 2)];
        const min = Math.min(...durations);
        const max = Math.max(...durations);
        report.median[state] = median;
        report.average[state] = average;
        report.min[state] = min;
        report.max[state] = max;
    }
    return report;
}

async function sendMail(
    report: Report<string>,
    info: Record<string, string>,
    from: Date,
    to: Date,
): Promise<void> {
    const mailBody = `
        <div>
        <h3>Bitmovin encoding times of last ${DAY_COUNT} days</h3>
        <label>${`From ${fmtDateIso8601TimeLocalizedTZ(from)} to ${fmtDateIso8601TimeLocalizedTZ(to)}`}</label>
            <p>
                <table>
                    <tr>
                        <th>state</th>
                        <th>median</th>
                        <th>avg</th>
                        <th>min</th>
                        <th>max</th>
                    </tr>
                    ${Object.keys(report.median).map((state) => `
                        <tr>
                            <td>${state}</td>
                            <td>${report.median[state]}</td>
                            <td>${report.average[state]}</td>
                            <td>${report.min[state]}</td>
                            <td>${report.max[state]}</td>
                        </tr>
                    `).join("")}
                </table>
            </p>
            <p>
                <b>Info</b>
                <ul>
                    ${Object.entries(info).map(([key, value]) => `<li>${key}: ${value}</li>`).join("")}
                </ul>
            </b>
        </div>
    `;
    const mailgunConfig = await MailgunConfig.fromConfig(config);
    const mailer = new MailgunMailer(mailgunConfig.apiKey, mailgunConfig.domain);
    const mailMessage = {
        to: "dev@manual.to",
        from: "Manual.to <bitmovin-digest@mail.manual.to>",
        subject: "Bitmovin Transcoding Times",
        text: stripHTML(mailBody),
        html: mailBody,
    };
    await mailer.sendMessage(mailMessage);
}

const doIt = async () => {
    const from = startOfDay(subDays(new Date(), DAY_COUNT));
    const to = endOfDay(subDays(new Date(), 1));
    const tasksOverview = await getTaskOverview(from, to);
    const report = aggregateTaskDurations(tasksOverview.taskDurationsMulti);
    const reportSemantic = {};
    for (const [metric, taskDurations] of Object.entries(report)) {
        reportSemantic[metric] = {};
        for (const [state, duration] of Object.entries(taskDurations)) {
            reportSemantic[metric][state] = format(duration);
        }
    }
    await sendMail(
        reportSemantic as Report<string>,
        { ["longest running task"]: `${tasksOverview.longestRunningEncoding.encodingId} (${format(tasksOverview.longestRunningEncoding.duration)}) total` },
        from,
        to
    );
    info(`Report ${JSON.stringify(reportSemantic, null, 2)}`);
}

doIt().then(() => {
    ok("Done!")
    process.exit(0)
})
    .catch(err => {
        console.error(err)
        process.exit(1)
    });