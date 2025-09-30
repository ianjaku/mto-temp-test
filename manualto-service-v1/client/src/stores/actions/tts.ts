import { APIListAvailableTTSLanguages, APITextToSpeachHtml } from "../../api/repositoryService";
import { PlayState, TtsActions } from "../zustand/tts-store";
import { BoundaryLoop } from "@binders/client/lib/highlight/boundary_loop";
import { FlashMessageActions } from "@binders/client/lib/react/flashmessages/actions";
import { ITTSTrack } from "@binders/client/lib/clients/repositoryservice/v3/contract";
import { TranslationKeys } from "@binders/client/lib/react/i18n/translations";
import i18next from "@binders/client/lib/react/i18n";

let currentIdentifier: string | null = null;
let updatingAvailableLanguages = false;

export async function updateAvailableLanguages(setLanguages: (languages: string[]) => void): Promise<void> {
    if (updatingAvailableLanguages) return;
    updatingAvailableLanguages = true;
    const languages = await APIListAvailableTTSLanguages();
    setLanguages(languages);
    updatingAvailableLanguages = false;
}

export async function playTTSHtml(
    identifier: string,
    html: string,
    language: string,
    ttsActions: TtsActions,
): Promise<void> {
    try {
        currentIdentifier = identifier;
        const track = await APITextToSpeachHtml(identifier, html, language);
        if (currentIdentifier !== identifier) return;

        const { destructor, audio } = createAudio(identifier, track, ttsActions);

        // IOS Safari needs to be told to actually load the audio
        audio.load();
        ttsActions.setPlayData({ audio, track, destructor });
    } catch (e) {
        if (currentIdentifier === identifier) {
            currentIdentifier = null;
            FlashMessageActions.error(i18next.t(TranslationKeys.Tts_FailedToLoad));
        }
        throw e;
    }
}

function createAudio(
    identifier: string,
    track: ITTSTrack,
    ttsActions: TtsActions,
): {destructor: () => void, audio: HTMLAudioElement} {
    const audio = new Audio();
    const boundaryLoop = createBoundaryLoop(track, audio, ttsActions);

    const dispatchPlayState = (playState: PlayState) =>
        ttsActions.setPlayState({identifier, playState})

    const onCanPlay = () => {
        audio.play();
    }
    audio.addEventListener("canplaythrough", onCanPlay)

    const onPlay = () => {
        dispatchPlayState(PlayState.Playing);
        boundaryLoop.start();
    }
    audio.addEventListener("play", onPlay);

    const onError = () => {
        dispatchPlayState(PlayState.Ended);
        boundaryLoop.stop();
    }
    audio.addEventListener("error", onError);
    
    const onEnded = () => {
        dispatchPlayState(PlayState.Ended);
        boundaryLoop.stop();
    }
    audio.addEventListener("ended", onEnded);

    const onPause = () => {
        dispatchPlayState(PlayState.Paused);
        boundaryLoop.pause();
    }
    audio.addEventListener("pause", onPause);

    audio.src = track.audioFileUrl;

    const destructor = () => {
        audio.pause();
        audio.removeEventListener("canplaythrough", onCanPlay);
        audio.removeEventListener("error", onError);
        audio.removeEventListener("ended", onEnded);
        audio.removeEventListener("pause", onPause);
        audio.removeEventListener("play", onPlay);
    }

    return {
        audio,
        destructor
    };
}

function createBoundaryLoop(
    track: ITTSTrack,
    audio: HTMLAudioElement,
    ttsActions: TtsActions,
) {
    return new BoundaryLoop(
        audio,
        track.boundaries,
        (boundary) => ttsActions.setBoundary({ identifier: track.identifier, boundary })
    );
}
