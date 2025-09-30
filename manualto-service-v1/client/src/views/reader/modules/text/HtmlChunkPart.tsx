import * as React from "react";
import { ChunkDisclaimer } from "./ChunkDisclaimer";
import { ContentChunkKind } from "@binders/client/lib/clients/repositoryservice/v3/contract";
import { ContentChunkProps } from "./types";
import { LDFlags } from "@binders/client/lib/launchdarkly";
import { Paragraph } from "./Paragraph";
import { PlayButton } from "../../../../tts/play_button/play_button";
import { TranslationKeys as TK } from "@binders/client/lib/react/i18n/translations";
import { createTTSChunkIdentifier } from "../../../../tts/identifiers";
import { isMobileDevice } from "../../../../util";
import { useInterfaceLanguage } from "../../../../helpers/hooks/useInterfaceLanguage";
import { useLaunchDarklyFlagValue } from "@binders/ui-kit/lib/thirdparty/launchdarkly/hooks";
import { useMachineTranslatedText } from "../../../../utils/hooks/useMachineTranslatedText";
import { useTTSHighlighter } from "../../../../tts/use_tts_highlighter";
import { useTranslation } from "@binders/client/lib/react/i18n";

const { useCallback } = React;

type HtmlChunkPartProps = ContentChunkProps & {
    paragraphIndex?: number;
}

export const HtmlChunkPart: React.FC<HtmlChunkPartProps> = ({
    chunk,
    chunkId,
    chunkIndex,
    htmlTransformer,
    imageViewportDims,
    kind,
    language,
    minPadding,
    onTextSelection,
    paragraphIndex,
    translatedLanguage,
}) => {
    const { t } = useTranslation();

    const ttsHighlighter = useTTSHighlighter();
    const isVerticallyCentered = chunkIndex === 0;

    const onMouseUp = useCallback((e) => {
        if (!isMobileDevice()) {
            onTextSelection(e);
        }
    }, [onTextSelection]);

    const createContentIdentifier = useCallback((html) => {
        return createTTSChunkIdentifier(chunkId, html, language);
    }, [chunkId, language]);

    const chunksHtml = chunk.reduce((acc, chunk) => {
        return `${acc}<div>${chunk}</div>`;
    }, "");
    const html = htmlTransformer ? htmlTransformer(chunksHtml) : chunksHtml;
    const contentIdentifier = createContentIdentifier(html);
    const highlightedHtml = ttsHighlighter(contentIdentifier, html);

    const interfaceLanguage = useInterfaceLanguage();
    const disclaimer = t(TK.DocManagement_MachineTranslationWarning);
    const translatedDisclaimer = useMachineTranslatedText({
        sourceLanguageCode: interfaceLanguage,
        targetLanguageCode: translatedLanguage,
        text: disclaimer,
    });
    const useChunkDisclaimers = useLaunchDarklyFlagValue(LDFlags.READER_SHARE_MT_DOCUMENTS);

    if (!chunk.length) {
        return (
            <Paragraph
                html={"<p><br /></p>"}
                onMouseUp={onMouseUp}
                isVerticallyCentered={isVerticallyCentered}
                minPadding={minPadding}
                imageViewportDims={imageViewportDims}
            />
        )
    }

    const wrappedPlayButtonMarkup = (
        <div className="play-button-wrapper">
            <PlayButton
                identifier={contentIdentifier}
                html={html}
                language={language}
            />
        </div>
    );

    const showMachineTranslatedDocumentDisclaimer = translatedLanguage &&
        (kind === ContentChunkKind.Html || kind === ContentChunkKind.Checklist);
    const disclaimerMarkup = useChunkDisclaimers && showMachineTranslatedDocumentDisclaimer && (
        <ChunkDisclaimer chunkIdx={chunkIndex}>
            <span>{disclaimer}</span>
            <span>{translatedDisclaimer.data}</span>
        </ChunkDisclaimer>
    )

    const prefixMarkup = <>
        {disclaimerMarkup}
        {wrappedPlayButtonMarkup}
    </>;

    return (
        <Paragraph
            html={highlightedHtml}
            imageViewportDims={imageViewportDims}
            isVerticallyCentered={isVerticallyCentered}
            key={`par-${paragraphIndex}`}
            minPadding={minPadding}
            onMouseUp={onMouseUp}
            prefix={prefixMarkup}
        />
    );
}
