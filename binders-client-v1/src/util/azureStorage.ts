const VIDEO_ID_REGEX = "vid-[a-zA-Z0-9]{8}-[a-zA-Z0-9]{4}-[a-zA-Z0-9]{4}-[a-zA-Z0-9]{4}-[a-zA-Z0-9]{12}";
const ASSET_ID_REGEX = "asset-[a-zA-Z0-9]{8}-[a-zA-Z0-9]{4}-[a-zA-Z0-9]{4}-[a-zA-Z0-9]{4}-[a-zA-Z0-9]{12}";

function getVideoIdFromUri(uri: string): string {
    const videoIdMatch = uri.match(new RegExp(VIDEO_ID_REGEX, "g"));
    const videoIdMatches = videoIdMatch?.length > 0;
    if (videoIdMatches) return videoIdMatch[0];
    return null;
}

export function getAssetIdFromUri(uri: string): string {
    const assetIdMatch = uri.match(new RegExp(ASSET_ID_REGEX, "g"));
    const assetIdMatches = assetIdMatch?.length > 0;
    if (assetIdMatches) return assetIdMatch[0];
    return null;
}

export function getContainerNameFromUri(uri: string): string {
    return getVideoIdFromUri(uri) || getAssetIdFromUri(uri);
}

export function validateAssetId(assetId: string): boolean {
    return new RegExp(ASSET_ID_REGEX).test(assetId);
}
