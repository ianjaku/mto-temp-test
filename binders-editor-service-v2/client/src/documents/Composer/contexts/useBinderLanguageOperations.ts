import { IBinderLanguageProps, IModuleSet } from "../components/BinderLanguage/types";
import {
    IBinderUpdate,
    addChecklistItem,
    deleteChunk,
    detachVisual,
    injectChunk,
    mergeChunks,
    resetThumbnail,
    setChunkText,
    setTitle,
    translate,
    translateTitle
} from "../helpers/binderUpdates";
import { findApproval, getBinderLogEntry } from "../helpers/approvalHelper";
import { generateHTML, generateJSON } from "@tiptap/core";
import { useCallback, useState } from "react";
import { ApprovedStatus } from "@binders/client/lib/clients/repositoryservice/v3/contract";
import Binder from "@binders/client/lib/binders/custom/class";
import { BinderLanguageComputedProperties } from "./useBinderLanguageProperties";
import { ChunkOperation } from "../components/BinderLanguage/ChunkControls/contract";
import { EditorState } from "draft-js";
import { FEATURE_APPROVAL_FLOW } from "@binders/client/lib/clients/accountservice/v1/contract";
import { KEY_BINDER_IS_SAVING } from "../../store";
import { LDFlags } from "@binders/client/lib/launchdarkly";
import {
    LaunchDarklyFlagsStoreGetters
} from "@binders/ui-kit/lib/thirdparty/launchdarkly/ld-flags-store";
import RTEState from "@binders/client/lib/draftjs/state";
import { TipTapExtensions } from "../components/BinderLanguage/TextEditor/TextEditor";
import { dispatch } from "@binders/client/lib/react/flux/dispatcher";
import { invalidateCommentThreads } from "../../hooks";
import { onUploadVisualFiles } from "../helpers/upload";
import { safeJsonParse } from "@binders/client/lib/util/json";
import { updateChunkApproval } from "../../actions";
import { useComposerProps } from "./composerPropsContext";

export type BinderLanguageOperations = {
    allowMachineTranslation: boolean;
    buildOnTranslate: (
        moduleSet: IModuleSet,
        opposingModuleSet: IModuleSet,
        chunkIndex: number,
        translatorLanguageCodes: string[],
    ) => () => Promise<void>;
    isTranslating: number;
    onChunkOperation: (
        chunkIndex: number,
        operation: number,
        isSecondary?: boolean,
        isEmptyChunk?: boolean,
    ) => Promise<void>;
    onDetachVisual: (chunkIndex: number, visualIndex: number) => void;
    onTitleBlur: () => void;
    onUpdateChunkText: (
        newValue: EditorState,
        json: string | undefined,
        html: string | undefined,
        metaKey: string,
        chunkIndex: number,
        bumpContentVersion?: boolean,
        postBinderAction?: (binder: Binder) => Promise<void>,
    ) => void;
    onUpdateTitle: (
        title: string,
        json: string | undefined,
        html: string | undefined,
        languageCode: string
    ) => void;
    onVisualUpload: (
        chunkIndex: number,
        visualFiles: File[],
        visualIndex?: number,
        bypassNewChunk?: false,
    ) => Promise<void>;
    resetApprovalFn: (() => void) | boolean;
    setAllowMachineTranslation: (val: boolean) => void;
    setIsTitleMirroringMode: (val: boolean) => void;
}

