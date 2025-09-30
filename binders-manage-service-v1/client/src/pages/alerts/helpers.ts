import { CreateAlertParams } from "@binders/client/lib/clients/notificationservice/v1/contract";

export const validateCreateAlertParams = (values: CreateAlertParams): string[] => {
    const errors = [];
    if (values.message.length === 0) {
        errors.push("Message cannot be empty.");
    }
    if (
        values.startDate != null &&
        values.endDate != null &&
        new Date(values.startDate) > new Date(values.endDate)
    ) {
        errors.push("Start date cannot be after end date.");
    }
    if (
        (!values.buttonText && values.buttonLink) ||
            (values.buttonText && !values.buttonLink)
    ) {
        errors.push("Button text and link must be both set or both be empty.");
    }
    return errors;
}
