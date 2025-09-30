/* eslint-disable no-console */
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import { CredentialServiceFactory } from "../credentialservice/service";
import { LoggerBuilder } from "@binders/binders-service-common/lib/util/logging";

const getOptions = () => {
    if (process.argv.length !== 5) {
        console.error(`Usage: node ${__filename} <USERID> <LOGIN> <PASSWORD>`);
        process.exit(1);
    }
    return {
        userId: process.argv[2],
        login: process.argv[3],
        password: process.argv[4]
    };
};

const {login, password, userId} = getOptions();

const config = BindersConfig.get();
const logger = LoggerBuilder.fromConfig(config);

CredentialServiceFactory.fromConfig(config)
    .then( credentialServiceFactory => {
        const credentialService = credentialServiceFactory.forRequest(logger);
        return credentialService.createCredential(userId, login, password);
    })
    .then(() => {
        console.log("Credentials created.");
        process.exit(0);
    })
    .catch( error => {
        console.log("Could not create credentials.");
        console.log(error);
        process.exit(255);
    });

// tslint:enable:no-console    