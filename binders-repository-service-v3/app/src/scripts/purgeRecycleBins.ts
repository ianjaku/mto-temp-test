import { BackendRepoServiceClient } from "@binders/binders-service-common/lib/apiclient/backendclient";
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import { main } from "@binders/binders-service-common/lib/util/process";


main( async () => {
    const config = BindersConfig.get();
    const repoClient = await BackendRepoServiceClient.fromConfig(config, "purge-recycle-bins");
    await repoClient.purgeRecycleBins();
});