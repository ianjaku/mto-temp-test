import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import { BindersRepositoryServiceFactory } from "../repositoryservice/service";
import { ContentServiceFactory } from "../contentservice/service";
import { RoutingServiceFactory } from "../routingservice/service";
import { main } from "@binders/binders-service-common/lib/util/process";
import { syncIndices } from "@binders/binders-service-common/lib/mongo/indices/helpers";

main( async() => {
    const config = BindersConfig.get();
    await BindersRepositoryServiceFactory.fromConfig(config);
    await RoutingServiceFactory.fromConfig(config);
    await ContentServiceFactory.fromConfig(config)
    await syncIndices();
});