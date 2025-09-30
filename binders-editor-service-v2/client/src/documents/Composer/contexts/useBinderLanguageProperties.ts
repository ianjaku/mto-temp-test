import { IBinderLanguageProps, IModuleSet } from "../components/BinderLanguage/types";
import {
    IChecklistConfig,
    IChunkApproval
} from "@binders/client/lib/clients/repositoryservice/v3/contract";
import { WebData, WebDataState } from "@binders/client/lib/webdata";
import AccountStore from "../../../accounts/store";
import BinderStore from "../../store";
import { buildDocumentInfo } from "../helpers/binder";
import { useChunkApprovalContext } from "./chunkApprovalsContext";
import { useComposerContext } from "./composerContext";
import { useComposerProps } from "./composerPropsContext";
import { useFluxStoreAsAny } from "@binders/client/lib/react/helpers/hooks";
import { useMemo } from "react";

export type BinderLanguageComputedProperties = {
    accountId: string;
    checklistConfigs: IChecklistConfig[];
    chunk1EqualsTitle: boolean;
    chunkApprovals: IChunkApproval[];
    chunkCount: number;
    hasHorizontalVisuals: boolean;
    horizontalVisuals: "horizontal" | "vertical";
    isActiveVersion: number;
    isDisabled: boolean;
    isNewDocumentView: boolean;
    isTitleVisualMirroringMode: boolean;
    langIdx: number;
    moduleSets: IModuleSet[],
    opposingChunk1EqualsTitle: boolean;
    opposingModuleSets: IModuleSet[];
    opposingTitleModuleSet: IModuleSet;
    titleModuleSet: IModuleSet;
}

export function useBinderLanguageProperties(props: IBinderLanguageProps): BinderLanguageComputedProperties {
    const { isDisabledView, selectedChunkDetails } = useComposerProps();
    const {
        binder,
        isPrimary,
        languageCode,
        opposingLanguageCode,
        readonlyMode,
    } = props;

    const documentInfo = useMemo(() => buildDocumentInfo(binder, languageCode), [binder, languageCode]);
    const { moduleSets, chunk1EqualsTitle, documentHasVisuals, titleModuleSet } = documentInfo;
    const opposingDocumentInfo = useMemo(() => buildDocumentInfo(binder, opposingLanguageCode), [binder, opposingLanguageCode]);
    const { titleModuleSet: opposingTitleModuleSet, isEmptyDocument } = opposingDocumentInfo;

    const chunkCount = useMemo(() => moduleSets.length, [moduleSets]);

    const { hasHorizontalVisuals } = useComposerContext();
    const isActiveVersion = selectedChunkDetails.isPrimary === isPrimary && selectedChunkDetails.index === 0 && 1;
    const { moduleSets: opposingModuleSets, chunk1EqualsTitle: opposingChunk1EqualsTitle } = opposingDocumentInfo;

    const isNewDocumentView = useMemo(() => !!(isEmptyDocument && moduleSets.length), [isEmptyDocument, moduleSets]);

    const { chunkApprovals } = useChunkApprovalContext();

    const accountId: string = useFluxStoreAsAny(AccountStore, (_prevState, store) => store.getActiveAccountId());
    const checklistConfigsWD: WebData<IChecklistConfig[]> = useFluxStoreAsAny(BinderStore, (_prevState, store) => store.getChecklistConfigs());
    const checklistConfigs: IChecklistConfig[] = useMemo(() => checklistConfigsWD?.state === WebDataState.SUCCESS && checklistConfigsWD.data, [checklistConfigsWD]);

    const horizontalVisuals = hasHorizontalVisuals ? "horizontal" : "vertical" as const;

    const isTitleVisualMirroringMode = !documentHasVisuals && chunk1EqualsTitle;

    const isDisabled = isNewDocumentView || readonlyMode || isDisabledView;

    const langIdx = useMemo(
        () => binder.getLanguageIndex(languageCode ?? "xx") ?? -1,
        [binder, languageCode],
    );

    return {
        accountId,
        checklistConfigs,
        chunk1EqualsTitle,
        chunkApprovals,
        chunkCount,
        hasHorizontalVisuals,
        horizontalVisuals,
        isActiveVersion,
        isDisabled,
        isNewDocumentView,
        isTitleVisualMirroringMode,
        langIdx,
        moduleSets,
        opposingChunk1EqualsTitle,
        opposingModuleSets,
        opposingTitleModuleSet,
        titleModuleSet,
    }
}
