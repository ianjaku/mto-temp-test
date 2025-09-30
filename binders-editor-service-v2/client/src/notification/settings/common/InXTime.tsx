import * as React from "react";
import {
    DateGranularity,
    RelativeDate
} from  "@binders/client/lib/clients/notificationservice/v1/contract";
import { FC, useMemo, useState } from "react";
import Dropdown from "@binders/ui-kit/lib/elements/dropdown";
import { fmtDateIso8601TZ } from "@binders/client/lib/util/date";
import { resolveRelativeDate } from "@binders/client/lib/clients/notificationservice/v1/helpers";
import "./InXTime.styl";

export const InXTime: FC<{
    /**
     * Example: { year: 3, month: 10 }
     *   -> 1 to 3 years
     *   -> 1 to 10 months
     */
    options: Record<DateGranularity, number>;
    showPreview: boolean;
    disabled: boolean;
    onChange: (value: RelativeDate) => void
}> = ({
    options,
    showPreview,
    disabled,
    onChange,
}) => {
    const granularityOptions = useMemo(() => {
        return Object.keys(options) as DateGranularity[];
    }, [options]);

    const [granularity, setGranularity] = useState<DateGranularity>(granularityOptions[0]);
    const [amount, setAmount] = useState(1);

    const updateGranularity = (granularity: DateGranularity) => {
        setGranularity(granularity);
        const newAmount = amount > options[granularity] ? 1 : amount;
        setAmount(newAmount);
        onChange({ granularity, amount: newAmount });
    };

    const updateAmount = (newAmount: number) => {
        setAmount(newAmount);
        onChange({ granularity, amount: newAmount });
    };

    const amountLabels = useMemo(() => {
        const length = options[granularity];
        return Array.from(
            { length },
            (_, i) => ({ id: i+1, label: (i+1).toString() })
        );
    }, [options, granularity]);

    const previewDateString = useMemo(() => {
        const date = resolveRelativeDate({ granularity, amount });
        return fmtDateIso8601TZ(date);
    }, [granularity, amount])
    
    return (
        <div className="inxtime-wrapper">
            <div className="inxtime-dropdowns">
                <Dropdown
                    type="fixedRangeCount"
                    elements={amountLabels}
                    selectedElementId={amount}
                    maxRows={8}
                    width={60}
                    className="inxtime-dropdown"
                    onSelectElement={updateAmount}
                    selectedLabelPrefix=" "
                    hideSelectedElementInList={false}
                    showBorders={true}
                    isDisabled={disabled}
                />
                <Dropdown
                    type="fixedRangeCount"
                    elements={granularityOptions.map(v => ({ id: v, label: v}))}
                    selectedElementId={granularity}
                    maxRows={8}
                    width={100}
                    className="inxtime-dropdown"
                    onSelectElement={updateGranularity}
                    selectedLabelPrefix=" "
                    hideSelectedElementInList={false}
                    showBorders={true}
                    isDisabled={disabled}
                />
            </div>
            {showPreview && (
                <div className="inxtime-preview">
                    {previewDateString}
                </div>
            )}
        </div>
    );
}