import * as React from "react";
import MTEngineRow from "./MTEngineRow";
import { MTEngineType } from "@binders/client/lib/clients/repositoryservice/v3/contract";
import Sortable from "@binders/ui-kit/lib/elements/sortable";
import { reorder } from "@binders/client/lib/dnd/helpers";
import { setMTSettings } from "../../../actions";

interface IProps {
    accountId: string;
    generalOrder: MTEngineType[];
}

const MTSettingsGeneralOrder: React.FC<IProps> = ({ accountId, generalOrder }) => {
    const renderMTEngineRows = React.useCallback(() => {
        return generalOrder.map((type, i) => (
            <MTEngineRow
                key={`mtrow${i}`}
                mtEngineType={type}
                pos={i + 1}
            />
        ))
    }, [generalOrder]);

    const onReorder = React.useCallback((startIndex: number, endIndex: number) => {
        setMTSettings(
            accountId,
            {
                generalOrder: reorder(generalOrder, startIndex, endIndex)
            }
        )
    }, [accountId, generalOrder]);

    return (
        <div className="mt-settings-general">
            <Sortable onReorder={onReorder}>
                {renderMTEngineRows()}
            </Sortable>
        </div>
    )
}

export default MTSettingsGeneralOrder;