export function useBinderLanguageOperations(
    props: IBinderLanguageProps,
    computed: BinderLanguageComputedProperties,
): BinderLanguageOperations {
    const {
        accountFeatures,
        commentThreads,
        onBinderUpdate,
    } = useComposerProps();

    const {
        binder,
        languageCode,
        opposingLanguageCode,
    } = props

    const {
        accountId,
        checklistConfigs,
        chunkApprovals,
        chunkCount,
        isTitleVisualMirroringMode,
        moduleSets,
    } = computed;

    const [allowMachineTranslation, setAllowMachineTranslation] = useState<boolean | undefined>(undefined);
    const [isTitleMirroringMode, setIsTitleMirroringMode] = useState(undefined);
    const [isTranslating, setIsTranslating] = useState<number | undefined>(undefined);
    const buildOnTranslate = useCallback((moduleSet: IModuleSet, opposingModuleSet: IModuleSet, chunkIndex: number, translatorLanguageCodes: string[]) => {
        return async () => {
            dispatch({
                type: KEY_BINDER_IS_SAVING,
            });
            setIsTranslating(chunkIndex);
            let [langcode, opposingLangCode] = [languageCode, opposingLanguageCode];
            if (translatorLanguageCodes) {
                [moduleSet, opposingModuleSet] = [opposingModuleSet, moduleSet];
                [langcode, opposingLangCode] = [opposingLanguageCode, languageCode];
            }
            let binderUpdate;
            if (chunkIndex === 0) {
                binderUpdate = await translateTitle(accountId, moduleSet.text.data[0][0], langcode, opposingLangCode);
            } else {

                const shouldUseNewTextEditor = LaunchDarklyFlagsStoreGetters.getLaunchDarklyFlags()[LDFlags.USE_TIP_TAP] as boolean;

                const htmlFrom = shouldUseNewTextEditor && moduleSet.text?.json?.trim().length ?
                    generateHTML(safeJsonParse(moduleSet.text.json), TipTapExtensions) :
                    RTEState.toHTML(moduleSet.text.state);

                binderUpdate = await translate(
                    accountId,
                    htmlFrom,
                    langcode,
                    opposingLangCode,
                    opposingModuleSet.text.meta.key,
                    chunkIndex - 1,
                );
            }
            setIsTranslating(undefined);
            onBinderUpdate(binderUpdate);
        }
    }, [languageCode, opposingLanguageCode, onBinderUpdate, accountId]);

    const onChunkOperation = useCallback(async (
        chunkIndex: number,
        operation: number,
        isSecondary?: boolean,
        isEmptyChunk = false,
    ) => {
        let binderUpdate: IBinderUpdate;
        let affectsCommentThreads = false;
        switch (operation) {
            case ChunkOperation.add:
                binderUpdate = injectChunk(chunkIndex - 1, chunkIndex, isSecondary);
                break;
            case ChunkOperation.merge: {
                binderUpdate = await mergeChunks(chunkIndex, chunkApprovals, moduleSets, accountId, checklistConfigs, isSecondary);
                affectsCommentThreads = true;
                break;
            }
            case ChunkOperation.delete: {
                binderUpdate = await deleteChunk(chunkIndex, chunkApprovals, moduleSets, accountId, checklistConfigs, commentThreads, isSecondary);
                affectsCommentThreads = true;
                break;
            }
            case ChunkOperation.checklistItem:
                binderUpdate = await addChecklistItem(chunkIndex);
                break;
            default:
                break;
        }
        binderUpdate.updateBinderOptions = {
            ...binderUpdate.updateBinderOptions,
            isEmptyChunk,
            ...(affectsCommentThreads ?
                {
                    postBinderSaveCallback: () => {
                        invalidateCommentThreads(binder.id);
                    }
                } :
                {}),
        };
        onBinderUpdate(binderUpdate);
    }, [binder, onBinderUpdate, accountId, moduleSets, chunkApprovals, checklistConfigs, commentThreads]);

    const onDetachVisual = useCallback((chunkIndex: number, visualIndex: number) => {
        const updatedBinder = chunkIndex === 0 ?
            resetThumbnail() :
            detachVisual(chunkIndex, visualIndex);
        onBinderUpdate(updatedBinder);
    }, [onBinderUpdate]);

    const featuresApprovalFlow = accountFeatures.includes(FEATURE_APPROVAL_FLOW);
    const [resetApprovalFn, setResetApprovalFn] = useState<(() => void) | boolean>(false);

    const resetApprovalsOnChunk = useCallback((chunkIndex: number) => {
        if (!featuresApprovalFlow || resetApprovalFn !== false) {
            return;
        }
        const binderObj = binder.toJSON();
        const log = chunkIndex >= 0 && getBinderLogEntry(binder, chunkIndex);
        const approval = findApproval(chunkApprovals, log, languageCode, chunkIndex === -1 && binderObj.id);
        if (approval && approval.approved !== ApprovedStatus.UNKNOWN) {
            const updateApproval = async () => {
                const binderId = binder.toJSON().id;
                await updateChunkApproval(
                    binderId,
                    log ? log.uuid : binderId,
                    languageCode,
                    log ? log.updatedAt : Date.now(),
                    ApprovedStatus.UNKNOWN,
                );
                setResetApprovalFn(false);
            };
            if (resetApprovalFn === false) {
                setResetApprovalFn(updateApproval);
            }
        }
    }, [binder, chunkApprovals, languageCode, resetApprovalFn, setResetApprovalFn, featuresApprovalFlow]);

    const onTitleBlur = useCallback(() => {
        if (isTitleMirroringMode) {
            setIsTitleMirroringMode(false);
        }
    }, [isTitleMirroringMode]);

    const onUpdateChunkText = useCallback((editorState: EditorState, json: string | undefined, html: string | undefined, metaKey: string, chunkIndex: number, bumpContentVersion?: boolean, postBinderAction?: (binder: Binder) => Promise<void>) => {
        const binderUpdate = setChunkText(editorState, json, html, metaKey, chunkIndex, bumpContentVersion, postBinderAction);
        onBinderUpdate(binderUpdate);
        resetApprovalsOnChunk(chunkIndex);
    }, [onBinderUpdate, resetApprovalsOnChunk]);

    const onUpdateTitle = useCallback((title: string, _json: undefined, _html: undefined, languageCode: string) => {
        const updatedBinder = setTitle(title, languageCode);
        onBinderUpdate(updatedBinder);
        resetApprovalsOnChunk(-1);
        if (isTitleMirroringMode) {
            const newState: EditorState = RTEState.createFromHtml(`<h1>${title}</h1>`);
            const shouldUseNewTextEditor = LaunchDarklyFlagsStoreGetters.getLaunchDarklyFlags()[LDFlags.USE_TIP_TAP];
            const json = shouldUseNewTextEditor ? JSON.stringify(generateJSON(`<h1>${title}</h1>`, TipTapExtensions)) : undefined;
            onUpdateChunkText(newState, json, undefined, moduleSets[0].text.meta.key, 0, true, updatedBinder.updateBinderOptions.postBinderAction);
        }
    }, [onBinderUpdate, resetApprovalsOnChunk, isTitleMirroringMode, moduleSets, onUpdateChunkText]);

    const onVisualUpload = useCallback(async (
        chunkIndex: number,
        visualFiles: File[],
        visualIndex?: number,
        bypassNewChunk = false,
    ) => {
        dispatch({
            type: KEY_BINDER_IS_SAVING,
        });
        const positions = [{ chunkIndex, visualIndex }];
        if (chunkIndex === 0 && isTitleVisualMirroringMode) {
            positions.push({ chunkIndex: 1, visualIndex: 0 });
        }
        const updateNewChunk = !bypassNewChunk ? (chunkIndex > chunkCount) : false;
        const patch = await onUploadVisualFiles(binder, visualFiles, positions, chunkCount, accountId, updateNewChunk);
        if (patch) {
            onBinderUpdate({
                patches: [() => patch],
                updateBinderOptions: {
                    bumpContentVersion: true,
                    affectsVisuals: true,
                    proposedApprovalResetChunks: [chunkIndex - 1],
                },
            });
        }
    }, [binder, chunkCount, onBinderUpdate, isTitleVisualMirroringMode, accountId]);

    return {
        allowMachineTranslation,
        buildOnTranslate,
        isTranslating,
        onChunkOperation,
        onDetachVisual,
        onTitleBlur,
        onUpdateChunkText,
        onUpdateTitle,
        onVisualUpload,
        resetApprovalFn,
        setAllowMachineTranslation,
        setIsTitleMirroringMode,
    }
}
