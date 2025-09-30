import * as React from "react";
import { DatePicker as MaterialDatePicker, MuiPickersUtilsProvider } from "@material-ui/pickers";
import { endOfDay, startOfDay } from "date-fns";
import Input from "../input";
import MomentUtils from "@date-io/moment";
import { fmtDateIso8601TZ } from "@binders/client/lib/util/date";
import moment from "moment";
import "./datePicker.styl";

export interface IDatePickerProps {
    selectedDate: Date;
    onChangeDate: (event: Event, date: Date) => void;
    width?: number;
    autoOK?: boolean;
    shouldDisableDate?: (date: Date) => boolean;
    disabled?: boolean;
    disablePast?: boolean;
    snapToEndOfDay?: boolean;
}

class DatePicker extends React.Component<IDatePickerProps, Record<string, unknown>> {

    constructor(props: IDatePickerProps) {
        super(props);
        this.onChange = this.onChange.bind(this);
    }

    public render(): JSX.Element {
        // @TODO: check dialog container style
        const { selectedDate, width, autoOK, shouldDisableDate, disabled, disablePast } = this.props;
        return (
            <div className="datePicker" style={{ width: `${width}px` }}>
                <Input
                    type="text"
                    name="datepicker"
                    width={width}
                    value={selectedDate ? fmtDateIso8601TZ(selectedDate) : ""}
                    disabled={disabled}
                />
                <MuiPickersUtilsProvider libInstance={moment} utils={MomentUtils}>
                    <MaterialDatePicker
                        name="realDatePicker"
                        onChange={this.onChange}
                        autoOk={autoOK}
                        value={selectedDate}
                        className="datePicker-root"
                        disabled={disabled}
                        variant="inline"
                        shouldDisableDate={date => shouldDisableDate?.(date.toDate())}
                        disablePast={disablePast}
                        style={{
                            left: 0,
                            opacity: 0,
                            position: "absolute",
                            top: 0,
                            width: "100%",
                        }}
                        PopoverProps={{
                            anchorOrigin: {
                                horizontal: "left",
                                vertical: "bottom",
                            },
                            transformOrigin: {
                                horizontal: "left",
                                vertical: "top",
                            },
                        }}
                    />
                </MuiPickersUtilsProvider>
            </div>
        );
    }

    private onChange(date: moment.Moment) {
        const result = this.props.snapToEndOfDay ? endOfDay(date.toDate()) : startOfDay(date.toDate());
        this.props.onChangeDate(null, result);
    }
}

export default DatePicker;
