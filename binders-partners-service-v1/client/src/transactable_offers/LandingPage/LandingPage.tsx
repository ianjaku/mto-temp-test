import * as React from "react";
import {
    FC,
    useCallback,
    useEffect,
    useMemo,
    useState 
} from "react";
import { IMSAccountSetupRequest, ResolvedMSPurchaseIdToken, ShortAccountInformation } from "@binders/client/lib/clients/accountservice/v1/contract";
import { useHistory, useLocation } from "react-router";
import { APIResolveMSPurchaseIdToken } from "../../api/accountService";
import { AccountInformation } from "./states/account-information/AccountInformation";
import { CreateSetupRequest } from "./states/create-setup-request/CreateSetupRequest";
import { ErrorMessage } from "./states/error-message/ErrorMessage";
import { LoadingState } from "./states/LoadingState";
import { SetupRequest } from "./states/setup-request/SetupRequest";
import { useAzureSSO } from "../../azure-ad-sso/useAzureSSO";
import "./landingPage.styl";

export const LandingPage: FC = () => {

    const azureSSO = useAzureSSO();
    const history = useHistory();
    const location = useLocation();
    const token = useMemo(() => new URLSearchParams(location.search).get("token"), [location]);

    const [accountInfo, setAccountInfo] = useState(null as null | ShortAccountInformation);
    const [setupRequest, setSetupRequest] = useState(null as null | IMSAccountSetupRequest);
    const [purchaseInfo, setPurchaseInfo] = useState(null as null | ResolvedMSPurchaseIdToken);
    const [errorDetails, setErrorDetails] = useState(null as null | Error);

    const fetchTokenInfo = useCallback(() => {
        APIResolveMSPurchaseIdToken(token)
            .then((result) => {
                setAccountInfo(result.account);
                setPurchaseInfo(result.purchase);
                setSetupRequest(result.setupRequest);
            })
            .catch(err => {
                setErrorDetails(err)
            });
    }, [token]);

    if (token == null) {
        history.push("/")
    }

    useEffect(() => {
        fetchTokenInfo()
    }, [fetchTokenInfo]);

    if (azureSSO.isLoading) {
        return <LoadingState />;
    }

    if (errorDetails != null) {
        return <ErrorMessage
            error={errorDetails}
        />;
    }

    if (accountInfo != null) {
        return <AccountInformation
            accountInfo={accountInfo}
            purchaseInfo={purchaseInfo}
        />;
    }

    if (setupRequest != null) {
        return <SetupRequest />;
    }

    if (purchaseInfo != null) {
        return <CreateSetupRequest
            onFinish={() => {
                setPurchaseInfo(null);
                fetchTokenInfo()
            }}
            purchaseInfo={purchaseInfo}
        />;
    }

    return <LoadingState />;
}
