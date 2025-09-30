import * as React from "react";
import { TFunction, useTranslation } from "@binders/client/lib/react/i18n";
import { differenceInDays, sub } from "date-fns";
import Dropdown from "@binders/ui-kit/lib/elements/dropdown";
import RadioButton from "@binders/ui-kit/lib/elements/RadioButton";
import RadioButtonGroup from "@binders/ui-kit/lib/elements/RadioButton/RadioButtonGroup";
import { RangeDatePicker } from "@binders/ui-kit/lib/elements/datePicker";
import { TranslationKeys as TK } from "@binders/client/lib/react/i18n/translations";

const MAX_DAYS = 60
const fixedRangeCountValues = Array.from({ length: MAX_DAYS }, (_v, i) => i + 1);

// Type safe way to convert the fixed range type to a date-fns duration
const toDuration = ({ type, count }: FixedRange): Duration => ({ [`${type}s`]: count });

enum FixedRangeType {
    Day = "day",
    Week = "week",
    Month = "month",
    Year = "year"
}
type FixedRange = { count: number, type: FixedRangeType };

enum TimeRangeType {
    // Datepicker
    Custom = "custom",
    // Dropdowns
    Fixed = "fixed",
    // No filter
    All = "all"
}

export type DateRangeFilter = {
    startDate?: Date;
    endDate?: Date;
    rangeType: TimeRangeType;
    fixedRange: FixedRange,
}

const radioButtonStyle = {
    display: "inline-block",
    width: "auto",
    verticalAlign: "top",
};

export const defaultDateRangeFilter: DateRangeFilter = {
    startDate: undefined,
    endDate: undefined,
    rangeType: TimeRangeType.Fixed,
    fixedRange: { count: 1, type: FixedRangeType.Week },
}

const buildFixedRangeTypeValues = (
    t: TFunction
): { label: string, id: FixedRangeType }[] => ([
    { label: t(TK.General_Day, { count: 1 }), id: FixedRangeType.Day },
    { label: t(TK.General_Week, { count: 1 }), id: FixedRangeType.Week },
    { label: t(TK.General_Month, { count: 1 }), id: FixedRangeType.Month },
    { label: t(TK.General_Year, { count: 1 }), id: FixedRangeType.Year }
]);

