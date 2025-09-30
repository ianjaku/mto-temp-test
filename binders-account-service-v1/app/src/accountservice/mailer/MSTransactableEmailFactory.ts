import { Account, MSAccountSetupRequest } from "../model";
import { IMSOPeration } from "@binders/binders-service-common/lib/mstransactableoffers/apiresponses/IMSOperation";
import { MailMessage } from "@binders/binders-service-common/lib/mail/mailgun";

const ADMIN_EMAIL = "Manual.to <admin@manual.to>";


export class MSTransactableEmailFactory {

    constructor(
        private readonly msAdminEmail: string
    ) {}

    createMSClientWelcomeEmail(
        setupRequest: MSAccountSetupRequest
    ): MailMessage {
        return {
            from: ADMIN_EMAIL,
            to: setupRequest.email,
            subject: "Welcome to Manual.to",
            text: `
We have received your order. Thank you for your trust in Manual.to. 

The next step is to arrange an appointment with someone from our team for onboarding. Please let us know by replying to this email, 3 times when you would be available for an hour for your onboarding. You are welcome to invite colleagues to this call. 

As part of your onboarding, we need to sign a Data Protection Agreement together. Our template is based on the EU standard for DPAs, and you can find it at https://drive.google.com/file/d/1ynqgkzeD2W1-uM8vnSDxoWddrwSq_Xyh/view . Please forward it to the person in your organisation legally responsible for signing this kind of agreement for your company. If you are within the EEA area then you can return it without Annex IV.

We look forward to receiving your availability, soon.

Kind regards,
Manual.to Team
            `,
            html: `
We have received your order. Thank you for your trust in Manual.to. 

The next step is to arrange an appointment with someone from our team for onboarding. Please let us know by replying to this email, 3 times when you would be available for an hour for your onboarding. You are welcome to invite colleagues to this call. 

As part of your onboarding, we need to sign a Data Protection Agreement together. Our template is based on the EU standard for DPAs, and you can find it at <a href="https://drive.google.com/file/d/1ynqgkzeD2W1-uM8vnSDxoWddrwSq_Xyh/view">https://drive.google.com/file/d/1ynqgkzeD2W1-uM8vnSDxoWddrwSq_Xyh/view</a>. Please forward it to the person in your organisation legally responsible for signing this kind of agreement for your company. If you are within the EEA area then you can return it without Annex IV.

We look forward to receiving your availability, soon.

Kind regards,
Manual.to Team
            `
        }
    }

    createMSAccountSetupRequestEmail(
        setupRequest: MSAccountSetupRequest
    ): MailMessage {
        return {
            from: ADMIN_EMAIL,
            to: this.msAdminEmail,
            subject: `New account setup request for ${setupRequest.companyName}`,
            text: `
An account setup request has been created through Microsoft.
Please create a new account, then assign the subscription id to it.

Client information:
- company name: ${setupRequest.companyName}
- company site: ${setupRequest.companySite}
- first name: ${setupRequest.firstName}
- last name: ${setupRequest.lastName}
- phone number: ${setupRequest.phone}
- email: ${setupRequest.email}
- subscription id: ${setupRequest.subscriptionId}

            `,
            html: `
An account setup request has been created through Microsoft.<br/>
Please create a new account, then assign the subscription id to it.<br/>
<br/>
Client information:<br/>
<strong>company name</strong> ${setupRequest.companyName}<br/>
<strong>company site</strong> ${setupRequest.companySite}<br/>
<strong>first name</strong> ${setupRequest.firstName}<br/>
<strong>last name</strong> ${setupRequest.lastName}<br/>
<strong>phone number</strong> ${setupRequest.phone}<br/>
<strong>email</strong> ${setupRequest.email}<br/>
<strong>subscription id</strong> ${setupRequest.subscriptionId}<br/>
            `
        }
    }

    createMSSuspendedEmail(
        account: Account
    ): MailMessage {
        return this.simpleAdminNotification(
            `Suspended event received for account ${account.name}`,
            `
The application received a suspension request for the account with name ${account.name}.
This means that no payment has been received on the side of Microsoft.

No action has been taken other than sending this notification.

account name: ${account.name}
account id: ${account.id}
            `
        );
    }

    createMSUnsubscribedEmail(
        account: Account
    ): MailMessage {
        return this.simpleAdminNotification(
            `Account ${account.name} has unsubscribed in the Microsoft store`,
            `
An "Unsubscribe" event has been received from Microsoft for the account ${account.name}.
This means the customer has manually cancelled the service.

For this reason, the account has been expired.

account name: ${account.name}
account id: ${account.id}
            `
        )
    }
    
    createMSChangePlanEmail(
        account: Account,
        operation: IMSOPeration
    ): MailMessage {
        return this.simpleAdminNotification(
            `Received ChangePlan event for account ${account.name}`,
            `
A "ChangePlan" event has been received for the account ${account.name}.
This is a problem because changing plan should not be possible.

No action has been taken, investigation is necessary.

account name: ${account.name}
account id: ${account.id}
operation id: ${operation.id}
subscription id: ${operation.subscriptionId}
operation status: ${operation.status}
            `
        )
    }

    createMSReinstateEmail(
        account: Account
    ): MailMessage {
        return this.simpleAdminNotification(
            `Reinstated event received for account ${account.name}`,
            `
A "Reinstated" event has been received for the account ${account.name}.
This means that after being suspended (late on payment) the payment has finally been received.

No action has been taken.

account name: ${account.name}
account id: ${account.id}
            `
        )
    }

    createChangeQuantityEmail(
        account: Account,
        maxLicensesBeforeChange: number | string,
        maxLicensesAfterChange: number | string
    ): MailMessage {
        return this.simpleAdminNotification(
            `The account ${account.name} has changed their maximum licenses.`,
            `
The account with name ${account.name} has changed their maximum licenses through the Microsoft store.

Before change: ${maxLicensesBeforeChange}
After change(now): ${maxLicensesAfterChange}

The license limit has automatically been updated.

account name: ${account.name}
account id: ${account.id}
            `
        )
    }

    createGenericErrorEmail(
        subject: string,
        message: string,
        errorMessage?: string
    ): MailMessage {
        return this.simpleAdminNotification(
            subject,
            `
${message}

${errorMessage ? "Error Message:" : ""}
${errorMessage ? errorMessage : ""}
            `
        )
    }

    simpleAdminNotification(
        subject: string,
        text: string
    ): MailMessage {
        return {
            to: this.msAdminEmail,
            from: ADMIN_EMAIL,
            subject,
            text,
            html: this.simpleTextToHTML(text)
        }
    }

    simpleTextToHTML(text: string): string {
        return text.replace(/\n/g, "<br/>")
    }
}


