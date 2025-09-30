/* eslint-disable no-console */
import {BindersConfig} from "@binders/binders-service-common/lib/bindersconfig/binders";
import {ensureMappings} from "../elastic/mappings/ensureMapping";

const config = BindersConfig.get();
ensureMappings(config)
    .then(() => console.log("All done"))
    .catch(error => {
        console.log("!!! Could not ensure mapping.");
        console.log(error);
        process.exit(1);
    });
