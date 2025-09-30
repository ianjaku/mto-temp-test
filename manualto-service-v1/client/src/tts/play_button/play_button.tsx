import * as React from "react";
import { ButtonStates, useButtonState } from "./hooks";
import {
    PlayState,
    useActions,
    useLanguages,
    usePlayData,
    usePlayState,
} from "../../stores/zustand/tts-store";
import Tooltip, {
    TooltipPosition,
    hideTooltip,
    showTooltip
} from "@binders/ui-kit/lib/elements/tooltip/Tooltip";
import { playTTSHtml, updateAvailableLanguages } from "../../stores/actions/tts";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FEATURE_TEXT_TO_SPEECH } from "@binders/client/lib/clients/accountservice/v1/contract";
import StartPlaying from "@binders/ui-kit/lib/elements/icons/TTS/transitions/startPlaying";
import StopPlaying from "@binders/ui-kit/lib/elements/icons/TTS/transitions/stopPlaying";
import Stopped from "@binders/ui-kit/lib/elements/icons/TTS/static/stopped";
import { TranslationKeys } from "@binders/client/lib/react/i18n/translations";
import circularProgress from "@binders/ui-kit/lib/elements/circularprogress";
import i18next from "@binders/client/lib/react/i18n";
import { useStoreData } from "./use_store_data";
import "./play_button.styl";

export const PlayButton: React.FC<{
    identifier: string,
    html: string,
    language: string,
}> = ({
    identifier,
    html,
    language
}) => {
    const toggleSize = 30;
    const [isLoading, setIsLoading] = useState(false);
    const disabledTooltip = useRef(null);

    const playData = usePlayData();
    const globalPlayState = usePlayState();
    const availableLanguages = useLanguages();
    const ttsActions = useActions();

    const {
        accountSettings,
        features,
    } = useStoreData();

    const hasMyIdentifier = useMemo(() => {
        return playData?.track?.identifier === identifier;
    }, [identifier, playData])

    const playState = useMemo(() =>
        hasMyIdentifier ? globalPlayState : PlayState.None,
    [hasMyIdentifier, globalPlayState]);

    const buttonState = useButtonState(playState);

    const languageWithDefault = useMemo(() => {
        if (language !== "xx") return language;
        return accountSettings?.languages?.defaultCode ?? "en";
    }, [language, accountSettings])

    const isLanguageAvailable = useMemo(() => {
        return availableLanguages.some(al => (
            al.toLowerCase().startsWith(languageWithDefault.toLowerCase())
        ))
    }, [availableLanguages, languageWithDefault])

    useEffect(() => {
        if (playState !== PlayState.None && playState !== PlayState.Ended) {
            setIsLoading(false);
        }
    }, [playState, playData]);

    const handleClick = async (e: React.MouseEvent<HTMLElement>) => {
        e.preventDefault();
        e.stopPropagation();

        if (!isLanguageAvailable) return;
        if (isLoading) return;

        if (hasMyIdentifier && playState === PlayState.Playing) {
            playData?.audio?.pause();
            return;
        }

        if (hasMyIdentifier && playState === PlayState.Paused) {
            playData.audio.play();
            return;
        }

        try {
            setIsLoading(true);
            await playTTSHtml(
                identifier,
                html,
                languageWithDefault,
                ttsActions,
            );
        } catch (e) {
            // eslint-disable-next-line no-console
            console.error(e);
            setIsLoading(false);
        }
    }

    const buttonIcon = useMemo(() => {
        if (isLoading) {
            return circularProgress("", {}, toggleSize, "inherit");
        }
        switch (buttonState) {
            case ButtonStates.START_PLAYING:
                return <StartPlaying height={`${toggleSize}px`}/>;
            case ButtonStates.STOP_PLAYING:
                return <StopPlaying height={`${toggleSize}px`}/>;
            default:
                return <Stopped height={`${toggleSize}px`} />;
        }
    }, [isLoading, buttonState]);

    if (
        availableLanguages.length === 0 &&
        features.includes(FEATURE_TEXT_TO_SPEECH)
    ) {
        updateAvailableLanguages(ttsActions.setLanguages);
    }

    const onMouseEnter = useCallback((e) => {
        if (disabledTooltip.current != null) {
            showTooltip(e, disabledTooltip.current, TooltipPosition.TOP);
        }
    }, [disabledTooltip]);

    const onMouseLeave = useCallback((e) => {
        if (disabledTooltip.current != null) {
            hideTooltip(e, disabledTooltip.current);
        }
    }, [disabledTooltip]);

    return features.includes(FEATURE_TEXT_TO_SPEECH) && (
        <>
            <div
                className={`tts-play-button ${!isLanguageAvailable && "tts-play-button-disabled"}`}
                style={{ width: `${toggleSize}px`, height: `${toggleSize}px` }}
                onClick={e => handleClick(e)}
                onMouseEnter={e => onMouseEnter(e)}
                onMouseLeave={e => onMouseLeave(e)}
            >
                {buttonIcon}
            </div>
            {!isLanguageAvailable &&
                <Tooltip
                    ref={disabledTooltip}
                    message={i18next.t(TranslationKeys.Tts_LanguageNotSupported)}
                />}
        </>
    )
}
