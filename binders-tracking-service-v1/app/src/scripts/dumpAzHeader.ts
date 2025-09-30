/* eslint-disable no-console */
import { BackendSession } from "@binders/binders-service-common/lib/middleware/authentication";
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";

const config = BindersConfig.get();

BackendSession.getToken(config, "generic-backend")
    .then(
        token => {
            console.log(`Authorization: JWT ${token}`);
            process.exit(0);
        },
        error => {
            console.log("!!!! Something went wrong");
            console.log(error);
            process.exit(1);
        }
    )
