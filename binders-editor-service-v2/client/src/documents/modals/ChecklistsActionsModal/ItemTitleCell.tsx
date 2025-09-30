import * as React from "react";
import { FC, useMemo } from "react";
import { Binder } from "@binders/client/lib/clients/repositoryservice/v3/contract";
import { extractTitle } from "@binders/client/lib/clients/repositoryservice/v3/helpers";
import { getEditorLocation } from "@binders/client/lib/util/domains";
import { useCurrentDomain } from "../../../accounts/hooks";
import "./ItemTitleCell.styl";

export const ItemTitleCell: FC<{
    binder: Binder
}> = ({ binder }) => {
    const domain = useCurrentDomain();
    const editorLocation = useMemo(() => getEditorLocation(domain), [domain]);

    const title = useMemo(() => {
        if (binder == null) return null;
        return extractTitle(binder)
    }, [binder]);

    const link = useMemo(() => {
        if (binder == null) return null;
        return `${editorLocation}/documents/${binder.id}`;
    }, [binder, editorLocation]);
    

    return (
        <a
            href={link}
            target="_blank"
            rel="noreferrer"
            className="item-title-cell"
        >
            {title}
        </a>
    );
}
