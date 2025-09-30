/* eslint-disable no-console */
import { BCryptPasswordHash } from "../credentialservice/bcrypthash";
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import { LoggerBuilder } from "@binders/binders-service-common/lib/util/logging";
import { Login } from "@binders/binders-service-common/lib/authentication/identity";
import { MongoCredentialRepositoryFactory } from "../credentialservice/repositories/credentials";

const getOptions = () => {
    if (process.argv.length !== 4) {
        console.error(`Usage: node ${__filename} <LOGIN> <NEW PASSWORD>`);
        process.exit(1);
    }
    return {
        login: process.argv[2],
        newPassword: process.argv[3]
    };
};

const {login, newPassword} = getOptions();
const config = BindersConfig.get(60);
const logger = LoggerBuilder.fromConfig(config);

MongoCredentialRepositoryFactory.fromConfig(config, logger)
    .then(credentialRepositoryFactory => {
        const credentialRepository = credentialRepositoryFactory.build(logger);
        return credentialRepository.getLoginAndPassword(new Login(login))
            .then( loginAndPassword => {
                return BCryptPasswordHash.create(newPassword)
                    .then(newPasswordHash => {
                        loginAndPassword.passwordHash = newPasswordHash;
                        return credentialRepository.updatePassword(loginAndPassword);
                    });
            });
    })
    .then(() => {
        console.log("Updated password.");
        process.exit(0);
    })
    .catch(error => {
        console.log("Failed to update password.");
        console.log(error);
        process.exit(1);
    });

// tslint:enable:no-console