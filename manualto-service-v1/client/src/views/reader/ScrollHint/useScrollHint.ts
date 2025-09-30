import { useAnimateVisibility, usePrevious } from "@binders/client/lib/react/helpers/hooks";
import { useCallback, useEffect, useMemo, useState } from "react";
import { LDFlags } from "@binders/client/lib/launchdarkly/flags";
import { useLaunchDarklyFlagValue } from "@binders/ui-kit/lib/thirdparty/launchdarkly/hooks";

export enum HintState {
    InitiallyHiddenSeenBefore = "InitiallyHiddenSeenBefore",
    InitiallyHiddenNotSeen = "InitiallyHiddenNotSeen",
    InitiallyHiddenAfterInteraction = "InitiallyHiddenAfterInteraction",
    FirstTimeVisible = "FirstTimeVisible",
    FirstTimeHiddenAfterInteraction = "FirstTimeHiddenAfterInteraction",
    FirstTimeHiddenIgnored = "FirstTimeHiddenIgnored",
    SecondTimeVisible = "SecondTimeVisible",
    SecondTimeHiddenAfterInteraction = "SecondTimeHiddenAfterInteraction",
    SecondTimeHiddenIgnored = "SecondTimeHiddenIgnored",
}

const LOCAL_STORAGE_KEY = "scroll-hint-state";

type ScrollHintConfiguration = {
    firstAppearAfterInactivityMs: number;
    firstDisappearAfterInactivityMs: number;
    secondAppearAfterInactivityMs: number;
    secondDisappearAfterInactivityMs: number;
}

const DEFAULT_SCROLL_HINT_CONFIGURATION = {
    firstAppearAfterInactivityMs: 7_000,
    firstDisappearAfterInactivityMs: 4_000,
    secondAppearAfterInactivityMs: 10_000,
    secondDisappearAfterInactivityMs: 4_000,
}

export type UseScrollHint = {
    hintState: HintState,
    isVisible: boolean,
    shouldRender: boolean,
    onFocus: () => void,
};


