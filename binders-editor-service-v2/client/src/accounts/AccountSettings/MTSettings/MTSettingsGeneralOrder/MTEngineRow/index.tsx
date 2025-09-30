import * as React from "react";
import { MTEngineType } from "@binders/client/lib/clients/repositoryservice/v3/contract";
import Menu from "@binders/ui-kit/lib/elements/icons/Menu";
import { getMTEngineName } from "@binders/client/lib/clients/repositoryservice/v3/helpers";
const { useMemo } = React;

interface IProps {
    mtEngineType: MTEngineType;
    pos: number;
}

const MTEngineRow: React.FC<IProps> = ({ mtEngineType, pos }) => {
    const name = useMemo(() => getMTEngineName(mtEngineType), [mtEngineType]);
    return (
        <div className="mt-settings-general-row">
            <Menu />
            <label className="mt-settings-general-row-pos">
                {pos}
            </label>
            <label>
                {name}
            </label>
        </div>
    )
}

export default MTEngineRow