import { Content, Header, Main, Para, Stat, Table, body, entity, p, style, td, tr } from "@binders/binders-service-common/lib/mail/txtHtmlKit";
import { MailMessage, MailgunConfig, MailgunMailer } from "@binders/binders-service-common/lib/mail/mailgun";
import { maybeDate, maybeDifferenceInDays, maybeFormat, maybeFormatDistance, maybeParseISO } from "@binders/client/lib/date/maybeDateFns";
import { Account } from "./utils/accountTxtHtmlKit";
import { BackendAccountServiceClient } from "@binders/binders-service-common/lib/apiclient/backendclient";
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import { Command } from "commander";
import { Maybe } from "@binders/client/lib/monad";
import { log } from "@binders/binders-service-common/lib/util/process"

const config = BindersConfig.get();
const SCRIPTNAME = "runExpiringAccountsReport";

const program = new Command();

program
    .name(SCRIPTNAME)
    .description("Find soon-to-expire accounts and send an email report if any found.")
    .version("0.1.1")
    .option("-d, --dry", "if set, do not send the email")
    .option("-f, --force", "send an email report even when no accounts expire soon")
    .option("-p, --print", "print raw HTML")
    .option("-r, --recipient [email]", "recipient email address(es) (comma separated)")
    .option("-s, --sender [email]", "sender email address")
    .option("-t, --threshold [number]", "how many days until expiry", 30)
    .option("-q, --quiet", "do not print debugging info");

program.parse(process.argv);
const options = program.opts();

if (!options.quiet) {
    log(JSON.stringify(options, null, 2));
}

type WithExpirations = { editorExpiresIn: number, readerExpiresIn: number };

const accountIsAboutToExpire = <T extends WithExpirations>(days: number) => (acc: T) => {
    return acc.editorExpiresIn >= 0 && acc.editorExpiresIn < days;
}

const accountIsExpired = <T extends WithExpirations>(acc: T) => acc.editorExpiresIn < 0;
const accountIsNotExpired = <T extends WithExpirations>(acc: T) => acc.editorExpiresIn >= 0;

const byExpiration = <T extends WithExpirations>(left: T, right: T) => {
    return left.editorExpiresIn - right.editorExpiresIn;
}

function formatSize(bytes: number) {
    if (bytes < 1024) {
        return `${bytes} bytes`;
    }
    return `${(bytes / 1024).toPrecision(2)} kB`
}

