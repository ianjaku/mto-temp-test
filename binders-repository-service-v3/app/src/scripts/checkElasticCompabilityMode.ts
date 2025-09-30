import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import { isValidElasticMode } from "@binders/binders-service-common/lib/elasticsearch/migration";

import { log } from "@binders/binders-service-common/lib/util/process";

const config = BindersConfig.get();

async function run() {
    const isCompatibleWithElastic6 = await isValidElasticMode(config, "6")
    const isCompatibleWithElastic7 = await isValidElasticMode(config, "7")
    log(`Is compatible with elastic 6: ${isCompatibleWithElastic6}`)
    log(`Is compatible with elastic 7: ${isCompatibleWithElastic7}`)
    log(`ELASTIC_COMPABILITY_MODE flag: ${process.env.ELASTIC_COMPABILITY_MODE}`)
}

run()
    .then(() => {
        log("All done")
        process.exit(0);
    }, error => {
        log(error)
        process.exit(1)
    });