import { MailMessage, MailgunMailer } from "@binders/binders-service-common/lib/mail/mailgun";
import { addDays, isAfter } from "date-fns";
import {
    BackendAccountServiceClient
} from "@binders/binders-service-common/lib/apiclient/backendclient";
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import { LoggerBuilder } from "@binders/binders-service-common/lib/util/logging";
import {
    MongoCertificateRepositoryFactory
} from "../credentialservice/repositories/ADCertificates";
import { X509Certificate } from "crypto";
import { main } from "@binders/binders-service-common/lib/util/process";

const SCRIPT_NAME = "checkExpiredSAMLCertificates";

interface ExpirationInfo {
    accountId: string;
    accountName: string;
    expiryDate: Date;
}

function expiredsMessageTxt(expireds: ExpirationInfo[], aboutToExpire: ExpirationInfo[]): string {
    const format = (info: ExpirationInfo, verb: string) => (
        `* Account: ${info.accountName} (id: ${info.accountId}) ${verb} on ${info.expiryDate.toDateString()}`
    );
    const expiredsMessage = expireds.length === 0 ?
        "" :
        "\n\nThe following SAML SSO certificates have expired:\n" + expireds.map(e => format(e, "expired")).join("\n");
    const aboutToExpireMessage = aboutToExpire.length === 0 ?
        "" :
        "\n\nThe following SAML SSO certificates are about to expire:\n" + aboutToExpire.map(e => format(e, "expires")).join("\n");
    const head = "Please reach out to the following customers to renew their SAML SSO certificates:\n";
    return head + expiredsMessage + aboutToExpireMessage;

}

function expiredsMessageHtml(expireds: ExpirationInfo[], aboutToExpire: ExpirationInfo[]): string {
    const format = (info: ExpirationInfo, verb: string) => (
        `<li>Account: ${info.accountName} (id: ${info.accountId}) ${verb} on ${info.expiryDate.toDateString()}</li>`
    );
    const buildExpiredMessage = () => {
        return [
            "<p>The following SAML SSO certificates have expired:</p>",
            "<ul>",
            ...expireds.map(e => format(e, "expired")),
            "</ul>"
        ].join("");
    }
    const buildAboutToExpireMessage = () => {
        return [
            "<p>The following SAML SSO certificates are about to expire:</p>",
            "<ul>",
            ...aboutToExpire.map(e => format(e, "expires")),
            "</ul>"
        ].join("");
    }
    const expiredMessage = expireds.length === 0 ? "" : buildExpiredMessage();
    const aboutToExpireMessage = aboutToExpire.length === 0 ? "" : buildAboutToExpireMessage();
    const head = "<p>Please reach out to the following customers to renew their SAML SSO certificates:</p>";
    return head + expiredMessage + aboutToExpireMessage;
}


function buildExpiredsMessage(expireds: ExpirationInfo[], aboutToExpire: ExpirationInfo[]): MailMessage {
    return {
        from: "Manual.to Backend <interal@mail.manual.to>",
        to: "support@manual.to",
        subject: "Expired SAML SSO certificates",
        text: expiredsMessageTxt(expireds, aboutToExpire),
        html: expiredsMessageHtml(expireds, aboutToExpire)
    }
}

main(async () => {
    const bindersConfig = BindersConfig.get();
    const logger = LoggerBuilder.fromConfig(bindersConfig, SCRIPT_NAME);
    const repositoryFactory = MongoCertificateRepositoryFactory.fromConfig(bindersConfig, logger);
    const accountServiceClient = await BackendAccountServiceClient.fromConfig(bindersConfig, SCRIPT_NAME);
    const repository = (await repositoryFactory).build(logger);
    const now = new Date();
    const softExpireDate = addDays(now, 30);
    const certificates = await repository.getAllCertificates();
    const expireds: ExpirationInfo[] = [];
    const aboutToExpire: ExpirationInfo[] = [];

    for (const certificate of certificates) {
        const { data: certData, accountId } = certificate;
        const { validTo } = new X509Certificate(certData);
        const account = await accountServiceClient.getAccount(accountId);
        const accountName = account.name;
        const accountExpiryDate = new Date(account.expirationDate);
        if (isAfter(now, accountExpiryDate)) {
            logger.info(`Ignoring expired account ${accountName}`, SCRIPT_NAME);
            continue;
        }
        const expiryDate = new Date(validTo);
        if (isAfter(now, expiryDate)) {
            expireds.push({ accountId, accountName, expiryDate });
        } else {
            if (isAfter(softExpireDate, expiryDate)) {
                aboutToExpire.push({ accountId, accountName, expiryDate });
            }
        }
    }
    if (expireds.length + aboutToExpire.length == 0) {
        process.exit(0);
    }
    const mailer = await MailgunMailer.fromConfig(bindersConfig);
    const expiredsMessage = buildExpiredsMessage(expireds, aboutToExpire);
    await mailer.sendMessage(expiredsMessage);
});