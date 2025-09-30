import {
    BackendImageServiceClient,
    BackendRepoServiceClient
} from "@binders/binders-service-common/lib/apiclient/backendclient";
import { Binder } from "@binders/client/lib/clients/repositoryservice/v3/contract";
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import { VisualStatus } from "@binders/client/lib/clients/imageservice/v1/contract";
import { log } from "../logging";
import sleep from "@binders/binders-service-common/lib/util/sleep";

function getBinderVisualIds(binder: Binder): string[] {
    return binder.modules.images.chunked[0].chunks
        .map(chunk => chunk.map(image => image.id)).flat();
}

export async function getVisualIdsForBinder(binderId: string): Promise<string[]> {
    const config = BindersConfig.get();
    const repoClient = await BackendRepoServiceClient.fromConfig(config, "acceptance-testing");
    const binder = await repoClient.getBinder(binderId);
    return getBinderVisualIds(binder);
}

export async function waitForImageUploads(maxWaitInMilliSeconds: number, binderId: string, imageCount: number): Promise<string[]> {
    const config = BindersConfig.get();
    const repoClient = await BackendRepoServiceClient.fromConfig(config, "acceptance-testing");
    const binder = await repoClient.getBinder(binderId);
    if (maxWaitInMilliSeconds <= 0) {
        log(JSON.stringify(binder, null, 4));
        throw new Error(`Timed out waiting for visual uploads to complete for binder ${binderId}`);
    }

    const visualIds = getBinderVisualIds(binder);
    const actualImageCount = visualIds.length;
    log(`Found ${actualImageCount} images out of ${imageCount} for binder ${binderId}`);
    if (actualImageCount < imageCount) {
        const interval = 1000;
        await sleep(interval);
        return waitForImageUploads(maxWaitInMilliSeconds - interval, binderId, imageCount);
    }
    return visualIds;
}

export async function getVisualIds(binderId: string): Promise<string[]> {
    const config = BindersConfig.get();
    const repoClient = await BackendRepoServiceClient.fromConfig(config, "acceptance-testing");
    const binder = await repoClient.getBinder(binderId);
    return getBinderVisualIds(binder);
}

/**
 * @param isReplaceAction If true, will wait for the same number of visuals before and after the action
 */
export async function waitForVisualIdsToChange(
    binderId: string,
    originalVisualIds: string[],
    isReplaceAction = false,
    triesRemaining = 20,
): Promise<string[]> {
    if (triesRemaining <= 0) {
        throw new Error(`Timed out waiting for visual ids to change for binder ${binderId}`);
    }

    const newVisualIds = await getVisualIds(binderId);
    if (originalVisualIds.length !== newVisualIds.length) {
        if (!isReplaceAction) return newVisualIds;
        await new Promise(resolve => setTimeout(resolve, 500));
        return await waitForVisualIdsToChange(binderId, originalVisualIds, isReplaceAction, triesRemaining - 1);
    }

    const originalVisualsSet = new Set(originalVisualIds);
    const difference = newVisualIds.filter(id => !originalVisualsSet.has(id));
    if (difference.length === 0) {
        await new Promise(resolve => setTimeout(resolve, 500));
        return await waitForVisualIdsToChange(binderId, originalVisualIds, isReplaceAction, triesRemaining - 1);
    }
    return newVisualIds;
}

export async function waitForVisualCompleteState(maxWaitInMilliSeconds: number, binderId: string): Promise<void> {
    const config = BindersConfig.get();
    const imageClient = await BackendImageServiceClient.fromConfig(config, "acceptance-testing");
    const visuals = await imageClient.listVisuals(binderId, { ignoreStatus: true });
    // eslint-disable-next-line no-console
    console.log(`Visuals' status: ${visuals.map(v => v.status)}`)
    if (visuals.some(visual => visual.status !== VisualStatus.COMPLETED)) {
        if (maxWaitInMilliSeconds <= 0) {
            throw new Error(`Timed out waiting for visual uploads to complete for binder ${binderId}`);
        }
        const interval = 10_000;
        await sleep(interval);
        return waitForVisualCompleteState(maxWaitInMilliSeconds - interval, binderId);
    }
}
