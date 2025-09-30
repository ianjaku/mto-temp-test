import * as React from "react";
import { APISaveTermsAcceptance } from "./api";
import AcceptedTermsCheck from "@binders/ui-kit/lib/compounds/acceptedtermscheck";
import {
    FEATURE_TERMS_AND_CONDITIONS
} from "@binders/client/lib/clients/accountservice/v1/contract";
import { UserDetails } from "@binders/client/lib/clients/userservice/v1/contract";
import { useActiveAccountId } from "../../stores/hooks/account-hooks";

const { useCallback, useMemo } = React;

interface IProps {
    children: React.ReactElement;
    userDetails: UserDetails;
    accountFeatures: string[];
    onAccept: () => void;
}

const AcceptedTerms: React.FC<IProps> = ({
    children,
    userDetails,
    accountFeatures,
    onAccept,
}) => {

    const activeAccountId = useActiveAccountId();

    const [userId, termsToAccept] = useMemo(
        () => [
            userDetails?.user?.id,
            (userDetails?.termsToAccept) || {},
        ] || [undefined, undefined],
        [userDetails]
    );

    const termsInfo = termsToAccept && termsToAccept[activeAccountId];

    const handleAccept = useCallback(async () => {
        await APISaveTermsAcceptance(userId, activeAccountId, termsInfo.version);
        onAccept();
    }, [userId, activeAccountId, termsInfo, onAccept]);

    const maybeRenderTermsCheck = useCallback(() => {
        if (!userDetails || !(accountFeatures.includes(FEATURE_TERMS_AND_CONDITIONS))) {
            return children;
        }
        return (
            <AcceptedTermsCheck
                userId={userId}
                termsToAccept={termsToAccept}
                accountId={activeAccountId}
                onAccept={handleAccept}
            >
                {children}
            </AcceptedTermsCheck>
        )
    }, [userDetails, accountFeatures, userId, termsToAccept, activeAccountId, handleAccept, children]);

    return maybeRenderTermsCheck();
}

export default AcceptedTerms;
