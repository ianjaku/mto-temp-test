import * as React from "react";
import { FC, useEffect, useMemo, useState } from "react";
import {
    combineDates,
    resolveRelativeDate
} from  "@binders/client/lib/clients/notificationservice/v1/helpers";
import { DatePicker } from "@binders/ui-kit/lib/elements/datePicker";
import { InXTime } from "../../common/InXTime";
import RadioButton from "@binders/ui-kit/lib/elements/RadioButton";
import RadioButtonGroup from "@binders/ui-kit/lib/elements/RadioButton/RadioButtonGroup";
import { RelativeDate } from "@binders/client/lib/clients/notificationservice/v1/contract";
import { TranslationKeys as TK } from "@binders/client/lib/react/i18n/translations";
import TimePicker from "@binders/ui-kit/lib/elements/timePicker";
import { add } from "date-fns";
import { isRelativeDate } from "@binders/client/lib/clients/notificationservice/v1/validation";
import { useTranslation } from "@binders/client/lib/react/i18n";

export const ScheduledFormDetails: FC<{
    onDateChange: (date: Date | RelativeDate) => void;
    onTimeChange: (time: Date) => void;
    date: Date | RelativeDate;
    time: Date;
}> = ({ onDateChange, onTimeChange, time, date }) => {
    const { t } = useTranslation();
    const [relativeDate, setRelativeDate] = useState<RelativeDate>({ amount: 1, granularity: "years" });
    const [absoluteDate, setAbsoluteDate] = useState<Date>(add(new Date(), { days: 1 }));
    const [dateType, setDateType] = useState<"relative" | "absolute">("absolute");
    const [selectedTime, setSelectedTime] = useState<Date>(add(new Date(), { hours: 1 }));

    useEffect(() => {
        setSelectedTime(time);
    }, [time])

    const dateTime = useMemo(() => {
        if (date == null) return new Date();
        const absoluteDate = resolveRelativeDate(date);
        return combineDates(absoluteDate, time);
    }, [time, date]);

    const isInPast = useMemo(() => {
        return dateTime.getTime() < new Date().getTime();
    }, [dateTime]);

    const setDate = (date: Date | RelativeDate) => {
        if (isRelativeDate(date)) {
            setDateType("relative");
            setRelativeDate(date);
        } else {
            setDateType("absolute");
            setAbsoluteDate(date);
        }
        onDateChange(date);
    }

    const onRadioChange = (dateType: "relative" | "absolute") => {
        setDateType(dateType);
        if (dateType === "relative") {
            onDateChange(relativeDate);
        } else {
            onDateChange(absoluteDate);
        }
    }

    useEffect(() => {
        if (isRelativeDate(date)) {
            if (
                date.amount !== relativeDate.amount ||
                date.granularity !== relativeDate.granularity
            ) {
                setRelativeDate(date);
            }
        } else {
            if (new Date(date).getTime() !== new Date(absoluteDate).getTime()) {
                setAbsoluteDate(date);
            }
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [date]);

    const setTime = (time: Date) => {
        setSelectedTime(time);
        onTimeChange(time);
    }
    
    return(
        <>
            <div className="create-email-not-row">
                <label className="create-email-not-label">
                    {t(TK.Notifications_DeliveryDate)}
                </label>
                <RadioButtonGroup value={dateType}>
                    <div className="create-email-not-row-inline">
                        <div className="create-email-not-row-inline create-email-not-row-inline--mr">
                            <RadioButton
                                label="On"
                                size="small"
                                className="create-email-not-radio"
                                value="absolute"
                                onChange={() => onRadioChange("absolute")}
                            />
                            <DatePicker
                                disablePast
                                width={100}
                                selectedDate={absoluteDate}
                                onChangeDate={(_evt, date) => setDate(date)}
                                disabled={dateType !== "absolute"}
                                autoOK={true}
                            />
                        </div>
                        <div className="create-email-not-row-inline">
                            <RadioButton
                                label="In"
                                size="small"
                                className="create-email-not-radio"
                                value="relative"
                                onChange={() => onRadioChange("relative")}
                            />
                            <InXTime
                                options={{
                                    years: 5,
                                    months: 11,
                                    days: 30
                                }}
                                disabled={dateType !== "relative"}
                                showPreview={dateType === "relative"}
                                onChange={v => setDate(v)}
                            />
                        </div>
                    </div>
                </RadioButtonGroup>
                {isInPast && (
                    <div className="create-email-not-error-row">
                        {t(TK.Notifications_DateTimeFuture)}
                    </div>
                )}
            </div>
            <div className="create-email-not-row">
                <label htmlFor="subject" className="create-email-not-label">
                    {t(TK.Notifications_DeliveryTime)}
                </label>
                <TimePicker
                    width={200}
                    selectedTime={selectedTime}
                    onChangeTime={(_evt, date) => setTime(date)}
                />
                {isInPast && (
                    <div className="create-email-not-error-row">
                        {t(TK.Notifications_DateTimeFuture)}
                    </div>
                )}
            </div>
        </>
    )
}
