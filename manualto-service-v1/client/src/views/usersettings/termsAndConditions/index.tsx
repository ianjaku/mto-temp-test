import * as React from "react";
import { ITermsInfo } from "@binders/client/lib/clients/userservice/v1/contract";
import MultilingualPanel from "@binders/ui-kit/lib/compounds/multilingualpanel";
import { getTermsInfo } from "./actions";
import "./termsAndConditions.styl";

const { useState } = React;

export interface ITermsAndConditionsProps {
    accountId: string;
}

const TermsAndConditions: React.FC<ITermsAndConditionsProps> = ({ accountId }) => {
    const [termsInfo, setTermsInfo] = useState<ITermsInfo | undefined>();

    React.useEffect(() => {
        if (accountId) {
            getTermsInfo(accountId).then(termsInfo => setTermsInfo(termsInfo));
        }
    }, [accountId]);

    return (
        <div className="termsAndConditions">
            {termsInfo && <MultilingualPanel contentMap={termsInfo.contentMap} />}
        </div>
    );
};

export default TermsAndConditions;
