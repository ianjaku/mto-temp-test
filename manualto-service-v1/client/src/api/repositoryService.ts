import {
    IChecklist,
    IChecklistProgress,
    ITTSTrack
} from "@binders/client/lib/clients/repositoryservice/v3/contract";
import { AccountStoreGetters } from "../stores/zustand/account-store";
import {
    BinderRepositoryServiceClient
} from "@binders/client/lib/clients/repositoryservice/v3/client";
import { BindersServiceClientConfig } from "@binders/client/lib/clients/config";
import { addIndexToBoundaries } from "@binders/client/lib/highlight/highlight";
import browserRequestHandler from "@binders/client/lib/clients/browserClient";
import { config } from "@binders/client/lib/config";
import { textFromHtml } from "@binders/client/lib/highlight/html_util";

const client = BinderRepositoryServiceClient.fromConfig(
    config,
    "v3",
    browserRequestHandler,
    AccountStoreGetters.getActiveAccountId,
);
const versionedPath = BindersServiceClientConfig.getVersionedPath(config, "binders", "v3");

export function APIGetChecklists(binderId: string): Promise<IChecklist[]> {
    return client.getChecklists(binderId);
}

export function APITogglePerformed(
    checklistId: string,
    performed: boolean,
    binderId: string,
    publicationId: string
): Promise<IChecklist> {
    return client.togglePerformed(checklistId, performed, binderId, publicationId);
}

export function APIGetChecklistsProgress(binderIds: string[]): Promise<IChecklistProgress[]> {
    return client.getChecklistsProgress(binderIds);
}

export function APIListAvailableTTSLanguages(): Promise<string[]> {
    return client.listAvailableTTSLanguages();
}

export async function APITextToSpeachHtml(
    identifier: string,
    html: string,
    language: string
): Promise<ITTSTrack> {
    const paragraphs = textFromHtml(html);
    const response = await client.generateTextToSpeech(
        paragraphs,
        {
            language
        }
    )
    const boundaries = addIndexToBoundaries(html, response.boundaries);
    return {
        identifier,
        audioFileUrl: joinUrl(versionedPath, response.audioFileUrl),
        boundaries,
        html,
        language
    }
}

function joinUrl(baseUrl: string, path: string): string {
    const baseUrlNoSlash = baseUrl.endsWith("/") ? baseUrl.slice(-1) : baseUrl;
    const pathNoSlash = path.startsWith("/") ? path.slice(1) : path;
    return `${baseUrlNoSlash}/${pathNoSlash}`;
}
