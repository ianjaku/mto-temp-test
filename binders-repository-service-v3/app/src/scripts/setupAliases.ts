import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import { ensureRepositoryServiceAliases } from "../elastic/aliases";
import { main } from "@binders/binders-service-common/lib/util/process";


main(async () => {
    const config = BindersConfig.get();
    await ensureRepositoryServiceAliases(config)
});