import {
    FEATURE_STREAMING_DISABLE_1080p,
    FEATURE_STREAMING_DISABLE_540p,
    FEATURE_STREAMING_DISABLE_720p,
    FEATURE_STREAMING_START_360P,
    FEATURE_STREAMING_START_540P,
    FEATURE_STREAMING_START_720P
} from "@binders/client/lib/clients/accountservice/v1/contract";
import { MutableRefObject, RefObject, useEffect, useRef } from "react";
import Player from "video.js/dist/types/player";
import { createAnalyticsReporterForVideoJsPlayer } from "../videoAnalytics";
import { supportsNetworkInformationApi } from "@binders/client/lib/util/browsers";
import { useIsAccountFeatureActive } from "../../../../../../stores/hooks/account-hooks";
import { useOnChange } from "./useOnChange";
import { useStreamingDebugLogger } from "./useStreamingDebugLogger";
import videojs from "video.js";


export type VideoEventType = keyof HTMLMediaElementEventMap;
export type EventHandlers = Partial<Record<VideoEventType, (eventData: unknown, player: Player) => void>>;

export interface SimplifiedVideoJSOptions {
    loop?: boolean;
    muted?: boolean;
    poster?: string;
    sources: { src: string; type?: string; }[];
}

/**
 * Wraps a normal HTMLVideoElement in a video.js instance.
 * Listens to updates to the options parameter to automatically update the player when necessary.
 * 
 * VideoJS is mostly important for streaming support
 * because HLS streaming is still pretty shaky even on evergreen browsers.
 * 
 * The VideoJS video streaming plugin can be found here: https://github.com/videojs/http-streaming
 * It is, however, included in the main source from version 7 onwards.
 */
export const useVideoJsPlayer = (
    videoEl: MutableRefObject<HTMLVideoElement>,
    options: SimplifiedVideoJSOptions,
    handlers: EventHandlers,
    videoId: string,
): RefObject<Player> => {
    const debugLog = useStreamingDebugLogger();
    const startAt720p = useIsAccountFeatureActive(FEATURE_STREAMING_START_720P);
    const startAt540p = useIsAccountFeatureActive(FEATURE_STREAMING_START_540P);
    const startAt360p = useIsAccountFeatureActive(FEATURE_STREAMING_START_360P);
    const disable1080p = useIsAccountFeatureActive(FEATURE_STREAMING_DISABLE_1080p);
    const disable720p = useIsAccountFeatureActive(FEATURE_STREAMING_DISABLE_720p);
    const disable540p = useIsAccountFeatureActive(FEATURE_STREAMING_DISABLE_540p);

    let startingBandwidth: number | undefined = 5000000; // 5Mbps
    if (startAt720p) startingBandwidth = 4381708;
    if (startAt540p) startingBandwidth = 2089889;
    if (startAt360p) startingBandwidth = 1406272;
    
    const playerRef = useRef<Player>();

    // Listen to changes of these options and apply them to the player when changed
    useOnChange(options.loop, value => playerRef.current?.loop(value));
    useOnChange(options.muted, value => playerRef.current?.muted(value));
    useOnChange(options.poster, value => playerRef.current?.poster(value));

    // Instantiate videoJS
    // If "sources" has to be changeable the videojs object should be recreated
    // because changing sources is otherwise buggy
    useEffect(() => {
        if (videoEl.current == null) return;
        playerRef.current = videojs(videoEl.current, {
            // debug: true,
            html5: {
                vhs: {
                    withCredentials: false,
                    // Let VideoJS handle streaming even on systems that support HLS natively.
                    // Exception: Desktop Safari and iPadOS Chrome, where overriding it breaks auto-playback (MT-5662)
                    // Note: ideally we should be detecting the MSE browser support, though Android Edge had issues with that.
                    overrideNative: !videojs.browser.IS_SAFARI && !(videojs.browser.IS_IPAD && videojs.browser.IS_CHROMIUM),
                    // ABR stands for "adaptive bitrate streaming"
                    // This changes the quality of the video depending on the length of the buffer.
                    // VideoJS currently has an issue where the default handler to change bitrate
                    // sometimes randomly breaks the whole player, this circomvents that.
                    // Ironically the experimental handler is more stable than the default one.
                    experimentalBufferBasedABR: true,
                    // This option forces the player to cache AES-128 encryption keys
                    // internally instead of requesting the key alongside every segment request
                    cacheEncryptionKeys: true,

                    // Will serve low quality videos first on old devices with very low pixel ratios
                    // ! Through trial and error, this feature seems to sometimes cause an "ERROR: (CODE:3 MEDIA_ERR_DECODE) The media playback was aborted due to a corruption problem or because the media used features your browser did not support."
                    // ! This bug was reported on a Galaxy Tab A8, and was confirmed on a Galaxy A10. Please test thuroughly on these devices before re-enabling.
                    // useDevicePixelRatio: true,

                    // Should improve first segment choice (high quality on big devices, low quality on small devices)
                    // ! Removed because it very commonly started the video at low quality, even on fast connections
                    // ! It also ignores starting bandwidth
                    // limitRenditionByPlayerDimensions: true,

                    // Use window.networkInformation.downlink to estimate te network's bandwidth
                    useNetworkInformationApi: true,
                    // If the network information api is available, then that gives a much better result, otherwise we'll store the bandwidth in local storage
                    useBandwidthFromLocalStorage: !supportsNetworkInformationApi(),
                    // Allows us to manually set a starting quality, this can be useful to help customers with very unstable connections
                    // Or clients who only have 1 shaky connection for many devices
                    bandwidth: startingBandwidth,
                },
            },
            loop: options.loop,
            // Always preload, if it shouldn't be preloaded it shouldn't be rendered.
            preload: "auto",
            fill: true,
            autoplay: true, // autoplay always needs be on, to ensure all environments (incl iOS) will correctly preload the video (but pause the video immediately when "play" event fires, if the video is not active) (MT-4323)
            muted: options.muted,
            sources: options.sources,
            poster: options.poster,
        });

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const p = playerRef.current as any;

        if (p.qualityLevels != null) {
            const qualityLevels = p.qualityLevels();
            qualityLevels.on("addqualitylevel", (event) => {
                const qualityLevel = event.qualityLevel;
                if (qualityLevel.height >= 1080 && disable1080p) {
                    qualityLevel.enabled = false;
                    return;
                }
                if (qualityLevel.height >= 720 && disable720p) {
                    qualityLevel.enabled = false;
                    return;
                }
                if (qualityLevel.height >= 540 && disable540p) {
                    qualityLevel.enabled = false;
                    return;
                }
                qualityLevel.enabled = true;
            });
            qualityLevels.on("change", function() {
                debugLog("Quality level changed to:", qualityLevels[qualityLevels.selectedIndex]);
            });
        }

        return () => {
            const player = playerRef.current;
            if (player == null) return;
            player.dispose();
            setTimeout(() => {
                if (player && !player.isDisposed()) player.dispose();
            }, 500);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [videoEl]);

    useEffect(() => {
        createAnalyticsReporterForVideoJsPlayer(playerRef.current, videoId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [playerRef]);

    // Attach event listeners
    useEffect(() => {
        if (playerRef.current == null) return;
        const destructors = Object.keys(handlers).map(eventName => {
            const handler = (data: unknown) => {
                handlers[eventName](data, playerRef.current)
            };
            playerRef.current.on(eventName, handler);
            return () => playerRef.current.off(eventName, handler);
        });
        return () => destructors.forEach(d => d());
    }, [playerRef, handlers])

    return playerRef;
}
