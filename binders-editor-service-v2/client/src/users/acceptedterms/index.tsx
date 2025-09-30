import * as React from "react";
import { IWebData, WebDataState } from "@binders/client/lib/webdata";
import AcceptedTermsCheck from "@binders/ui-kit/lib/compounds/acceptedtermscheck";
import AccountStore from "../../accounts/store";
import {
    FEATURE_TERMS_AND_CONDITIONS
} from "@binders/client/lib/clients/accountservice/v1/contract";
import { useFluxStoreAsAny } from "@binders/client/lib/react/helpers/hooks";
import { useMyDetails } from "../hooks";
import { useSaveTermsAcceptance } from "../query";

const { useCallback, useMemo } = React;
interface IProps {
    children: React.ReactElement;
}

const AcceptedTerms: React.FC<IProps> = ({ children }) => {
    const activeAccountId: string = useFluxStoreAsAny(AccountStore, (_prevState, store) => store.getActiveAccountId());
    const accountFeaturesWD: IWebData<string[]> = useFluxStoreAsAny(AccountStore, (_prevState, store) => store.getAccountFeatures());
    const myDetails = useMyDetails();
    const saveTermsAcceptance = useSaveTermsAcceptance();
    const [userId, termsToAccept] = useMemo(
        () => myDetails ?
            [myDetails?.user?.id, myDetails?.termsToAccept ?? {}] :
            [undefined, {}],
        [myDetails]
    );

    const includesFeature = useMemo(
        () => accountFeaturesWD.state === WebDataState.SUCCESS && accountFeaturesWD.data.includes(FEATURE_TERMS_AND_CONDITIONS),
        [accountFeaturesWD]
    );

    const maybeRenderTermsCheck = useCallback(() => {
        if (!includesFeature) {
            return children;
        }
        return (
            <AcceptedTermsCheck
                userId={userId}
                termsToAccept={termsToAccept}
                accountId={activeAccountId}
                onAccept={async (userId, accountId, version) => saveTermsAcceptance.mutate({ userId, accountId, version })}
            >
                {children}
            </AcceptedTermsCheck>
        )
    }, [activeAccountId, children, includesFeature, saveTermsAcceptance, termsToAccept, userId]);

    return maybeRenderTermsCheck();
}

export default AcceptedTerms;
