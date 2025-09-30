import { getContainerNameFromUri } from "@binders/client/lib/util/azureStorage";
import videojs from "video.js";



let _tokens: Record<string, string> = {};

export const setVideoAuthTokens = (tokens: Record<string, string>): void => {
    _tokens = tokens;
}

type VideoJsOnRequestOptions = {
    timeout: number;
    headers: Record<string, string>;
    maxPlaylistRetries: number; // Defaults to Infinity
    uri: string;
    withCredentials: boolean;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
(videojs as any).Vhs.xhr.onRequest((options: VideoJsOnRequestOptions) => {
    const containerNameFromUri = getContainerNameFromUri(options.uri);
    if (!containerNameFromUri) {
        return options;
    }
    const token = _tokens[containerNameFromUri];
    if (!token) {
        return options;
    }
    if (options.uri.includes(token)) return options;
    return {
        ...options,
        uri: `${options.uri.split("?")[0]}?${token}`,
    }
});
