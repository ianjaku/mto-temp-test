/* eslint-disable no-console */
import BitmovinApi, { DailyStatistics } from "@bitmovin/api-sdk";
import { MailgunConfig, MailgunMailer } from "@binders/binders-service-common/lib/mail/mailgun";
import { endOfDay, startOfDay, subDays } from "date-fns";
import { fmtDateIso8601TimeLocalizedTZ, fmtDateWritten } from "@binders/client/lib/util/date";
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import { info } from "@binders/client/lib/util/cli";
import { stripHTML } from "@binders/client/lib/util/html";

const config = BindersConfig.get();

const DAY_COUNT = 7;

/*
    Script used as a cronjob to send daily Bitmovin statistics
*/

async function getBitmovinStats(
    from: Date,
    to: Date,
): Promise<DailyStatistics[]> {
    const bitmovinApi = new BitmovinApi({
        apiKey: config.getString("bitmovin.apiKey").get(),
    });
    const result = await bitmovinApi.encoding.statistics.daily.listByDateRange(from, to);
    if (!result.totalCount) {
        info("No statistics found");
        process.exit(0);
    }
    return result.items;
}

function formatMinutes(num: number): string {
    const rounded = Math.round(num * 100) / 100;
    let readableNotation = "";
    if (rounded > 60) {
        const hours = Math.floor(num / 60);
        const minutes = Math.floor(num % 60);
        const seconds = Math.floor((num % 1) * 60);
        readableNotation = `${hours > 0 ? `${hours}h ` : ""}${minutes > 0 ? `${minutes}m ` : ""}${seconds > 0 ? `${seconds}s` : ""}`;
    }
    return `${rounded} minutes${readableNotation ? ` (${readableNotation})` : ""}`;
}

function formatBytes(num: number): string {
    const units = ["B", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"];
    let i = 0;
    while (num >= 1024) {
        num /= 1024;
        i++;
    }
    return `${Math.round(num * 100) / 100} ${units[i]}`;
}

async function sendMail(
    dailyStatistics: DailyStatistics[],
    from: Date,
    to: Date,
): Promise<void> {

    const totalBillableMinutes = dailyStatistics.reduce((acc, { billableMinutes }) => acc + billableMinutes, 0);

    const mailBody = `
        <div>
        <h3>Bitmovin Daily Statistics of the last ${DAY_COUNT} days</h3>
        <label>${`From ${fmtDateIso8601TimeLocalizedTZ(from)} to ${fmtDateIso8601TimeLocalizedTZ(to)}`}</label>
            <p>Total billable minutes: ${formatMinutes(totalBillableMinutes)}</p>
            ${dailyStatistics.reverse().map(getDayOverview).join("")}
        </div>
    `;
    const mailgunConfig = await MailgunConfig.fromConfig(config);
    const mailer = new MailgunMailer(mailgunConfig.apiKey, mailgunConfig.domain);
    const mailMessage = {
        to: "dev@manual.to",
        from: "Manual.to <bitmovin-digest@mail.manual.to>",
        subject: "Bitmovin Daily Statistics",
        text: stripHTML(mailBody),
        html: mailBody,
    };
    await mailer.sendMessage(mailMessage);
}

function getDayOverview(dailyStatistics: DailyStatistics): string {
    const { billableMinutes, bytesEncoded, billableEncodingMinutes, billableTransmuxingMinutes, billableFeatureMinutes } = dailyStatistics;
    return `
        <div>
        <h5>${fmtDateWritten(dailyStatistics.date)}</h5>
            <p>Billable minutes: ${formatMinutes(billableMinutes)}</p>
            <p>Bytes encoded: ${formatBytes(bytesEncoded)}</p>
            <p>
                <h6>breakdown</h6>
                <ul>
                    ${billableEncodingMinutes.map(({ encodingMode, codec, billableMinutes }) =>
        `<li>Encoding mode ${encodingMode}/codec ${codec}: <ul>
            ${Object.entries(billableMinutes).filter(([, minutes]) => !!minutes).map(([type, minutes]) => `<li>${type}: ${formatMinutes(minutes)}</li>`).join("")} </ul></li > `).join("")}
                ${billableTransmuxingMinutes ? `<li>Billable transmuxing minutes: ${formatMinutes(billableTransmuxingMinutes)}</li>` : ""}
                ${billableFeatureMinutes.length ? `<li>Billable feature minutes:<ul>${billableFeatureMinutes.map(({ featureType, billableMinutes }) => `<li>${featureType}: ${formatMinutes(billableMinutes)} minutes</li>`).join("")}</ul></li>` : ""}
                </ul>
            </p>
        </div>
        <hr/>
    `;
}

const doIt = async () => {
    const from = startOfDay(subDays(new Date(), DAY_COUNT));
    const to = endOfDay(subDays(new Date(), 1));
    const dailyStatistics = await getBitmovinStats(from, to);
    await sendMail(dailyStatistics, from, to);
}

doIt().then(() => {
    console.log("Finished!");
    process.exit(0)
})
    .catch(err => {
        console.error(err)
        process.exit(1)
    });
