import {
    BackendRepoServiceClient
} from "@binders/binders-service-common/lib/apiclient/backendclient";
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import { getBinderMasterLanguage } from "@binders/client/lib/clients/repositoryservice/v3/helpers";
import { log } from "../logging";
import sleep from "@binders/binders-service-common/lib/util/sleep";

export async function waitForTitleUpdateInBackend(binderId: string, title: string, maxWaitInMilliSeconds = 60_000): Promise<void> {
    const config = BindersConfig.get();
    const repoClient = await BackendRepoServiceClient.fromConfig(config, "acceptance-testing-setup");
    const binder = await repoClient.getBinder(binderId);
    const masterLanguage = getBinderMasterLanguage(binder);
    const currentTitle = masterLanguage.storyTitle;
    log(`Found title '${currentTitle}' for binder ${binderId} (expecting: '${title}')`);
    if (currentTitle != title) {
        const interval = 1000;
        await sleep(interval);
        return waitForTitleUpdateInBackend(binderId, title, maxWaitInMilliSeconds - interval,);
    }
}
