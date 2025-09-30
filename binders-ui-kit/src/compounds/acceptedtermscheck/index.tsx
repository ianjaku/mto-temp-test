import * as React from "react";
import Button from "../../elements/button";
import { ITermsMap } from "@binders/client/lib/clients/userservice/v1/contract";
import Modal from "../../elements/modal";
import MultilingualPanel from "../multilingualpanel";
import { TranslationKeys as TK } from "@binders/client/lib/react/i18n/translations";
import { useTranslation } from "@binders/client/lib/react/i18n";
import "./terms.styl";

const { useCallback, useState } = React;
interface IProps {
    children: React.ReactElement;
    userId: string;
    termsToAccept?: ITermsMap;
    accountId: string;
    onAccept: (userId: string, accountId: string, version: string) => Promise<void>;
}

const AcceptedTermsCheck: React.FC<IProps> = ({
    children,
    userId,
    termsToAccept,
    onAccept,
    accountId,
}) => {

    const { t } = useTranslation();

    const [isAccepting, setIsAccepting] = useState(false);

    const termsInfo = termsToAccept && termsToAccept[accountId];

    const handleAccept = useCallback(async () => {
        setIsAccepting(true);
        try {
            await onAccept(userId, accountId, termsInfo.version);
        }
        finally {
            setIsAccepting(false);
        }
    }, [onAccept, userId, accountId, termsInfo]);

    const maybeRenderModal = useCallback(() => {
        if (!termsInfo !== false) {
            return null;
        }
        return (
            <Modal
                title=""
                buttons={[
                    <Button
                        key="accept"
                        text={t(TK.General_TermsAccept)}
                        onClick={handleAccept}
                        inactiveWithLoader={isAccepting}
                    />,
                ]}
                uncloseable={true}
                classNames="termsModalWrapper"
            >
                <MultilingualPanel contentMap={termsInfo.contentMap} />
            </Modal>
        )
    }, [termsInfo, t, handleAccept, isAccepting]);

    return (
        <>
            {maybeRenderModal()}
            {children}
        </>
    );
}

export default AcceptedTermsCheck