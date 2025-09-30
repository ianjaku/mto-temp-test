import * as React from "react";
import ChunkVisuals from "../ChunkVisuals";
import { IPreviewVisual } from "../../../contract";
import { THUMBNAIL_SIZE } from "../Chunk";
import { TranslationKeys as TK } from "@binders/client/lib/react/i18n/translations";
import cx from "classnames";
import { useTranslation } from "@binders/client/lib/react/i18n";

const { useCallback } = React;

interface IFalseChunkProps {
    includeVisuals: boolean;
    transformFalseChunkToRealOne: () => void;
    newIndex: number;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onVisualUpload: (chunkIndex: number, visualFiles: any[], visualIndex?: number) => void;
    isDragging: boolean;
    gridRow: number;
    previewVisuals: IPreviewVisual[],
    gridColumn: number;
    marginTop?: string;
    isDisabled?: boolean;
}

const FalseChunk: React.FC<IFalseChunkProps> = (props: IFalseChunkProps) => {
    const {
        includeVisuals,
        transformFalseChunkToRealOne,
        newIndex,
        onVisualUpload,
        isDragging,
        gridRow,
        gridColumn,
        marginTop,
        previewVisuals,
        isDisabled = false,
    } = props;
    const { t } = useTranslation();

    const onFocus = useCallback((e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!isDisabled) {
            transformFalseChunkToRealOne();
        }
    }, [transformFalseChunkToRealOne, isDisabled]);

    const styleObj = {
        gridRow,
        msGridRow: gridRow,
        gridColumn,
        msGridColumn: gridColumn,
        marginTop,
    };

    return (
        <div
            className={"chunkNEW chunkNEW--emptyChunk"}
            style={styleObj}
        >
            <div
                key="empty-chunk"
                className={`chunk empty-chunk ${isDisabled ? "isDisabled" : ""}`}
            >
                {includeVisuals && <ChunkVisuals
                    isTitleVisual={false}
                    isDragging={isDragging}
                    chunkIndex={newIndex}
                    previewVisuals={previewVisuals}
                    isEmptyChunk={true}
                    thumbnailSize={THUMBNAIL_SIZE}
                    onVisualUpload={onVisualUpload}
                    className="chunkNEW-visuals"
                    isDisabled={isDisabled}
                />}
                <div className={cx("chunktext-wrapper", "chunktext-wrapper--emptyChunk")}  onFocus={onFocus} >
                    <div className="empty-chunk" tabIndex={newIndex + 1} >
                        {t(TK.Edit_AddNewChunk)}
                    </div>
                </div>
            </div >
        </div>);
}

export default FalseChunk;