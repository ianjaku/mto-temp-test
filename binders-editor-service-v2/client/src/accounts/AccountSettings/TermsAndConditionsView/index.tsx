import * as React from "react";
import { ITermsInfo } from "@binders/client/lib/clients/userservice/v1/contract";
import MultilingualPanel from "@binders/ui-kit/lib/compounds/multilingualpanel";
import { getTermsInfo } from "./actions";
import "./termsAndConditions.styl";

const { useState, useEffect } = React;
interface IProps {
    accountId: string;
}

const TermsAndConditions: React.FC<IProps> = ({ accountId }) => {

    const [termsInfo, setTermsInfo] = useState<ITermsInfo | undefined>();

    useEffect(() => {
        if (accountId) {
            getTermsInfo(accountId).then(termsInfo => setTermsInfo(termsInfo));
        }
    }, [accountId]);

    return (
        <div className="pdf-export-settings">
            <div className="settings-wrapper">
                <div className="termsAndConditions">
                    {termsInfo && <MultilingualPanel contentMap={termsInfo.contentMap} />}
                </div>
            </div>
        </div>
    )
}

export default TermsAndConditions;
