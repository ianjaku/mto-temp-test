import * as React from "react";
import { SelectedChunkDetails } from "../Chunk";
const { useState, useCallback } = React;

export function useSelectedChunkDetails(): [SelectedChunkDetails, (i: SelectedChunkDetails) => void] {
    const [selectedChunkDetails, _setSelectedChunkDetails] =
        useState<SelectedChunkDetails>({ index: -1, isPrimary: true });

    const setSelectedChunkDetails = useCallback((selectedChunkDetails: SelectedChunkDetails) => {
        _setSelectedChunkDetails({
            ...selectedChunkDetails,
            ...(selectedChunkDetails.version === undefined ? { version: 1 } : {}),
        })
    }, []);
    return [ selectedChunkDetails, setSelectedChunkDetails ];
}