/* eslint-disable no-console */
import { BackendUserServiceClient } from "@binders/binders-service-common/lib/apiclient/backendclient"
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders"
import { subYears } from "date-fns";

const config = BindersConfig.get();

BackendUserServiceClient.fromConfig(config, "bounced-emails").then(async (userService) => {

    const latestRun = await userService.getLatestScriptStats("bounced-emails");
    console.log(latestRun ? `Script last ran: ${latestRun.runDateTime}` : "First run" );
    const bouncedSinceLastRun = await userService.getBouncedEmails(latestRun ? latestRun.runDateTime : subYears(Date.now(), 100));
    userService.insertScriptRunStat("bounced-emails", bouncedSinceLastRun);
    const bouncedEmails = bouncedSinceLastRun.map(({address}) => address);
    await Promise.all(bouncedEmails.map(async (email) => {
        try {
            const bouncyUser =  await userService.getUserByLogin(email);
            if(bouncyUser) {
                return userService.updateUser({...bouncyUser, bounced: true});
            }
        } catch (e) {
            console.error(e);
            return Promise.resolve();
        }
        return Promise.resolve();
    }))
    console.log( "Marked as incorrect emails", bouncedEmails);
});

