import * as React from "react";
import { ChunkLoadingState, ChunkState, ChunkStateContextProvider } from "./chunkStateContext";
import { FC, ReactNode, useCallback, useContext, useMemo } from "react";
import {
    FEATURE_BLOCK_CHECKLIST_PROGRESS,
    FEATURE_COMMENTING_IN_EDITOR,
} from "@binders/client/lib/clients/accountservice/v1/contract";
import { ImageModule, TextModule } from "@binders/client/lib/binders/custom/class";
import { ChunkApprovalContextProvider } from "./chunkApprovalsContext";
import { EditorState } from "draft-js";
import { IComposerProps } from "../composer";
import { LDFlags } from "@binders/client/lib/launchdarkly/flags";
import RTEState from "@binders/client/lib/draftjs/state";
import { SelectFileProvider } from "../../../media/SelectFileProvider";
import { buildLink } from "@binders/client/lib/binders/readerPath";
import { buildTranslatorLanguageCodes } from "../helpers/authorization";
import { getDocumentPath } from "../../actions";
import { getReaderLocation } from "@binders/client/lib/util/domains";
import { isSemanticallyEmptyJsonChunkSerialized } from "../../helper";
import { setBypassChecklistBlockCookie } from "@binders/client/lib/util/cookie";
import { toTitlePath } from "../../../browsing/helper";
import { useLaunchDarklyFlagValue } from "@binders/ui-kit/lib/thirdparty/launchdarkly/hooks";
import { withProtocol } from "@binders/client/lib/util/uri";

type ComposerPropsContextType = {
    props: IComposerProps;
    computed: ComposerComputedProps;
}

const ComposerPropsContext = React.createContext<ComposerPropsContextType>({
    props: {} as IComposerProps,
    computed: {} as ComposerComputedProps,
});

export type ComposerComputedProps = {
    openReaderWindow: (langCode: string, hasDraft: boolean) => void;
    publicationLocations: string[];
    shouldRenderEmptyChunk: boolean;
    showComments: boolean;
    translatorLanguageCodes: string[];
}

export const ComposerPropsContextProvider: FC<{
    children: ReactNode;
    props: IComposerProps;
}> = ({
    children,
    props,
}) => {
    const computed = useBuildComposerComputedProps(props);
    const chunkIds = props.binder.getBinderLog().current.map(c => c.uuid);
    const initialChunkStates = useMemo(
        () => new Array<ChunkState>(chunkIds.length + 1).fill({ loadingState: ChunkLoadingState.Loaded }),
        [chunkIds.length],
    );
    return (
        <ChunkStateContextProvider chunkStates={initialChunkStates}>
            <ChunkApprovalContextProvider binder={props.binder}>
                <SelectFileProvider>
                    <ComposerPropsContext.Provider value={{
                        computed,
                        props,
                    }}>
                        {children}
                    </ComposerPropsContext.Provider>
                </SelectFileProvider>
            </ChunkApprovalContextProvider>
        </ChunkStateContextProvider>
    );
}

export const useComposerProps = (): IComposerProps => {
    const { props } = useComposerContext();
    return props;
}

export const useComposerComputedProps = (): ComposerComputedProps => {
    const { computed } = useComposerContext();
    return computed;
}

const useComposerContext = (): ComposerPropsContextType =>
    useContext(ComposerPropsContext);

