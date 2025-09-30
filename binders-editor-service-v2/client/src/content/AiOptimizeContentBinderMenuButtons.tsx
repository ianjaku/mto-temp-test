import * as React from "react";
import {
    ChunkLoadingState,
    useAllChunksState
} from "../documents/Composer/contexts/chunkStateContext";
import { FC, useCallback, useMemo, useState } from "react";
import {
    captureEventOptimizeBinderButtonClicked,
    captureEventOptimizeBinderButtonClickedAgain,
    captureEventOptimizeBinderFailed,
    captureEventOptimizeBinderStarted
} from "./events";
import { useActiveAccountFeatures, useActiveAccountId } from "../accounts/hooks";
import { useEventBinderContextProps, useEventBinderDiffProps, useOptimizeBinder } from "./hooks";
import { AiFormatIcon } from "@binders/ui-kit/lib/elements/icons/AiFormat";
import BinderClass from "@binders/client/lib/binders/custom/class";
import DonutLargeIcon from "@binders/ui-kit/lib/elements/icons/DonutLarge";
import {
    FEATURE_AI_CONTENT_FORMATTING as FEATURE_AI_CONTENT_OPTIMIZATION
} from "@binders/client/lib/clients/accountservice/v1/contract";
import { FlashMessages } from "../logging/FlashMessages";
import { LDFlags } from "@binders/client/lib/launchdarkly";
import {
    OptimizeChunkContentResponse
} from "@binders/client/lib/clients/contentservice/v1/contract";
import { TranslationKeys as TK } from "@binders/client/lib/react/i18n/translations";
import cx from "classnames";
import { isMobileView } from "@binders/ui-kit/lib/helpers/rwd";
import { useBinderDiff } from "./BinderDiffProvider";
import { useLaunchDarklyFlagValue } from "@binders/ui-kit/lib/thirdparty/launchdarkly/hooks";
import { useTranslation } from "@binders/client/lib/react/i18n";
import "./styles.styl";

export const AiOptimizeContentBinderMenuButtons: FC<{
    binderObj: BinderClass;
    langIdx: number;
}> = ({ binderObj, langIdx }) => {
    const { t } = useTranslation();
    const accountId = useActiveAccountId();
    const binderId = binderObj.id;
    const { binderDiff, setBinderDiff, resetChunkDiffStates } = useBinderDiff();
    const { setChunksStates } = useAllChunksState();
    const [isDisabled, setIsDisabled] = useState(false);

    const eventBinderContextProps = useEventBinderContextProps({ binder: binderObj, langIdx });
    const eventBinderOptimizationProps = useEventBinderDiffProps({ langIdx });
    const eventContext = useMemo(() => ({
        ...eventBinderContextProps,
        ...eventBinderOptimizationProps,
    }), [eventBinderContextProps, eventBinderOptimizationProps]);

    const onError = useCallback((errorMsgKey) => {
        setChunksStates({
            hasAiFormattingState: false,
            isReadOnly: false,
            loadingState: ChunkLoadingState.Loaded,
        });
        setIsDisabled(false);
        captureEventOptimizeBinderFailed(eventContext);
        FlashMessages.error(t(errorMsgKey), true);
    }, [eventContext, setChunksStates, t])

    const onSuccess = useCallback(
        ({ binder }: OptimizeChunkContentResponse) => {
            setBinderDiff(binder);
            captureEventOptimizeBinderStarted(eventBinderContextProps);
            setChunksStates({
                hasAiFormattingState: true,
                isReadOnly: false,
                loadingState: ChunkLoadingState.Loaded,
            });
            setIsDisabled(false);
        },
        [eventBinderContextProps, setChunksStates, setBinderDiff],
    );

    const optimizeBinder = useOptimizeBinder({
        binderId,
        langIdx: 0,
        accountId,
    }, { onError, onSuccess });

    const doOptimizeBinder = useCallback(
        () => {
            if (isDisabled) return;
            setIsDisabled(true);
            resetChunkDiffStates();
            setChunksStates({
                hasAiFormattingState: false,
                isReadOnly: true,
                loadingState: ChunkLoadingState.Loaded,
            });
            optimizeBinder.mutate({
                binderId,
                langIdx,
                accountId,
                save: false,
            });
            if (binderDiff) {
                captureEventOptimizeBinderButtonClickedAgain(eventContext);
            } else {
                captureEventOptimizeBinderButtonClicked(eventBinderContextProps);
            }
        },
        [accountId, binderDiff, binderId, eventBinderContextProps, eventContext, isDisabled, langIdx, optimizeBinder, resetChunkDiffStates, setChunksStates],
    );

    const features = useActiveAccountFeatures();
    const isLDEnabled = useLaunchDarklyFlagValue<boolean>(LDFlags.AI_CONTENT_OPTIMIZATION);
    if (!isLDEnabled || !features.includes(FEATURE_AI_CONTENT_OPTIMIZATION)) return null;
    if (isMobileView()) return null;

    return (
        <button
            className={cx(
                "ai-optimize-binder-btn",
                "transition-colors",
                { "disabled": isDisabled },
            )}
            onClick={doOptimizeBinder}
        >
            {isDisabled ? <div className="loading"><DonutLargeIcon /></div> : <AiFormatIcon />}
            <span>{isDisabled ? t(TK.Edit_AiOptimizeDocumentLoading) : t(TK.Edit_AiOptimizeDocument)}</span>
        </button>
    )
}
