import { Config, ConfigError } from "@binders/client/lib/config/config";
import type { Interfaces, MailgunMessageData } from "mailgun.js/definitions";
import { isAfter, isEqual } from "date-fns";
import { BouncedEmail } from "@binders/client/lib/clients/userservice/v1/contract";
import Mailgun from "mailgun.js";
import { TEST_EMAIL_ADDRESS_ENDINGS } from "../testutils/fixtures/userfactory";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const formData = require("form-data");
// eslint-disable-next-line @typescript-eslint/no-var-requires
const fsPromises = require("fs").promises;

const mailgun = new Mailgun(formData);

export interface MailMetaData {
    from: string;
    attachments?: Array<Attachment>;
    inlineAttachments?: Array<Attachment>;
    // rfc2822 encoded date string ("iii, dd MMM yyyy HH:mm:ss xx")
    deliveryTime?: string;
    replyTo?: string;
}

// Can contain variables in the format %recipient.variableName%
// variableName will be replaced with the variable in the variables object passed to sendBatchMessages
export interface MailMessageTemplate extends MailMetaData {
    subject: string;
    text: string;
    html: string;
}

export interface MailMessage extends MailMetaData {
    to: string | string[];
    subject: string;
    text: string;
    html: string;
}

export interface Attachment {
    filename: string;
    path?: string;
    data?: Buffer;
    cid: string;
}

export class MailgunMailer {

    private mailgun: Interfaces.IMailgunClient;

    constructor(apiKey: string, private readonly domain: string) {
        const config = {
            username: "api",
            key: apiKey
        };
        this.mailgun = mailgun.client(config);
    }

    async getBouncedEmails(lastDate?: Date): Promise<Array<BouncedEmail>> {
        const result = await this.mailgun.suppressions.list(
            this.domain,
            "bounces"
        );
        const items = result.items as Interfaces.IBounce[];
        return lastDate ?
            items.filter(({ created_at }) => isEqual(created_at, lastDate) || isAfter(created_at, lastDate)) :
            items;
    }

    async checkIfEmailBounced(address: string): Promise<BouncedEmail> {
        try {
            return await this.mailgun.suppressions.get(
                this.domain,
                "bounces",
                address
            ) as Interfaces.IBounce;
        } catch (exc) {
            if (exc?.status === 404) {
                return undefined;
            }
            throw exc;
        }
    }

    private async toMailgunAttachments(attachments: Array<Attachment> | undefined) {
        if (attachments === undefined) {
            return undefined;
        }
        return Promise.all(
            attachments.map(
                async a => ({
                    filename: a.filename,
                    data: a.data || await fsPromises.readFile(a.path),
                })
            )
        );
    }

    private async toMailgunMessage(message: MailMessage | MailMessageTemplate): Promise<MailgunMessageData> {
        const mgMsg = {
            from: message.from,
            subject: message.subject,
            text: message.text,
            html: message.html
        }
        if (message.attachments) {
            mgMsg["attachments"] = await this.toMailgunAttachments(message.attachments);
        }
        if (message.inlineAttachments) {
            mgMsg["inline"] = await this.toMailgunAttachments(message.inlineAttachments);
        }
        if (message.deliveryTime) {
            mgMsg["o:deliverytime"] = message.deliveryTime;
        }
        if (message.replyTo) {
            mgMsg["h:Reply-To"] = message.replyTo;
        }
        return mgMsg;
    }

    private isTestEmailTarget(to: string | string[]): boolean {
        if (to == null) return false;
        if (Array.isArray(to)) {
            return to.some(email => email.endsWith(TEST_EMAIL_ADDRESS_ENDINGS));
        }
        return to.endsWith(TEST_EMAIL_ADDRESS_ENDINGS)
    }

    async sendMessage(message: MailMessage): Promise<void> {
        if (this.isTestEmailTarget(message.to)) return;

        const domain = this.domain;
        const msg = await this.toMailgunMessage(message);

        const recipients = Array.isArray(message.to) ? message.to : [message.to];
        for (const recipient of recipients) {
            const msgWithTarget = { ...msg, "to": recipient };
            await this.mailgun.messages.create(
                domain,
                msgWithTarget
            );
        }
    }

    async sendBatchMessages(
        template: MailMessageTemplate,
        to: string[],
        // The variables object is required and should at least contain every email address from the to array as a key and an empty object as a value
        // Without this, mailgun will not send separate emails, and will instead send 1 email with all recipients in the to field
        variables: {[to: string]: {[variable: string]: string | number}}
    ): Promise<void> {
        const mailgunMessage = await this.toMailgunMessage(template);
        mailgunMessage["recipient-variables"] = JSON.stringify(variables);
        mailgunMessage["to"] = to;
        await this.mailgun.messages.create(
            this.domain,
            mailgunMessage
        );
    }

    static async fromConfig(config: Config): Promise<MailgunMailer> {
        const mailgunConfig = await MailgunConfig.fromConfig(config);
        return new MailgunMailer(mailgunConfig.apiKey, mailgunConfig.domain);
    }
}

export class MailgunConfig {
    constructor(readonly apiKey: string, readonly domain: string) { }

    static async fromConfig(config: Config): Promise<MailgunConfig> {
        const mailgunSettingsOption = config.getObject<{ apiKey?: string, domain?: string }>("mailgun");
        if (mailgunSettingsOption.isNothing()) {
            throw new ConfigError("Missing config settings for mailgun.");
        }
        const mailgunSettings = mailgunSettingsOption.get();
        const errors: string[] = [];
        if (mailgunSettings.apiKey === undefined) {
            errors.push("Missing config key for mailgun API key");
        }
        if (mailgunSettings.domain === undefined) {
            errors.push("Missing config key for mailgun domain");
        }
        if (errors.length > 0) {
            throw new ConfigError(errors.join("\n"));
        }
        return new MailgunConfig(mailgunSettings.apiKey, mailgunSettings.domain);
    }
}
