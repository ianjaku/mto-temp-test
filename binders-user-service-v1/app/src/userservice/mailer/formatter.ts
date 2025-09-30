import {
    buildInvitationMailMarkup,
    buildLoginChangeMarkup,
    buildLoginRemovedMarkup,
    buildResetPasswordMarkup
} from "./transactionalMail";
import { MailMessage } from "@binders/binders-service-common/lib/mail/mailgun";
import { ReaderBranding } from "@binders/client/lib/clients/routingservice/v1/contract";
import { TranslationKeys as TK } from "@binders/client/lib/react/i18n/translations";
import i18next from "@binders/client/lib/i18n";

export interface UserMailFormatter {
    formatUserInviteMail(login: string, invitationLink: string, accountName: string, domain: string, readerBranding?: ReaderBranding, accountId?: string, language?: string, deliveryTime?: string): Promise<MailMessage>;
    formatUserLoginChangeMail(login: string, oldLogin: string, domain: string, readerBranding?: ReaderBranding, firstName?: string): Promise<MailMessage>;
    formatUserLoginRemovedMail(oldLogin: string, domain: string, readerBranding?: ReaderBranding, firstName?: string): Promise<MailMessage>;
    formatUserResetPasswordMail(login: string, resetPasswordLink: string, domain: string, language?: string, readerBranding?: ReaderBranding, firstName?: string): Promise<MailMessage>;
}

const INVITATION_SENDER = "Manual.to <welcome@mail.manual.to>";
const LOGIN_UPDATE_SENDER = "Manual.to <login-update@mail.manual.to>";
const RESET_PASSWORD_SENDER = "Manual.to <reset-password@mail.manual.to>";

function buildSalutation(firstName?: string): string {
    return firstName ? `${i18next.t(TK.General_Dear)} ${firstName},` : i18next.t(TK.General_UnaddressedEmailSalutation);
}

export class DefaultMailFormatter implements UserMailFormatter {

    formatUserInviteMail(login: string, invitationLink: string, accountName: string, domain: string, readerBranding?: ReaderBranding, accountId?: string, language?: string, deliveryTime?: string): Promise<MailMessage> {
        switch (accountId) {
            case "aid-1767f159-ca3e-48aa-961c-19d68f64ffca":
                return Promise.resolve(this.getISSInvitationMail(language, login, invitationLink, deliveryTime));
            case "aid-f95adf13-0555-4a23-9724-efd8d1468487":
                return Promise.resolve(this.getSiemensInvitationMail(login, invitationLink));
            case "aid-12ed81e8-26ec-411b-a387-1b6fccf3f629":
                return Promise.resolve(this.getDefaultInvitationMail(login, invitationLink, accountName, domain, "en", readerBranding));
            default:
                return Promise.resolve(this.getDefaultInvitationMail(login, invitationLink, accountName, domain, language, readerBranding));
        }
    }

    async formatUserLoginChangeMail(login: string, oldLogin: string, domain: string, readerBranding?: ReaderBranding, firstName?: string): Promise<MailMessage> {
        return this.getDefaultLoginChangeMail(login, oldLogin, domain, readerBranding, firstName);
    }

    async formatUserLoginRemovedMail(
        oldLogin: string,
        domain: string,
        readerBranding?: ReaderBranding,
        firstName?: string
    ): Promise<MailMessage> {
        return this.getLoginRemovedMail(oldLogin, domain, readerBranding, firstName);
    }

    formatUserResetPasswordMail(
        login: string,
        resetPasswordLink: string,
        domain: string,
        language?: string,
        readerBranding?: ReaderBranding,
        firstName?: string,
    ): Promise<MailMessage> {
        return Promise.resolve(this.getDefaultResetPasswordMail(login, resetPasswordLink, domain, language, readerBranding, firstName));
    }

    async getDefaultInvitationMail(
        login: string,
        invitationLink: string,
        accountName: string,
        domain: string,
        lng: string,
        readerBranding?: ReaderBranding,
    ): Promise<MailMessage> {
        return {
            from: INVITATION_SENDER,
            to: login,
            subject: i18next.t(TK.User_InvitationMailSubject, { accountName, lng }),
            text: `${i18next.t(TK.User_InvitationMailText1, { accountName, lng })}
${i18next.t(TK.User_InvitationMailText2, { invitationLink, lng })}
${i18next.t(TK.User_TransactionalMail_WhatIsManualTo, { accountName })}`,
            ...buildInvitationMailMarkup(
                accountName,
                domain,
                invitationLink,
                readerBranding,
                lng,
            )
        };
    }

