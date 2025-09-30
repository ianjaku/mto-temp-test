/* eslint-disable no-console */
import { MailgunConfig, MailgunMailer } from "../src/mail/mailgun";
import { BindersConfig } from "../src/bindersconfig/binders";
import { main } from "../src/util/process";


main( async () => {
    const config = BindersConfig.get();
    const mailgunConfig = await MailgunConfig.fromConfig(config);
    const mailgunMailer = new MailgunMailer(mailgunConfig.apiKey, mailgunConfig.domain);
    const bounces = await mailgunMailer.getBouncedEmails();
    console.log(bounces);
    const bouncedEmail = "d.o.r.ota.przenioslo@gmail.com";
    console.log(await mailgunMailer.checkIfEmailBounced(bouncedEmail));
    console.log(await mailgunMailer.checkIfEmailBounced("fake@manual.to"));
})
