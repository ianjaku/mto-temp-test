import {
    PlayState,
    useBoundary,
    usePlayData,
    usePlayState
} from "../stores/zustand/tts-store";
import { addMarkToHtml } from "@binders/client/lib/highlight/highlight";
import { useCallback } from "react";


export function useTTSHighlighter(): (identifier: string, html: string) => string {

    const playData = usePlayData();
    const playState = usePlayState();
    const boundary = useBoundary();

    return useCallback((identifier, html: string) => {
        if (boundary == null) return html;
        if (playState === PlayState.Ended || playState === PlayState.None) return html;
        if (playData?.track?.identifier !== identifier) return html;
        return addMarkToHtml(html, boundary);
    }, [boundary, playData, playState])
}
