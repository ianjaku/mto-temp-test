/* eslint-disable no-console */
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders"
import { LoggerBuilder } from "@binders/binders-service-common/lib/util/logging"
import { UserServiceFactory } from "../userservice/service"

// tslint:disable:no-console
const getOptions = () => {
    if (process.argv.length !== 4) {
        console.error(`Usage: node ${__filename} <LOGIN> <DISPLAYNAME>`);
        process.exit(1);
    }
    return {
        login: process.argv[2],
        displayName: process.argv[3]
    };
};

const {login, displayName} = getOptions();
const config = BindersConfig.get();
UserServiceFactory.fromConfig(config)
    .then( (factory: UserServiceFactory) => {
        const service = factory.build(LoggerBuilder.fromConfig(config));
        service.createUser(login, displayName)
            .then(user => {
                console.log("Created new user.");
                console.log(user);
                process.exit(0);
            })
            .catch(error => {
                console.log("Failed to create user.");
                console.log(error);
                process.exit(1);
            });
    })
    .catch( error => {
        console.log("Failed to initialise service.");
        console.log(error);
        process.exit(255);
    });

// tslint:enable:no-console
