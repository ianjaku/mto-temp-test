import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders"
import { NotificationServiceFactory } from "../notificationservice/service"
import { main } from "@binders/binders-service-common/lib/util/process"
import { syncIndices } from "@binders/binders-service-common/lib/mongo/indices/helpers"

main( async() => {
    const config = BindersConfig.get();
    await NotificationServiceFactory.fromConfig(config);
    await syncIndices();
});