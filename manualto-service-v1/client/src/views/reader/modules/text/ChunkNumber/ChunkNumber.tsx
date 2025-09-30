import * as React from "react";
import { ContentChunkKind } from "@binders/client/lib/clients/repositoryservice/v3/contract";
import { useActiveChunkIndex } from "../../../../../stores/hooks/chunk-position-hooks";
import { useChunkNumberOffset } from "./hooks";
import "./ChunkNumber.styl";

export const ChunkNumber: React.FC<{ chunkKinds: ContentChunkKind[] }> = ({ chunkKinds }) => {
    const chunkNumberOffset = useChunkNumberOffset();
    const chunkIndex = useActiveChunkIndex();
    const [shouldChunkBeVisible, setShouldChunkBeVisible] = React.useState<boolean>(false);
    const [chunkNumber, setChunkNumber] = React.useState<number | null>(null);

    React.useEffect(() => {
        const chunkKind = chunkKinds[chunkIndex];
        if (chunkKind === ContentChunkKind.Html) {
            setShouldChunkBeVisible(true);
            setChunkNumber(chunkIndex + chunkNumberOffset);
        } else {
            setShouldChunkBeVisible(false);
        }
    }, [chunkIndex, chunkKinds, chunkNumberOffset]);

    return (
        <div className={`chunk-number ${shouldChunkBeVisible ? "chunk-number--visible" : ""}`}>
            {chunkNumber}
        </div>
    );
};