import * as React from "react";
import { UnsupportedMedia, fileListToFiles } from "@binders/client/lib/clients/imageservice/v1/visuals";
import { FlashMessages } from "../../../../../logging/FlashMessages";
import { isIE } from "@binders/client/lib/react/helpers/browserHelper";
const { useEffect, useCallback } = React;

export function useVisualPasteListener(
    chunkIndex: number,
    onVisualUpload: (chunkIndex: number, visualFiles: File[], newChunkIndex: number) => void
): void {
    const handlePaste = useCallback(async (event: ClipboardEvent) => {
        if ([-1, false, undefined].includes(chunkIndex)) {
            return;
        }
        const files = isIE() ? window["clipboardData"]?.files : event.clipboardData.files;
        if (!files) {
            return;
        }
        try {
            const visualFiles = await fileListToFiles(files);
            if (visualFiles.length) {
                onVisualUpload(chunkIndex, visualFiles, 999);
                event.preventDefault();
            }
        } catch (e) {
            if (e.name === UnsupportedMedia.NAME) {
                FlashMessages.error(e.description || e.message);
            } else {
                throw e;
            }
        }
    }, [chunkIndex, onVisualUpload]);

    useEffect(() => {
        document.onpaste = handlePaste;
    }, [handlePaste]);

    useEffect(() => { return () => document.onpaste = null }, []);
}