function line(char = "-", length = 100) {
    return "".padEnd(length, char)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function printAccount(account: any) {
    return Object.entries({
        ...account,
        members: account.members.length,
        storageDetails: undefined,
    }).map(([key, value]) => `${key.padEnd(25, " ")}: ${value}`).join("\n");
}

function printAccounts(accounts: unknown[]) {
    return accounts.map(printAccount)
        .reduce((res, item) => [...res, item, line("-", 50)], [])
        .join("\n");
}

async function main() {
    const accountServiceClient = await BackendAccountServiceClient.fromConfig(config, SCRIPTNAME);
    const accountsRaw = await accountServiceClient.listAccounts();

    const now = Maybe.just(new Date());
    const accounts = accountsRaw
        .filter(a => !!a)
        .map(acc => ({
            ...acc,
            created: maybeDate(acc.created),
            expirationDate: maybeParseISO(acc.expirationDate),
            readerExpirationDate: maybeParseISO(acc.readerExpirationDate),
        }))
        .map(acc => ({
            ...acc,
            age: maybeDifferenceInDays(now, acc.created).getOrElse(Infinity),
            editorExpiresIn: maybeDifferenceInDays(acc.expirationDate, now).getOrElse(Infinity),
            readerExpiresIn: maybeDifferenceInDays(acc.readerExpirationDate, now).getOrElse(Infinity),
            created: maybeFormat(acc.created, "do MMMM yyyy").getOrElse("always"),
            expirationDate: maybeFormat(acc.expirationDate, "do MMMM yyyy").getOrElse("never"),
            readerExpirationDate: maybeFormat(acc.readerExpirationDate, "do MMMM yyyy").getOrElse("never"),
            editorExpiresAt: maybeFormatDistance(acc.expirationDate, now, { addSuffix: true }).getOrElse("never"),
            readerExpiresAt: maybeFormatDistance(acc.readerExpirationDate, now, { addSuffix: true }).getOrElse("never"),
            createdAt: maybeFormatDistance(acc.created, now, { addSuffix: true }).getOrElse("always"),
        }));

    if (accounts.length === 0) {
        throw new Error("No accounts found");
    }


    const total = accounts.length;
    const expired = accounts.filter(accountIsExpired).length;
    const active = total - expired;

    const expireSoon = accounts.filter(accountIsAboutToExpire(options.threshold)).sort(byExpiration);
    const expireSoonIds = new Set(expireSoon.map(a => a.id));
    const expireInQuarter = accounts.filter(accountIsAboutToExpire(3 * 30)).filter(a => !expireSoonIds.has(a.id));
    const expireInQuarterIds = new Set([...expireSoonIds.values(), ...expireInQuarter.map(a => a.id)]);
    const expireInHalf = accounts.filter(accountIsAboutToExpire(6 * 30)).filter(a => !expireInQuarterIds.has(a.id));
    const expireInHalfIds = new Set([...expireInQuarterIds.values(), ...expireInHalf.map(a => a.id)]);
    const expireInYear = accounts.filter(accountIsAboutToExpire(365)).filter(a => !expireInHalfIds.has(a.id));

    const sortedAccounts = accounts.sort(byExpiration);
    const firstAccountsToExpire = sortedAccounts.filter(accountIsNotExpired).slice(0, 5);

    const title = expireSoon.length === 0 ?
        "No acccounts are expiring soon" :
        `${entity("account", expireSoon.length)} will expire in the next 30 days`;

    const firstToExpireIn = expireSoon.length > 0 ? expireSoon[0].editorExpiresIn : Infinity;
    const firstToExpireAt = expireSoon.length > 0 ? `in ${entity("day", firstToExpireIn)}` : "never";

    let status;
    if (firstToExpireIn > 7) {
        status = "Announcement";
    } else if (firstToExpireIn > 4) {
        status = "Warning";
    } else if (firstToExpireIn > 2) {
        status = "IMPORTANT";
    } else if (firstToExpireIn >= 0) {
        status = "URGENT";
    } else {
        status = "Info";
    }

    const subjectMsg = expireSoon.length > 0 ?
        `Some accounts will expire ${firstToExpireAt}` :
        "No accounts expiring soon";

    const subject = `${status}: ${subjectMsg}`;

    const stats = [
        { name: `${entity("account", total)} in total`, value: total },
        { name: `${entity("account", active)} active`, value: active },
        { name: `${entity("account", expireSoon.length)} expiring in ${options.threshold} days`, value: expireSoon.length },
        { name: `${entity("account", expireInQuarter.length)} expiring in 3 months`, value: expireInQuarter.length },
        { name: `${entity("account", expireInHalf.length)} expiring in 6 months`, value: expireInHalf.length },
        { name: `${entity("account", expireInYear.length)} expiring in a year`, value: expireInYear.length },
    ];

    const text = [
        subject,
        "",
        title,
        "",
        ...stats.map(({ name, value }) => `${name.padEnd(35, " ")}: ${value}`),
        "",
        `Following ${entity("account", expireSoon.length)} will expire in the next ${options.threshold} days.`,
        "",
        printAccounts(expireSoon),
        "",
        `These are the first ${entity("account", firstAccountsToExpire.length)} that will expire next.`,
        "",
        printAccounts(firstAccountsToExpire),
        "",
        `Following ${entity("account", expireInQuarter.length)} will expire in the next 3 months.`,
        "",
        printAccounts(expireInQuarter),
        "",
        `Following ${entity("account", expireInHalf.length)} will expire in the next 6 months.`,
        "",
        printAccounts(expireInHalf),
    ].join("\n");

    const markup = body(

        Main([
            Header({ domain: "admin.manual.to", title: "Accounts report" }),
            Content([
                p(title, style("center", "paddingMedium", "fontXLarge")),

                Table([
                    tr([
                        Stat(stats[0]),
                        Stat(stats[1]),
                        Stat(stats[2]),
                    ]),
                    tr([
                        Stat(stats[3]),
                        Stat(stats[4]),
                        Stat(stats[5]),
                    ]),
                ], style("fullWidth", "gapMedium")),

                ...(
                    expireSoon.length > 0 ?
                        [
                            Para([{
                                content: `Following ${entity("account", expireSoon.length)} will expire in the next ${options.threshold} days.`,
                            }], style("paddingMedium")),
                            Table(
                                expireSoon.map(ac => tr(td(Account(ac), style("box", "paddingMedium")))),
                                style("fullWidth", "gapMedium"),
                            )
                        ] :
                        []
                ),

                ...(
                    expireInQuarter.length > 0 ?
                        [
                            Para([{
                                content: `Following ${entity("account", expireInQuarter.length)} will expire in the next 3 months.`,
                            }], style("paddingMedium")),
                            Table(
                                expireInQuarter.map(ac => tr(td(Account(ac), style("box", "paddingMedium")))),
                                style("fullWidth", "gapMedium"),
                            ),
                        ] :
                        []
                ),

                ...(
                    expireInHalf.length > 0 ?
                        [
                            Para([{
                                content: `Following ${entity("account", expireInHalf.length)} will expire in the next 6 months.`,
                            }], style("paddingMedium")),
                            Table(
                                expireInHalf.map(ac => tr(td(Account(ac), style("box", "paddingMedium")))),
                                style("fullWidth", "gapMedium"),
                            ),
                        ] :
                        []
                ),

                ...(
                    expireInQuarter.length + expireInHalf.length === 0 ?
                        [
                            Para([{
                                content: `These are the first ${entity("account", firstAccountsToExpire.length)} that will expire next.`,
                            }], style("paddingMedium")),
                            Table(
                                firstAccountsToExpire.map(ac => tr(td(Account(ac), style("box", "paddingMedium")))),
                                style("fullWidth", "gapMedium"),
                            )
                        ] :
                        []
                ),
            ], style("paddingLarge")),
        ]),

        { style: { backgroundColor: "#f3f3f1" } }

    );

    const html = `
        <html lang="en">
            <head>
            <meta charset="UTF-8">
            <meta http-equiv="Content-Type" content="text/html charset=UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>manual.to</title>
        </head>
        ${markup}
        </html>
    `;

    let recipients = [];
    if (options.recipient != null) {
        recipients = options.recipient.split(",").map(r => r.trim());
    }
    const msg = {
        from: options.sender,
        to: recipients,
        subject,
        text,
        html,
    } as MailMessage;

    log("Text version");
    log(text);
    log(line("=", 80));

    if (!options.quiet) {
        log("Full message")
        log(JSON.stringify(msg, null, 2));
        log(line("=", 80));
    }

    if (options.print) {
        log("Raw HTML");
        log(line("=", 80));
        log("");
        log(html)
        log("");
        log(line("=", 80));
    }

    if (!options.dryRun && (expireSoon.length > 0 || options.force)) {
        if (msg.from && msg.to) {
            const mailgunConfig = await MailgunConfig.fromConfig(config);
            const mailgunMailer = new MailgunMailer(mailgunConfig.apiKey, mailgunConfig.domain);
            log(`sending email from ${msg.from} to ${JSON.stringify(msg.to)}`)
            log(`text size: ${formatSize(msg.text.length)}`);
            log(`html size: ${formatSize(msg.html.length)}`);
            try {
                await mailgunMailer.sendMessage(msg);
            } catch (e) {
                log("failed to send email(s)");
                log(e);
            }
            log("done");
        } else {
            log("sender or recipient not provided, not sending email");
        }
    } else {
        log("skipping send");
    }

    return expireSoon;
}

main().then(() => {
    log("ok");
    process.exit(0);
}).catch(err => {
    log(err);
    // eslint-disable-next-line no-console
    console.log(err);
    process.exit(1);
})
