import * as React from "react";
import { FC, useMemo } from "react";
import { IChecklistAction } from "@binders/client/lib/clients/repositoryservice/v3/contract";
import { getReaderLocation } from "@binders/client/lib/util/domains";
import { isProduction } from "@binders/client/lib/util/environment";
import { useCurrentDomain } from "../../../accounts/hooks";
import "./StepCell.styl";

export const StepCell: FC<{
    action: IChecklistAction
}> = ({ action }) => {
    const domain = useCurrentDomain();
    const readerLocation = useMemo(() => {
        if (domain == null) return null;
        return getReaderLocation(domain)
    }, [domain]);
    const link = useMemo(() => {
        let queryParams = `?onlyShowChecklist=${action.checklistId}&mockChecklist=${action.performed}`;
        if (!isProduction()) {
            queryParams += `&domain=${domain}`;
        }
        return readerLocation + `/read/${action.publicationId}${queryParams}`;
    }, [readerLocation, action, domain]);

    return (
        <a
            className="step-cell"
            href={link}
            target="_blank"
            rel="noferer noopener"
        >{action.step != null ? action.step + 1 : ""}</a>
    )
}