const useBuildComposerComputedProps = (props: IComposerProps): ComposerComputedProps => {
    const {
        accountFeatures,
        binder,
        breadcrumbsPaths,
        domain,
        isDisabledView,
        permissionFlags,
        primaryLanguageCode,
        secondaryLanguageCode,
        semanticLinks,
    } = props;
    const translatorLanguageCodes = useMemo(
        () => buildTranslatorLanguageCodes(permissionFlags),
        [permissionFlags],
    );

    const publicationLocations = useMemo(() => {
        const publicationLocationItems = breadcrumbsPaths ? breadcrumbsPaths.map(bcp => bcp.slice(0, bcp.length - 1)) : [];
        return publicationLocationItems.map(toTitlePath);
    }, [breadcrumbsPaths]);

    const openReaderWindow = useCallback((languageCode: string, hasDraft: boolean) => {
        const path = getDocumentPath(breadcrumbsPaths);
        if (accountFeatures.includes(FEATURE_BLOCK_CHECKLIST_PROGRESS)) {
            setBypassChecklistBlockCookie();
        }
        const config = {
            domain,
            isCollection: false,
            isDraft: hasDraft,
            itemId: binder["id"],
            lang: languageCode,
            parentCollections: path,
            readerLocation: getReaderLocation(domain),
            semanticLinks: hasDraft ? [] : semanticLinks,
        };
        const link = buildLink(config);
        const win = window.open(withProtocol(link), "_blank");
        win.focus();
    }, [accountFeatures, binder, breadcrumbsPaths, domain, semanticLinks]);

    const shouldUseNewTextEditor = useLaunchDarklyFlagValue(LDFlags.USE_TIP_TAP) ?? false;
    const shouldRenderEmptyChunk = useMemo(() => {
        if (!primaryLanguageCode || isDisabledView) {
            return false;
        }

        const keysPrimary = binder.getModulePairByLanguage(primaryLanguageCode);
        if (keysPrimary.length === 0) {
            return false;
        }
        const [primaryTexts, primaryImages] = keysPrimary.map(key => binder.getModuleByKey(key)) as [TextModule, ImageModule];
        const chunkCount = primaryTexts?.data?.length ?? 0;
        const lastPrimaryChunk = shouldUseNewTextEditor ? primaryTexts?.json?.at(-1) : primaryTexts?.states?.at(-1);
        const lastPrimaryImages = primaryImages?.data?.[chunkCount - 1] ?? [];
        const isLastPrimaryChunkSemanticallyEmpty = (
            shouldUseNewTextEditor ?
                isSemanticallyEmptyJsonChunkSerialized(lastPrimaryChunk) :
                RTEState.isSemanticallyEmpty(lastPrimaryChunk as unknown as EditorState)
        );
        const areLastPrimaryImagesEmpty = lastPrimaryImages.length === 0;

        // if only one language on screen
        if (!secondaryLanguageCode) {
            const isLastChunkEmpty = isLastPrimaryChunkSemanticallyEmpty && areLastPrimaryImagesEmpty;
            return !isLastChunkEmpty;
        }

        // if secondary language visible - we need to check both
        const keysSecondary = binder.getModulePairByLanguage(secondaryLanguageCode);
        const [secondaryTexts, secondaryImages] = keysSecondary.map(key => binder.getModuleByKey(key)) as [TextModule, ImageModule];
        const lastSecondaryChunk = shouldUseNewTextEditor ? secondaryTexts?.json?.at(-1) : secondaryTexts?.states?.at(-1);
        const lastSecondaryImages = secondaryImages?.data?.[chunkCount - 1] ?? [];
        const isLastSecondaryChunkSemanticallyEmpty = lastSecondaryChunk && (
            shouldUseNewTextEditor ?
                isSemanticallyEmptyJsonChunkSerialized(lastSecondaryChunk) :
                RTEState.isSemanticallyEmpty(lastSecondaryChunk as unknown as EditorState)
        );
        const areLastSecondaryImagesEmpty = lastSecondaryImages.length === 0;

        const primaryAndSecondaryLastChunkEmpty = isLastPrimaryChunkSemanticallyEmpty && isLastSecondaryChunkSemanticallyEmpty;
        const primaryAndSecondaryLastImageEmpty = areLastPrimaryImagesEmpty && areLastSecondaryImagesEmpty;

        const isLastChunkEmpty = primaryAndSecondaryLastChunkEmpty && primaryAndSecondaryLastImageEmpty;
        return !isLastChunkEmpty;
    }, [binder, isDisabledView, primaryLanguageCode, secondaryLanguageCode, shouldUseNewTextEditor]);

    const showComments = accountFeatures.includes(FEATURE_COMMENTING_IN_EDITOR);

    return {
        openReaderWindow,
        publicationLocations,
        shouldRenderEmptyChunk,
        showComments,
        translatorLanguageCodes,
    }
}
