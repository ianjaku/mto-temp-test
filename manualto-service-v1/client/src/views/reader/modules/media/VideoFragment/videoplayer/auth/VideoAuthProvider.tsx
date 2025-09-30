import * as React from "react";
import { FC, createContext, useMemo } from "react";
import { isVideo, isVideoId } from "@binders/client/lib/clients/imageservice/v1/visuals";
import { IBinderVisual } from "@binders/client/lib/clients/repositoryservice/v3/contract";
import { getAssetIdFromUri } from "@binders/client/lib/util/azureStorage";
import { imageClient } from "../../../../../../../api/imageService";
import { setVideoAuthTokens } from "./VideoAuthStore";
import { useQuery } from "@tanstack/react-query";

interface VideoAuthContext {
    tokens: Record<string, string>;
    isLoading: boolean;
}

const videoAuthContext = createContext<VideoAuthContext>({
    tokens: {},
    isLoading: false
});

export const VideoAuthProvider: FC<React.PropsWithChildren<{ visuals: IBinderVisual[] }>> = (props) => {
    const videoIds = useMemo(
        () => props.visuals.map(v => v.id).filter(isVideoId),
        [props.visuals]
    );

    const initialTokens = {};
    for (const visual of props.visuals.filter(isVideo)) {
        if (visual.sasToken) {
            initialTokens[visual.id] = visual.sasToken;
            initialTokens[visual.contentKeyId] = visual.sasToken;
            const manifestUrls = visual.manifestUrls;
            if (manifestUrls == null) continue;
            const assetIds = manifestUrls
                .map(url => getAssetIdFromUri(url))
                .filter(v => v != null);
            for (const assetId of assetIds) {
                initialTokens[assetId] = visual.sasToken;
            }
        }
    }

    const oneHourInMs = 1000 * 60 * 60;
    const { data: tokens, isLoading } = useQuery({
        initialData: initialTokens,
        queryFn: () => imageClient.createVideoSasTokens(videoIds),
        queryKey: ["video-sas-tokens", videoIds],
        staleTime: oneHourInMs * 20,
        refetchOnMount: true,
        refetchInterval: oneHourInMs * 23,
        refetchIntervalInBackground: true,
        refetchOnReconnect: true,
        refetchOnWindowFocus: true,
        enabled: videoIds.length > 0,
    });
    setVideoAuthTokens(tokens);
    
    return (
        <videoAuthContext.Provider value={{ tokens, isLoading  }}>
            {props.children}
        </videoAuthContext.Provider>
    )
}

export const useVideoToken = (visualId: string): string | null => {
    const context = React.useContext(videoAuthContext);
    return context.tokens[visualId] ?? null;
}

export const useIsVideoAuthReady = (): boolean => {
    const context = React.useContext(videoAuthContext);
    if (context.isLoading) return false;
    return true;
}
