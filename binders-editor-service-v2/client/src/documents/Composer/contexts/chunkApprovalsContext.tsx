import * as React from "react";
import {
    ApprovedStatus,
    IChunkApproval
} from  "@binders/client/lib/clients/repositoryservice/v3/contract";
import { IWebData, WebDataState } from "@binders/client/lib/webdata";
import AccountStore from "../../../accounts/store";
import Binder from "@binders/client/lib/binders/custom/class";
import BinderStore from "../../store";
import { FEATURE_APPROVAL_FLOW } from "@binders/client/lib/clients/accountservice/v1/contract";
import { hasEmptyChunks as checkEmptyChunks } from "../helpers/binder";
import { fetchChunkApprovals } from "../../actions";
import { useFluxStoreAsAny } from "@binders/client/lib/react/helpers/hooks";

const { useCallback, useContext, useEffect, useMemo, useState } = React;

type ChunkApprovalContextType = {
    chunkApprovals: IChunkApproval[];
    isLanguageApproved: (languageCode: string) => boolean;
    hasEmptyChunks: (l: string) => boolean;
}

// eslint-disable-next-line no-mixed-operators
export const ChunkApprovalContext = React.createContext<ChunkApprovalContextType>({
    chunkApprovals: [],
    isLanguageApproved: () => false,
    hasEmptyChunks: () => true,
});

type Props = {
    binder: Binder;
    children: React.ReactElement;
};

export const ChunkApprovalContextProvider: React.FC<Props> = ({ binder, children }: Props) => {
    const [chunkApprovals, setChunkApprovals] = useState([]);
    const accountFeatures: IWebData<string[]> = useFluxStoreAsAny(AccountStore, (_prevState, store) => store.getAccountFeatures());

    const hasEmptyChunks = useCallback(
        (languageCode) => checkEmptyChunks(binder, languageCode),
        [binder]
    );

    const featuresApprovalFlow = useMemo(() => accountFeatures?.data.includes(FEATURE_APPROVAL_FLOW), [accountFeatures]);

    const binderId = useMemo(() => binder.toJSON().id, [binder]);

    const getChunkCount = useCallback((languageCode: string) => {
        const keys = binder.getModulePairByLanguage(languageCode);
        if (keys.length === 0) {
            return 0;
        }
        const [textsModules] = keys.map(key => binder.getModuleByKey(key));
        return textsModules.data.length
    }, [binder]);

    const chunkApprovalsWD: IWebData<IChunkApproval[]> = useFluxStoreAsAny(
        BinderStore,
        (_prevState, store) => store.getChunkApprovals(),
    );

    useEffect(() => {
        if (featuresApprovalFlow) {
            fetchChunkApprovals(binderId);
        }
    }, [binderId, featuresApprovalFlow]);

    useEffect(() => {
        if (chunkApprovalsWD.state === WebDataState.SUCCESS) {
            setChunkApprovals(chunkApprovalsWD.data);
        }
    }, [chunkApprovalsWD]);

    const isLanguageApproved = useCallback((languageCode: string) => {
        const uids = binder.getBinderLog().current.map(l => l.uuid);
        const uniqueApprovals = chunkApprovals
            .filter(app => app.chunkLanguageCode === languageCode)
            .filter(app => uids.indexOf(app.chunkId) > -1 || app.chunkId === binderId);
        const chunkCount = getChunkCount(languageCode);
        return (uniqueApprovals.length === Math.max(chunkCount + 1, 2)) && uniqueApprovals.every(
            app => app.approved === ApprovedStatus.APPROVED,
        ) && !hasEmptyChunks(languageCode);
    }, [binder, binderId, chunkApprovals, getChunkCount, hasEmptyChunks]);

    if (!featuresApprovalFlow) {
        return children;
    }

    return (
        <ChunkApprovalContext.Provider value={{ chunkApprovals, isLanguageApproved, hasEmptyChunks }}>
            {children}
        </ChunkApprovalContext.Provider>
    );
}

export const useChunkApprovalContext = (): ChunkApprovalContextType => useContext(ChunkApprovalContext);
