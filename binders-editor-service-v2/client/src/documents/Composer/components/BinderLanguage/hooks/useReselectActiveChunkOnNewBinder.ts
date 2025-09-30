import * as React from "react";
import Binder from "@binders/client/lib/binders/custom/class";
import { SelectedChunkDetails } from "../Chunk";
const { useEffect } = React;

/*
    Reselects the active chunk when a new-version binder comes in (fixes MT-2721)
*/
export default function useReselectActiveChunkOnNewBinder(
    binder: Binder,
    prevBinder: Binder,
    selectedChunkDetails: SelectedChunkDetails,
    setSelectedChunkDetails: (i: SelectedChunkDetails) => void,
): void {
    useEffect(() => {
        if (binder?.getContentVersion() !== prevBinder?.getContentVersion()) {
            setSelectedChunkDetails({ ...selectedChunkDetails, version: (selectedChunkDetails?.version || 0) + 1 });
        }
    }, [binder, prevBinder, selectedChunkDetails, setSelectedChunkDetails]);
}