export function useScrollHint(
    // Ideally this wouldn't need to be passed, but importing useActiveChunkIndex
    // causes jest to fail parsing the file, because of flux down the way
    activeChunkIndex: number,
): UseScrollHint {
    const [hintState, setInternalHintState] = useState<HintState>(HintState.InitiallyHiddenSeenBefore);
    const [isListeningToChunkChanges, setIsListeningToChunkChanges] = useState(false);
    const previousChunkIndex = usePrevious(activeChunkIndex);
    const setHintState = (val: HintState) => {
        saveToLocalStorage(val);
        setInternalHintState(val);
    };
    const {
        isVisible,
        shouldRender,
        setVisibility,
    } = useAnimateVisibility(false, { delayMs: 200 });

    const ldScrollHintConfig = useLaunchDarklyFlagValue<Partial<ScrollHintConfiguration>>(LDFlags.SCROLL_HINT_CONFIGURATION);
    const scrollHintConfig = useMemo(() => sanitizeConfiguration(ldScrollHintConfig), [ldScrollHintConfig]);

    useEffect(() => {
        const localState = getFromLocalStorage() ?? HintState.InitiallyHiddenNotSeen
        switch (localState) {
            case HintState.InitiallyHiddenAfterInteraction:
            case HintState.FirstTimeHiddenAfterInteraction:
            case HintState.SecondTimeHiddenAfterInteraction:
                setHintState(HintState.InitiallyHiddenSeenBefore);
                break;
            default:
                setHintState(HintState.InitiallyHiddenNotSeen);
        }
    }, []);

    useEffect(() => {
        switch (hintState) {
            case HintState.FirstTimeVisible:
            case HintState.SecondTimeVisible:
                setVisibility(true);
                break;
            default:
                setVisibility(false);
        }
    }, [hintState, setVisibility]);

    useEffect(() => {
        let handle: NodeJS.Timeout;
        switch (hintState) {
            case HintState.InitiallyHiddenNotSeen:
                handle = setTimeout(() => setHintState(HintState.FirstTimeVisible), scrollHintConfig.firstAppearAfterInactivityMs);
                return () => clearTimeout(handle);
            case HintState.FirstTimeVisible:
                handle = setTimeout(() => setHintState(HintState.FirstTimeHiddenIgnored), scrollHintConfig.firstDisappearAfterInactivityMs);
                return () => clearTimeout(handle);
            case HintState.FirstTimeHiddenIgnored:
                handle = setTimeout(() => setHintState(HintState.SecondTimeVisible), scrollHintConfig.secondAppearAfterInactivityMs);
                return () => clearTimeout(handle);
            case HintState.SecondTimeVisible:
                handle = setTimeout(() => setHintState(HintState.SecondTimeHiddenIgnored), scrollHintConfig.secondDisappearAfterInactivityMs);
                return () => clearTimeout(handle);
        }
    }, [hintState, scrollHintConfig]);

    const onFocus = useCallback(() => {
        switch (hintState) {
            case HintState.InitiallyHiddenNotSeen:
                setHintState(HintState.InitiallyHiddenAfterInteraction);
                break;
            case HintState.FirstTimeVisible:
                setHintState(HintState.FirstTimeHiddenAfterInteraction);
                break;
            case HintState.FirstTimeHiddenIgnored:
            case HintState.FirstTimeHiddenAfterInteraction:
                setHintState(HintState.SecondTimeHiddenAfterInteraction);
                break;
            case HintState.SecondTimeVisible:
            case HintState.SecondTimeHiddenIgnored:
                setHintState(HintState.SecondTimeHiddenAfterInteraction);
                break;
        }
    }, [hintState]);

    // When the document is initially rendered, the boundary map changes couple times
    // and the active chunk index changes from 0 to 1 and back to 0.
    // This is to avoid listening for changes during that time.
    useEffect(() => {
        switch (hintState) {
            case HintState.FirstTimeHiddenAfterInteraction:
            case HintState.SecondTimeHiddenAfterInteraction:
            case HintState.InitiallyHiddenSeenBefore:
                return;
        }
        const handle = setTimeout(() => setIsListeningToChunkChanges(true), 2_000);
        return () => clearTimeout(handle);
    }, [hintState]);

    useEffect(() => {
        if (!isListeningToChunkChanges) return;
        if (previousChunkIndex !== activeChunkIndex) {
            onFocus();
        }
    }, [activeChunkIndex, isListeningToChunkChanges, onFocus, previousChunkIndex]);

    return {
        hintState,
        isVisible,
        onFocus,
        shouldRender,
    };
}

const sanitizeConfiguration = (
    config?: Partial<ScrollHintConfiguration>
): ScrollHintConfiguration => ({
    firstAppearAfterInactivityMs:
        numberOrUndefined(config?.firstAppearAfterInactivityMs) ??
        DEFAULT_SCROLL_HINT_CONFIGURATION.firstAppearAfterInactivityMs,
    firstDisappearAfterInactivityMs:
        numberOrUndefined(config?.firstDisappearAfterInactivityMs) ??
        DEFAULT_SCROLL_HINT_CONFIGURATION.firstDisappearAfterInactivityMs,
    secondAppearAfterInactivityMs:
        numberOrUndefined(config?.secondAppearAfterInactivityMs) ??
        DEFAULT_SCROLL_HINT_CONFIGURATION.secondAppearAfterInactivityMs,
    secondDisappearAfterInactivityMs:
        numberOrUndefined(config?.secondDisappearAfterInactivityMs) ??
        DEFAULT_SCROLL_HINT_CONFIGURATION.secondDisappearAfterInactivityMs,
});

function numberOrUndefined(something: unknown): number | undefined {
    if (something == null) return undefined;
    const parsed = parseInt(`${something}`);
    if (isNaN(parsed)) return undefined;
    return parsed;
}

const getFromLocalStorage = (): HintState | undefined => {
    const localHintState = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (localHintState == null) return undefined;
    const validHintStates = Object.keys(HintState).filter(x => typeof x === "string");
    return validHintStates.includes(localHintState) ? HintState[localHintState] : undefined;
}

const saveToLocalStorage = (state: HintState) => {
    localStorage.setItem(LOCAL_STORAGE_KEY, state);
};

