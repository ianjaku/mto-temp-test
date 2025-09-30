import * as React from "react";
import { TimePicker as MaterialTimePicker, MuiPickersUtilsProvider } from "@material-ui/pickers";
import { detectTimeZone, fmtDate, toTimeZoneCode } from "@binders/client/lib/util/date";
import Input from "../input";
import MomentUtils from "@date-io/moment";
import moment from "moment";
import "./timePicker.styl";

export interface ITimePickerProps {
    selectedTime: Date;
    onChangeTime: (e: Event, date: Date) => void;
    width?: number;
    autoOK?: boolean;
    shouldDisableDate?: (date: Date) => boolean;
    disabled?: boolean;
}

class TimePicker extends React.Component<ITimePickerProps, unknown> {

    constructor(props: ITimePickerProps) {
        super(props);
        this.onChange = this.onChange.bind(this);
    }

    private formatTime(dateTime: Date): string {
        if (dateTime) {
            const timeZone = detectTimeZone();
            return `${fmtDate(dateTime, "HH:mm", { timeZone })} ${toTimeZoneCode(dateTime, timeZone)}`;
        }
        return "";
    }

    public render(): JSX.Element {
        const { selectedTime, width, autoOK, disabled } = this.props;
        return (
            <div className="timePicker" style={{ width: `${width}px` }}>
                <Input
                    type="text"
                    name="timePicker"
                    width={width}
                    value={this.formatTime(selectedTime)}
                    disabled={disabled}
                />
                <MuiPickersUtilsProvider libInstance={moment} utils={MomentUtils}>
                    <MaterialTimePicker
                        onChange={this.onChange}
                        autoOk={autoOK}
                        value={selectedTime}
                        className="timePicker-root"
                        disabled={disabled}
                        openTo="hours"
                        variant="inline"
                        ampm={false}
                        style={{
                            left: 0,
                            opacity: 0,
                            border: "1px solid red",
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
        this.props.onChangeTime(null, date.toDate());
    }
}

export default TimePicker;
