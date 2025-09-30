import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders"
import { getImageServiceBuilder } from "../api/config"
import { main } from "@binders/binders-service-common/lib/util/process"
import { syncIndices } from "@binders/binders-service-common/lib/mongo/indices/helpers"

main( async() => {
    const config = BindersConfig.get();
    await getImageServiceBuilder(config);
    await syncIndices();
});