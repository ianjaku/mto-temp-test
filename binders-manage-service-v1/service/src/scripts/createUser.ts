/* eslint-disable no-console */
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import { CredentialServiceClient } from "@binders/client/lib/clients/credentialservice/v1/client";
import { UserServiceClient } from "@binders/client/lib/clients/userservice/v1/client";
import { UserType } from "@binders/client/lib/clients/userservice/v1/contract";
import nodeRequestHandler from "@binders/binders-service-common/lib/apiclient/nodeclient";

const email = "tom@manual.to";
const password = "fakepassword";
const displayName = "Tom De Coninck";
const type = UserType.Individual;
const licenseCount = 1;

const config = BindersConfig.get();
const userClient = UserServiceClient.fromConfig(config, "v1", nodeRequestHandler);
const credentialClient = CredentialServiceClient.fromConfig(config, "v1", nodeRequestHandler);

function createUserWithPassword(email, displayName, password) {
    userClient.createUser(email, displayName, "", "", type, licenseCount)
        .then(user => {
            console.log("Created user.");
            credentialClient.createCredential(user.id, email, password)
                .then(result => {
                    console.log("Saved password.");
                    console.log(result);
                })
                .catch(error => {
                    console.log("!!! Failed to save password.");
                    console.log(error);
                });
        })
        .catch(error => {
            console.log("!!! Failed to create user.");
            console.log(error);
        });
}

createUserWithPassword(email, displayName, password);