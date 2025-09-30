import * as React from "react";
import { useCallback, useMemo } from "react";
import { ChipComponentProps } from "@binders/ui-kit/lib/elements/autocomplete/contract";
import Close from "@binders/ui-kit/lib/elements/icons/Close";
import Icon from "@binders/ui-kit/lib/elements/icons";
import "./TargetChip.styl";

function maybeStripInfoLbl(lbl: string) {
    return lbl.replace(/^\(.*\) ?(.*)$/, "$1");
}

const TargetChip: React.FC<ChipComponentProps> = (allProps) => {

    const {
        label,
        value,
        isNew,
        onDelete,
        classes,
    } = allProps;

    const iconName = useMemo(() => {
        return classes.root.includes("autocomplete-chip--user") ? "person" : "group";
    }, [classes]);

    const handleDelete = useCallback(() => {
        onDelete(value, label, isNew);
    }, [isNew, label, onDelete, value]);

    const renderDeleteBtn = useCallback(() => (
        <label className="closeBtn" onClick={handleDelete}>
            {Close()}
        </label>
    ), [handleDelete]);

    return (
        <div className="targetChip">
            <Icon name={iconName} />
            {maybeStripInfoLbl(label)}
            {renderDeleteBtn()}
        </div>
    )
}

export default TargetChip