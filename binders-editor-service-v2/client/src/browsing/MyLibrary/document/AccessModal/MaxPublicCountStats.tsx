import * as React from "react";
import { TranslationKeys as TK } from "@binders/client/lib/react/i18n/translations";
import cx from "classnames";
import { useActiveAccount } from "../../../../accounts/hooks";
import { useMemo } from "react";
import { usePublicDocumentCount } from "../../../../documents/hooks";
import { useTranslation } from "@binders/client/lib/react/i18n";

export const MaxPublicCountStats = () => {
    const account = useActiveAccount();
    const { t } = useTranslation();
    const publicDocumentCount = usePublicDocumentCount();
    const totalPublicDocuments = publicDocumentCount.data ?? 0;
    const maxPublicDocuments = account ? account.maxPublicCount : 0;
    const showWarning = totalPublicDocuments >= maxPublicDocuments;

    const showMaxPublicCountStats = useMemo(() => {
        return (
            account &&
            account.maxPublicCount !== null &&
            account.maxPublicCount !== undefined &&
            account.amIAdmin
        );
    }, [account]);

    return showMaxPublicCountStats && publicDocumentCount.isSuccess && (
        <div className={cx("max-public-count-stats", { "warning": showWarning })}>
            {t(TK.Account_MaxPublicCount, { totalPublicDocuments, maxPublicDocuments })}
        </div>
    );
}