    getDefaultLoginChangeMail(login: string, oldLogin: string, domain: string, readerBranding?: ReaderBranding, firstName?: string): MailMessage {
        const salutation = buildSalutation(firstName);
        return {
            from: LOGIN_UPDATE_SENDER,
            to: login,
            subject: i18next.t(TK.User_LoginChangedMailSubject),
            text: `${salutation}

${i18next.t(TK.User_LoginChangedMailBody1_txt, { login, oldLogin })}
${i18next.t(TK.User_LoginChangedMailBody2)}

${i18next.t(TK.General_Regards)}, Manual.to
`,
            ...buildLoginChangeMarkup(
                salutation,
                login,
                oldLogin,
                domain,
                readerBranding,
            ),
        };
    }

    getLoginRemovedMail(
        oldLogin: string,
        domain: string,
        readerBranding?: ReaderBranding,
        firstName?: string
    ): MailMessage {
        const salutation = buildSalutation(firstName);
        return {
            from: LOGIN_UPDATE_SENDER,
            to: oldLogin,
            subject: i18next.t(TK.User_LoginChangedMailSubject),
            text: `${salutation}
${i18next.t(TK.User_LoginRemovedMailBody1, { oldLogin })}
${i18next.t(TK.User_LoginRemovedMailBody2)}

${i18next.t(TK.General_Regards)}, Manual.to
`,
            ...buildLoginRemovedMarkup(
                salutation,
                oldLogin,
                readerBranding,
                domain,
            )
        }
    }

    getDefaultResetPasswordMail(
        login: string,
        resetPasswordLink: string,
        domain: string,
        lng: string,
        readerBranding?: ReaderBranding,
        firstName?: string,
    ): MailMessage {
        const salutation = buildSalutation(firstName);
        return {
            from: RESET_PASSWORD_SENDER,
            to: login,
            subject: i18next.t(TK.User_ResetPasswordMailSubject, { lng }),
            text: `${salutation}

${i18next.t(TK.User_ResetPasswordMailBody1)} ${i18next.t(TK.User_ResetPasswordMailBody3)}

${i18next.t(TK.User_ResetPasswordMailText, { resetPasswordLink, lng })}

${i18next.t(TK.General_Regards, { lng })}, Manual.to
`,
            ...buildResetPasswordMarkup(
                salutation,
                resetPasswordLink,
                domain,
                readerBranding,
                lng
            ),
        };
    }

    getISSInvitationMail(language: string, to: string, invitationLink: string, deliveryTime: string): MailMessage {
        const alternateLanguage = language === "fr" ? "nl" : "fr";
        return {
            from: "ISS Facility Services <welcome@mail.manual.to>",
            to,
            subject: language === "fr" ? "Créer votre profil et voir les manuels ISS" : "Maak je profiel aan en bekijk de ISS-manuals",
            text: `Create your profile here: ${invitationLink}`,
            html:
                "<table style='font-family: \"Arial\", sans-serif; font-size: 11pt'>" +
                "<tr>" +
                "<td height='120' align='left' valign='bottom' style='padding: 10px'>" +
                "<img style='display:block;' src='cid:header-iss-email.png' width='300'/>" +
                "</td>" +
                "</tr>" +
                "<tr>" +
                "<td cellpadding='20' style='color: #7f7f7f; padding: 20px'>" +
                "<p style='font-size: 8pt; color: #7f7f7f'/>" +
                `<span>${language === "fr" ? "Nederlandstalige versie onderaan" : "Version française ci-dessous"}</span>` +
                "</p>" +
                this.getInvitationMailContent(language, invitationLink) +
                "</td>" +
                "</tr>" +
                "<tr><td><hr/></td></tr>" +
                "<tr>" +
                "<td cellpadding='20' style='color: #7f7f7f !important; padding: 20px'>" +
                this.getInvitationMailContent(alternateLanguage, invitationLink) +
                "</td>" +
                "</tr>" +
                "</table>",
            inlineAttachments: [{
                filename: "header-iss-email.png",
                path: `${global["userStaticRoot"]}/header-iss-email.png`,
                cid: "header-iss-email.png"
            }],
            deliveryTime
        };
    }

