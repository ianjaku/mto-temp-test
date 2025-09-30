import * as React from "react";
import { isAfter, isBefore } from "date-fns";
import DatePicker from "./simple";
import autobind from "class-autobind";

import "./datePicker.styl";

export interface IDateRangeType {
    start: Date;
    end: Date;
}

export interface IDatePickerProps {
    selectedDateMin: Date;
    selectedDateMax: Date;
    onChangeDate: (event: Event, date: Date, type: keyof IDateRangeType) => void;
    width?: number;
    autoOK?: boolean;
    disabled?: boolean;
    className?: string;
    separator?: React.ReactElement | string;
}

class RangeDatePicker extends React.Component<IDatePickerProps, Record<string, unknown>> {
    constructor(props: IDatePickerProps) {
        super(props);
        this.state = {
            inputFocused: false,
        };
        autobind(this);
    }

    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    public render() {
        const { selectedDateMin, selectedDateMax, width, autoOK, disabled, className, separator } = this.props;
        return (
            <div className={className}>
                <DatePicker
                    shouldDisableDate={this.blockLaterDates}
                    selectedDate={selectedDateMin}
                    onChangeDate={this.onChangeDateMin}
                    width={width}
                    autoOK={autoOK}
                    disabled={disabled}
                />
                {separator}
                <DatePicker
                    shouldDisableDate={this.blockEarlierDates}
                    selectedDate={selectedDateMax}
                    onChangeDate={this.onChangeDateMax}
                    width={width}
                    autoOK={autoOK}
                    disabled={disabled}
                    snapToEndOfDay
                />
            </div>
        );
    }

    private blockEarlierDates(date: Date): boolean {
        const { selectedDateMin } = this.props;
        if (selectedDateMin) {
            return isBefore(date, selectedDateMin);
        }
        return false;
    }
    private blockLaterDates(date: Date): boolean {
        const { selectedDateMax } = this.props;
        if (selectedDateMax) {
            return isAfter(date, selectedDateMax);
        }
        return false;
    }

    private onChangeDateMin(event: Event, date: Date) {
        this.props.onChangeDate(event, date, "start");
    }
    private onChangeDateMax(event: Event, date: Date) {
        this.props.onChangeDate(event, date, "end");
    }
}

export default RangeDatePicker;
