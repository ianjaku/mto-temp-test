import * as React from "react";
import Binder from "@binders/client/lib/binders/custom/class";
import { SelectedChunkDetails } from "../BinderLanguage/Chunk";
import { buildDocumentInfo } from "../../helpers/binder";
import { useActiveAccountId } from "../../../../accounts/hooks";
import { useCurrentUserId } from "../../../../users/hooks";

const { createContext, useContext, useMemo } = React;

type CommentContext = {
    accountId?: string;
    binderId?: string;
    selectedChunkId?: string;
    historicalChunkIds?: Set<string>;
    selectedLanguageCode?: string;
    userId?: string;
    selectedChunkIndex?: number;
}

const context = createContext<CommentContext>({});

export type CommentContextProviderProps = {
    binder: Binder;
    selectedChunkDetails: SelectedChunkDetails;
    primaryLanguageCode: string;
    secondaryLanguageCode?: string;
}

export const CommentContextProvider: React.FC<React.PropsWithChildren<CommentContextProviderProps>> = (props) => {
    const accountId = useActiveAccountId();
    const userId = useCurrentUserId();
    const { binder, selectedChunkDetails, primaryLanguageCode, secondaryLanguageCode } = props;

    let selectedLanguageCode: string;
    if (selectedChunkDetails) {
        selectedLanguageCode = selectedChunkDetails.isPrimary ? primaryLanguageCode : secondaryLanguageCode;
    } else {
        selectedLanguageCode = primaryLanguageCode;
    }

    const docInfo = useMemo(() => buildDocumentInfo(binder, selectedLanguageCode), [binder, selectedLanguageCode]);
    const selectedChunkIndex = selectedChunkDetails.index;
    let selectedChunkId: string | undefined;
    if (selectedChunkIndex < 0) {
        selectedChunkId = undefined;
    } else if (selectedChunkIndex === 0) {
        selectedChunkId = "title";
    } else {
        selectedChunkId = docInfo.moduleSets[selectedChunkIndex - 1]?.uuid;
    }

    const historicalChunkIds = React.useMemo(() => {
        const chunkCurrentPositionLog = binder.getChunkCurrentPositionLog(selectedChunkId);
        return new Set(chunkCurrentPositionLog?.targetId ?? []);
    }, [binder, selectedChunkId]);
    return (
        <context.Provider
            value={{
                accountId,
                binderId: binder.id,
                selectedChunkId,
                selectedLanguageCode,
                userId,
                historicalChunkIds,
                selectedChunkIndex,
            }}
        >
            {props.children}
        </context.Provider>
    )
}

export const useCommentContext = (): CommentContext => {
    const ctx = useContext(context);
    if (!ctx.accountId || !ctx.binderId) {
        throw new Error("useCommentContext was used, but CommentContextProvider was not initialized. Make sure it exists in the hierarchy above and all properties are set");
    }
    return ctx;
}