export const TimeRangeSection: React.FC<{
    filter: DateRangeFilter;
    updateFilter: (filter: DateRangeFilter) => void;
}> = ({ filter, updateFilter }) => {
    const { t } = useTranslation();

    const onChangeDateRange = React.useCallback((_event: Event, date: Date, type: "start" | "end") => {
        updateFilter({
            ...filter,
            [`${type}Date`]: date,
            rangeType: TimeRangeType.Custom
        });
    }, [filter, updateFilter]);

    const onChangeRangeType = React.useCallback((val: TimeRangeType) => {
        let newFilter: Partial<DateRangeFilter> = {};
        const { fixedRange, startDate: filterStartDate, endDate: filterEndDate } = filter;
        // if we switch from fixed dates (dropdowns) to custom (datepickers)
        if (val === TimeRangeType.Custom && fixedRange.type && fixedRange.count) {
            const [startDate, endDate] = getDatesFromFixedRange(fixedRange);
            newFilter = { startDate: startDate, endDate: endDate };
        } else if (val === TimeRangeType.Fixed && filterStartDate && filterStartDate) {
            const duration = differenceInDays(filterEndDate, filterStartDate);
            const daysCount = Math.min(MAX_DAYS, Math.floor(duration));
            newFilter = { fixedRange: { type: FixedRangeType.Day, count: daysCount } };
        }
        updateFilter({ ...filter, rangeType: val, ...newFilter })
    }, [filter, updateFilter]);

    const onDropdownClick = React.useCallback(() => {
        updateFilter({ ...filter, rangeType: TimeRangeType.Fixed });
    }, [filter, updateFilter]);

    const onSelectFixedRangeCount = React.useCallback((val: number) => {
        updateFilter({
            ...filter,
            fixedRange: { ...filter.fixedRange, count: val }
        });
    }, [filter, updateFilter]);

    const onSelectFixedRangeType = React.useCallback((val: FixedRangeType) => {
        updateFilter({
            ...filter,
            fixedRange: { ...filter.fixedRange, type: val }
        });
    }, [filter, updateFilter]);

    return (
        <div className="deletedItems-filter-content-row">
            <RadioButtonGroup
                name="timeRangeType"
                value={filter.rangeType}
                row={true}
            >
                <div className="deletedItems-filter-content-section">
                    <div className="deletedItems-filter-content-subsection">
                        <RadioButton
                            value={TimeRangeType.Fixed}
                            label={t(TK.Trash_DeletedSince)}
                            style={radioButtonStyle}
                            onChange={() => onChangeRangeType(TimeRangeType.Fixed)}
                        />
                        <Dropdown
                            type="fixedRangeCount"
                            elements={fixedRangeCountValues.map(nr => ({ id: nr, label: nr.toString() }))}
                            selectedElementId={filter.fixedRange.count}
                            maxRows={8}
                            className="deletedItems-filter-dropdown"
                            onSelectElement={onSelectFixedRangeCount}
                            selectedLabelPrefix=" "
                            hideSelectedElementInList={false}
                            showBorders={true}
                            onClick={onDropdownClick}
                            isDisabled={filter.rangeType && filter.rangeType !== TimeRangeType.Fixed}
                        />
                        <Dropdown
                            type="fixedRangeType"
                            elements={buildFixedRangeTypeValues(t)}
                            selectedElementId={filter.fixedRange.type}
                            maxRows={4}
                            className="deletedItems-filter-dropdown"
                            onSelectElement={onSelectFixedRangeType}
                            selectedLabelPrefix=" "
                            hideSelectedElementInList={false}
                            showBorders={true}
                            onClick={onDropdownClick}
                            isDisabled={filter.rangeType && filter.rangeType !== TimeRangeType.Fixed}
                        />
                    </div>
                    <div className="deletedItems-filter-content-subsection isHiddenOnMobile">
                        <RadioButton
                            value={TimeRangeType.Custom}
                            label={t(TK.General_Start)}
                            onChange={() => onChangeRangeType(TimeRangeType.Custom)}
                            style={radioButtonStyle}
                        />

                        <RangeDatePicker
                            selectedDateMin={filter.startDate}
                            selectedDateMax={filter.endDate}
                            onChangeDate={onChangeDateRange}
                            width={150}
                            separator={<span className="deletedItems-filter-datepicker-separator">{t(TK.General_End)}</span>}
                            className="deletedItems-filter-datepicker"
                            disabled={filter.rangeType && filter.rangeType !== TimeRangeType.Custom}
                        />
                    </div>
                    <div className="deletedItems-filter-content-subsection isHiddenOnMobile">
                        <RadioButton
                            value={TimeRangeType.All}
                            label={t(TK.Analytics_AllTime)}
                            style={radioButtonStyle}
                            onChange={(() => onChangeRangeType(TimeRangeType.All))}
                        />
                    </div>
                </div>
            </RadioButtonGroup>
        </div>
    );
}

function getDatesFromFixedRange(fixedRange: { type: FixedRangeType, count: number }) {
    const now = new Date();
    return [sub(now, toDuration(fixedRange)), now] as const;
}

export function getDateRange(filter: DateRangeFilter): { from?: Date | string, until?: Date | string } {
    if (filter.rangeType === TimeRangeType.Fixed) {
        const [startDate] = getDatesFromFixedRange(filter.fixedRange);
        return {
            from: startDate
        }
    }
    if (filter.rangeType === TimeRangeType.Custom) {
        return {
            from: filter.startDate,
            until: filter.endDate
        }
    }
    return {};
}

