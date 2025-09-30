import { DefaultMailFormatter, UserMailFormatter } from "./formatter";
import {
    MailMessage,
    MailgunConfig,
    MailgunMailer
} from "@binders/binders-service-common/lib/mail/mailgun";
import { BouncedEmail } from "@binders/client/lib/clients/userservice/v1/contract";
import { Config } from "@binders/client/lib/config/config";
import { ReaderBranding } from "@binders/client/lib/clients/routingservice/v1/contract";
export interface Mailer {
    getBounced(lastDate?: Date): Promise<Array<BouncedEmail>>;
    getBouncedInfo(address: string): Promise<BouncedEmail>;
    sendInvitationEmail(login: string, invitationLink: string, accountName: string, domain: string, readerBranding?: ReaderBranding, accountId?: string, language?: string, deliveryTime?: string): Promise<void>;
    sendLoginChangeEmail(login: string, oldLogin: string, domain: string, readerBranding?: ReaderBranding, firstName?: string): Promise<void>;
    sendLoginRemovedEmail(oldLogin: string, domain: string, readerBranding?: ReaderBranding, firstName?: string): Promise<void>;
    sendResetPasswordEmail(login: string, invitationLink: string, domain: string, language?: string, readerBranding?: ReaderBranding, firstName?: string): Promise<void>;
}


abstract class AbstractMailer implements Mailer {

    protected readonly formatter: UserMailFormatter;

    abstract sendMessage(message: MailMessage): Promise<void>;
    abstract getBounced(lastDate?: Date): Promise<BouncedEmail[]>;
    abstract getBouncedInfo(address: string): Promise<BouncedEmail>;

    async buildAndSendMail(builder: () => Promise<MailMessage>): Promise<void> {
        const message = await builder();
        return this.sendMessage(message);
    }

    async sendInvitationEmail(login: string, invitationLink: string, accountName: string, domain: string, readerBranding?: ReaderBranding, accountId?: string, language?: string, deliveryTime?: string): Promise<void> {
        return this.buildAndSendMail(
            () => this.formatter.formatUserInviteMail(
                login,
                invitationLink,
                accountName,
                domain,
                readerBranding,
                accountId,
                language,
                deliveryTime
            )
        );
    }

    async sendLoginChangeEmail(login: string, oldLogin: string, domain: string, readerBranding?: ReaderBranding, firstName?: string): Promise<void> {
        return this.buildAndSendMail(
            () => this.formatter.formatUserLoginChangeMail(login, oldLogin, domain, readerBranding, firstName)
        );
    }

    async sendLoginRemovedEmail(oldLogin: string, domain: string, readerBranding?: ReaderBranding, firstName?: string): Promise<void> {
        return this.buildAndSendMail(
            () => this.formatter.formatUserLoginRemovedMail(oldLogin, domain, readerBranding, firstName)
        );
    }

    async sendResetPasswordEmail(login: string, resetPasswordLink: string, domain: string, language?: string, readerBranding?: ReaderBranding, firstName?: string): Promise<void> {
        return this.buildAndSendMail( () =>
            this.formatter.formatUserResetPasswordMail(
                login, resetPasswordLink, domain,
                language, readerBranding, firstName
            )
        );
    }


}

export class UserMailgunMailer extends AbstractMailer {

    private mailer: MailgunMailer;
    constructor(
        config: MailgunConfig,
        protected readonly formatter: UserMailFormatter
    ) {
        super();
        this.mailer = new MailgunMailer(config.apiKey, config.domain);
    }

    sendMessage(message: MailMessage): Promise<void> {
        return this.mailer.sendMessage(message);
    }

    getBounced(lastDate?: Date): Promise<Array<BouncedEmail>> {
        return this.mailer.getBouncedEmails(lastDate ? new Date(lastDate) : undefined);
    }

    getBouncedInfo(address: string): Promise<BouncedEmail> {
        return this.mailer.checkIfEmailBounced(address);
    }

    static async fromConfig(config: Config): Promise<UserMailgunMailer> {
        const mailgunSettings = await MailgunConfig.fromConfig(config);
        return new UserMailgunMailer(mailgunSettings, new DefaultMailFormatter());
    }
}

export class MockedUserMailer extends AbstractMailer {

    public sentMails: MailMessage[];
    protected formatter: UserMailFormatter;

    constructor() {
        super();
        this.formatter = new DefaultMailFormatter();
        this.sentMails = [];
    }

    async sendMessage(message: MailMessage): Promise<void> {
        this.sentMails.push(message);
    }

    async getSentEmails(targetEmail: string): Promise<MailMessage[]> {
        return this.sentMails.filter(m => m.to === targetEmail);
    }

    getBounced(_lastDate?: Date): Promise<BouncedEmail[]> {
        throw new Error("Method not implemented.");
    }
    getBouncedInfo(_address: string): Promise<BouncedEmail> {
        throw new Error("Method not implemented.");
    }
}