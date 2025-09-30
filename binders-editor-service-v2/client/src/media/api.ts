import AccountStore from "../accounts/store";
import { ImageServiceClient } from "@binders/client/lib/clients/imageservice/v1/client";
import browserRequestHandler from "@binders/client/lib/clients/browserClient";
import { config } from "@binders/client/lib/config";

const client = ImageServiceClient.fromConfig(
    config,
    browserRequestHandler,
    AccountStore.getActiveAccountId.bind(AccountStore)
);

export const APIListVisuals = async (binderId, options) => {
    const visuals = await client.listVisuals(binderId, options);
    return visuals;
}

export const APIGetVisual = async (binderId, visualId, options = null) => {
    return await client.getVisual(binderId, visualId, options);
}

export const APIUpdateVisualFitBehaviour = async (binderId, visualId, newFitBehaviour) => {
    const visual = await client.updateVisualFitBehaviour(binderId, visualId, newFitBehaviour);
    return visual;
}

export const APIUpdateVisualBgColor = async (binderId, visualId, newBgColor) => {
    const visual = await client.updateVisualBgColor(binderId, visualId, newBgColor);
    return visual;
}

export const APIUpdateVisualRotation = async (binderId, visualId, rotation) => {
    const visual = await client.updateVisualRotation(binderId, visualId, rotation);
    return visual;
}

export const APIUpdateVisualLanguageCodes = async (binderId, visualId, languageCodes) => {
    const visual = await client.updateVisualLanguageCodes(binderId, visualId, languageCodes);
    return visual;
}

export const APIUpdateVisualAudio = async (binderId, visualId, enabled) => {
    const visual = await client.updateVisualAudio(binderId, visualId, enabled);
    return visual;
}

export const APIUpdateVisualAutoPlay = async (binderId, visualId, autoPlay) => {
    return client.updateVisualAutoPlay(binderId, visualId, autoPlay);
}

export const APIDeleteVisual = (binderId, visualId) => {
    client.deleteImage(binderId, visualId);
}

export const APIUploadVisualFiles = (binderId, visualFiles, onProgress, onEnd, accountId) => {
    return client.uploadVisual(binderId, visualFiles, accountId, onProgress, onEnd);
}

export const APIEnsureScreenshotAt = async (binderId: string, visualId: string, timestampMs: number) => {
    return client.ensureScreenshotAt(binderId, visualId, timestampMs, AccountStore.getActiveAccountId());
}
