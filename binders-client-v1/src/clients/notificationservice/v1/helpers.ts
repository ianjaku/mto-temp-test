import { RelativeDate } from "./contract";
import add from "date-fns/add";
import format from "date-fns/format";
import { isRelativeDate } from "./validation";

export const resolveRelativeDate = (date: Date | RelativeDate): Date => {
    if (isRelativeDate(date)) {
        return add(new Date(), { [date.granularity]: date.amount });
    }
    return date;
}

export const combineDates = (date: Date | string, time: Date | string): Date => {
    const datePart = format(new Date(date), "yyyy-MM-dd");
    const timePart = format(new Date(time), "HH:mm:ss");
    return new Date(`${datePart}T${timePart}`);
}
