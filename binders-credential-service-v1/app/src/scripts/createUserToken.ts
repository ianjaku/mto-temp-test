/* eslint-disable no-console */
import * as process from "process";
import { TokenBuilder, UserToken, UserTokenData } from "@binders/binders-service-common/lib/tokens";
import { BackendAccountServiceClient } from "@binders/binders-service-common/lib/apiclient/backendclient";
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import { TokenType } from "@binders/client/lib/clients/credentialservice/v1/contract";
import { buildSignConfigFromSecret } from "@binders/binders-service-common/lib/tokens/jwt";
import moment from "moment";

const config = BindersConfig.get();

const now = moment();
const getNDaysInFuture = (daysValid: number) => now.add(daysValid, "days").toDate();

const getOptions = () => {
    if (process.argv.length !== 5) {
        console.error(`Usage: node ${__filename} <ACCOUNTID> <USERID> <DAYSVALID>`);
        process.exit(1);
    }
    return {
        accountId: process.argv[2],
        userId: process.argv[3],
        daysValid: process.argv[4],
    };
};

const options = getOptions();

async function getToken(expirationDate: Date): Promise<UserToken> {
    const accountServiceClient = await BackendAccountServiceClient.fromConfig(config, "create-user-token");
    const accountSettings = await accountServiceClient.getAccountSettings(options.accountId);
    const signConfig = buildSignConfigFromSecret(accountSettings.userTokenSecret);
    const builder = new TokenBuilder(signConfig);
    const data: UserTokenData = {
        sub: `${options.userId}`,
        impersonatedUser: `ext${options.userId}`,
        iat: now.toDate().getTime() / 1000,
        exp: expirationDate.getTime() / 1000,
    };
    return builder.build(TokenType.USER, data, false, expirationDate) as Promise<UserToken>;
}

(async function () {
    const daysValid = parseInt(options.daysValid);
    if (isNaN(daysValid)) {
        console.error(`DAYSVALID: expected integer. Usage: node ${__filename} <ACCOUNTID> <USERID> <DAYSVALID>`);
        process.exit(1);
    }
    const token = await getToken(getNDaysInFuture(daysValid));
    console.log(token);
})();
