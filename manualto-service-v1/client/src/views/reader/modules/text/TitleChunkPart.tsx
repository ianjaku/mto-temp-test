import * as React from "react";
import { Binder, Publication } from "@binders/client/lib/clients/repositoryservice/v3/contract";
import { fmtDateTimeRelative, fmtDateTimeWritten } from "@binders/client/lib/util/date";
import {
    useActiveLanguageCode,
    useActiveLanguageCodeForPreview,
    useActiveViewable,
    useActiveViewableTitle,
} from "../../../../stores/hooks/binder-hooks";
import { useCallback, useMemo } from "react";
import { ContentChunkProps } from "./types";
import Icon from "@binders/ui-kit/lib/elements/icons";
import { TITLE_CHUNK_DATAPROP } from "@binders/client/lib/clients/repositoryservice/v3/helpers";
import { TK } from "@binders/client/lib/react/i18n/translations";
import { VerticalCenter } from "./VerticalCenter";
import { formatTimeFromSeconds } from "@binders/ui-kit/lib/helpers/helpers";
import { isMobileDevice } from "../../../../util";
import { isVideoId } from "@binders/client/lib/clients/imageservice/v1/visuals";
import { useTranslation } from "@binders/client/lib/react/i18n";
import "./TitleChunkPart.styl";

export type TitleChunkPartProps = ContentChunkProps;

export const TitleChunkPart = (props: TitleChunkPartProps) => {
    const {
        onTextSelection,
        chunk,
    } = props;
    const activeViewable = useActiveViewable();
    const activeBinder = activeViewable as Binder;
    const activePublication = activeViewable as Publication;
    const storyTitle = useActiveViewableTitle();
    const language = useActiveLanguageCode();
    const previewLanguage = useActiveLanguageCodeForPreview();
    const activeLangIdx = activeBinder?.languages?.findIndex(lang => lang.iso639_1 === language || lang.iso639_1 === previewLanguage);

    const { t } = useTranslation();

    const estimatedReadingTimeSeconds = useMemo(() => {
        const IMAGE_READ_TIME_SECONDS = 12;
        const WORDS_PER_MINUTE = 150;
        try {
            const parser = new DOMParser();
            const doc = parser.parseFromString(chunk.at(0), "text/xml");
            const body = doc.querySelector("body");
            const videoWatchTime = parseInt(body.getAttribute("data-total-video-duration-secs"));
            const imagesCount = activeViewable.modules.images.chunked.at(0).chunks
                .flat()
                .filter(i => i.id && !isVideoId(i.id))
                .length;
            const imageViewTime = imagesCount * IMAGE_READ_TIME_SECONDS;
            const tempDiv = document.createElement("div");
            const chunkText = activeViewable.modules.text.chunked.at(activeLangIdx).chunks.flat().join(" ");
            tempDiv.innerHTML = chunkText;
            const text = tempDiv.textContent ?? tempDiv.innerText ?? "";
            const wordCount = text.trim().split(/\s+/).map(s => s.trim()).filter(Boolean).length;
            const textReadingTime = Math.ceil(wordCount / WORDS_PER_MINUTE * 60);
            const totalTime = videoWatchTime + imageViewTime + textReadingTime;
            return totalTime - (totalTime % 10) + 10;
        } catch (e) {
            // eslint-disable-next-line no-console
            console.error(e);
            return null;
        }
    }, [chunk, activeLangIdx, activeViewable]);

    const onMouseUp = useCallback((e) => {
        if (!isMobileDevice()) onTextSelection(e);
    }, [onTextSelection]);

    const publicationDate = activeViewable.documentType === "publication" ? new Date(activePublication.publicationDate) : undefined;
    const hasPublicationDate = publicationDate && !isNaN(publicationDate.getTime());
    const lastUpdatedAt = t(TK.Analytics_LastUpdated) + " " + (
        hasPublicationDate ?
            fmtDateTimeRelative(publicationDate, { addSuffix: true }) :
            t(TK.General_Now)
    );
    const lastUpdateDate = fmtDateTimeWritten(hasPublicationDate ? publicationDate : new Date());
    const errorReadingTime = estimatedReadingTimeSeconds == null || isNaN(estimatedReadingTimeSeconds) ? "--:--" : null;
    const documentLength = errorReadingTime ?? formatTimeFromSeconds(estimatedReadingTimeSeconds, { verbose: true, skipRoundingTo5Minutes: true });

    return (
        <VerticalCenter
            isVerticallyCentered={true}
            minPadding={props.minPadding}
            imageViewportHeight={props.imageViewportDims.height}
            onMouseUp={onMouseUp}
            className="chunk-html"
        >
            <div className="title-chunk" {...{ [TITLE_CHUNK_DATAPROP]: true }}>
                <div className="title-chunk-title">
                    <h1>{props.translatedTitle || storyTitle}</h1>
                </div>
                <div className="title-chunk-pills">
                    <div
                        className="title-chunk-pill"
                        data-testid="read-time"
                    ><Icon name="timer" outlined /><span>{documentLength}</span></div>
                    <div
                        className="title-chunk-pill hoverable"
                        data-testid="last-updated-at"
                    ><Icon name="update" outlined />
                        <span>{lastUpdatedAt}</span>
                        <span className="title-chunk-pill-tooltip">{lastUpdateDate}</span>
                    </div>
                </div>
            </div>
        </VerticalCenter>
    );
}
