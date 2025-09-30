import { MailMessage, MailgunConfig, MailgunMailer } from "@binders/binders-service-common/lib/mail/mailgun";
import { Config } from "@binders/client/lib/config/config";
import { MSTransactableEmailFactory } from "./MSTransactableEmailFactory";
import { MSTransactableOffersConfig } from "@binders/binders-service-common/lib/mstransactableoffers";

export class AccountServiceMailer extends MailgunMailer {

    constructor(
        config: MailgunConfig,
        private transactableConfig: MSTransactableOffersConfig
    ) {
        super(config.apiKey, config.domain);
    }

    async sendMSTransactable(creator: (factory: MSTransactableEmailFactory) => MailMessage): Promise<void> {
        const factory = new MSTransactableEmailFactory(this.transactableConfig.notificationEmailAddress);
        const mail = creator(factory);

        if (this.transactableConfig.isDummy) {
            return this.sendDummyMessage(mail);
        }
        
        return this.sendMessage(mail);
    }

    private sendDummyMessage(mail: MailMessage) {
        // eslint-disable-next-line no-console
        console.log("\n\n\n");
        // eslint-disable-next-line no-console
        console.log("Dummy email:", mail);
        // eslint-disable-next-line no-console
        console.log("\n\n\n");
    }
    
    static fromConfig(config: Config): Promise<AccountServiceMailer> {
        return MailgunConfig.fromConfig(config)
            .then(mailgunSettings =>
                new AccountServiceMailer(
                    mailgunSettings,
                    MSTransactableOffersConfig.fromConfig(config)
                )
            );
    }
}
