import {
    MailMessageTemplate,
    MailgunConfig,
    MailgunMailer
} from  "@binders/binders-service-common/lib/mail/mailgun";
import { Config } from "@binders/client/lib/config/config";
import {
    TEST_EMAIL_ADDRESS_ENDINGS
} from  "@binders/binders-service-common/lib/testutils/fixtures/userfactory";


export class NotificationMailer {

    constructor(
        private readonly mailer: MailgunMailer
    ) {}

    async sendBatchMessages(
        template: MailMessageTemplate,
        to: string[],
        // The variables object is required and should at least contain every email address from the to array as a key and an empty object as a value
        // Without this, mailgun will not send separate emails, and will instead send 1 email with all recipients in the to field
        variables: {[to: string]: {[variable: string]: string | number}}
    ): Promise<void> {
        const mailgunTemplate = await this.replaceTemplateTagsWithMailgunTags(template);

        // We return after templating logic, to catch errors in that logic when tests are ran
        if (to.some(email => email.endsWith(TEST_EMAIL_ADDRESS_ENDINGS))) {
            return;
        }
        await this.mailer.sendBatchMessages(mailgunTemplate, to, variables);
    }

    // Mailgun uses "%" as template tags, we use "[[" and "]]"
    private async replaceTemplateTagsWithMailgunTags(template: MailMessageTemplate) {
        const replaceTemplateTags = (text = "") => {
            return text.replace(/\[\[/g, "%recipient.").replace(/\]\]/g, "%");
        };
        const mailgunTemplate = {
            ...template,
            text: replaceTemplateTags(template.text),
            subject: replaceTemplateTags(template.subject),
            html: replaceTemplateTags(template.html)
        }
        return mailgunTemplate;
    }

    static async fromConfig(config: Config): Promise<NotificationMailer> {
        const mailgunConfig = await MailgunConfig.fromConfig(config);
        const mailer = new MailgunMailer(mailgunConfig.apiKey, mailgunConfig.domain);

        return new NotificationMailer(mailer);
    }

}