    getSiemensInvitationMail(login: string, invitationLink: string): MailMessage {
        return {
            from: INVITATION_SENDER,
            to: login,
            subject: "You have been invited to join Siemens on manual.to",
            text: `Create your profile here: ${invitationLink}`,
            html: `<p>Thank you for registering with manual.to. To set up your account, please click <a href="${invitationLink}">here</a>.
            <p>You can then easily access our manuals online, including from your mobile devices .
            <p>Please note that all content within the documents is classed public to adhere to Infosec guidelines.`,
            attachments: []
        };
    }

    getArcelorMittalOneTimeInvitationMail(login: string, invitationLink: string): MailMessage {
        return {
            from: INVITATION_SENDER,
            to: login,
            subject: "Je bent uitgenodigd om lid te worden van arcelormittal.manual.to",
            text: `Klik hier om je profiel aan te maken: ${invitationLink}`,
            html: `<p>Goedemiddag,</p>
            <p>Gisteren ontvingen jullie van Ronnie al een email met uitleg ivm. het gebruiken van Manual.to binnen ArcelorMittal.</p>
            <p>Als je klikt op volgende link, kom je op een pagina waar jullie een eigen paswoord kunnen instellen:<p>
            <p><a href="${invitationLink}">arcelormittal.manual.to</a></p>
            <p>Met je ArcelorMittal email adres en het door jullie ingestelde wachtwoord kun je inloggen op arcelormittal.manual.to en editor.manual.to (als je een manual wilt maken).<p>
            <p>Veel maakplezier!<p>
            <p>Groetjes,<br/>Het Manual.to team<p>`,
            attachments: []
        };
    }

    getInvitationMailContent(language: string, invitationLink: string): string {
        invitationLink = `${invitationLink}?l=${language}`;
        return (language === "fr") ?
            "<p>Chers collaborateurs,</p>" +
            "<p><span style='color: #003859; font-weight: bold'>Bienvenue chez ISS</span>. Vous faites à présent partie de la plus grande entreprise de services facililtaires de Belgique et du Luxembourg. Pas moins de 10.000 collaborateurs sont quotidiennement au service de près de 10.000 clients.</p>" +
            "<p>L'outil <span style='color: #003859; font-weight: bold'><span>issworld.</span><span>manual.</span><span>to</span></span> vous permet de recevoir des manuels pratiques à propos de notre entreprise et des conseils utiles pour vous aider dans votre travail. Si vous avez encore d’autres questions, vous pouvez toujours vous adresser à votre supérieur hiérarchique immédiat ou par courrier électronique à mysupport@be.issworld.com.</p>" +
            "<p><span style='color: #003859; font-weight: bold'>Cliquez sur le bouton ci-dessous</span> pour créer votre profil et voir les instructions.</p>" +
            `<p><a href="${invitationLink}" style='background-color: #c1272d;border-radius: 3px;color: #ffffff;display: inline-block;line-height: 37px;text-align: center;text-decoration: none;-webkit-text-size-adjust: none;padding-left: 10px;padding-right: 10px;'> &gt; Créez votre profil</a></p>` :
            "<p>Beste medewerker,</p>" +
            "<p><span style='color: #003859; font-weight: bold'>Welkom bij ISS</span>. Je hoort nu thuis bij de grootste facilitaire dienstverlener in België en Luxemburg. Met meer dan 10.000 medewerkers ondersteunen we dagelijks bijna 10.000 klanten.</p>" +
            "<p>Op <span style='color: #003859; font-weight: bold'><span>issworld.</span><span>manual.</span><span>to</span></span> vind je praktische informatie over ons bedrijf en nuttige tips die je helpen bij je werkzaamheden. Met vragen kan je steeds terecht bij je leidinggevende of bij mysupport@be.issworld.com.</p>" +
            "<p><span style='color: #003859; font-weight: bold'>Klik op onderstaande knop</span> om een profiel aan te maken en de manuals te bekijken.</p>" +
            `<p><a href="${invitationLink}" style='background-color: #c1272d;border-radius: 3px;color: #ffffff;display: inline-block;line-height: 37px;text-align: center;text-decoration: none;-webkit-text-size-adjust: none;padding-left: 10px;padding-right: 10px;'> &gt; Maak profiel aan</a></p>`;
    }
}

