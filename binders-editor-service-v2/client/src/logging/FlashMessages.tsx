import * as React from "react";
import { EditorEvent, captureFrontendEvent } from "@binders/client/lib/thirdparty/tracking/capture";
import FlashMessage, { FlashMessageType } from "@binders/ui-kit/lib/elements/flashmessage";
import { differenceInMilliseconds } from "date-fns";

interface ErrorMessage {
    severity: FlashMessageType.ERROR;
    message: string;
    timestamp: Date;
}
const errorMessagesHistory: ErrorMessage[] = [];
const ERRORMESSAGE_HISTORY_SIZE_LIMIT = 10;

function pushToHistory(message: ErrorMessage) {
    if (errorMessagesHistory.push(message) > ERRORMESSAGE_HISTORY_SIZE_LIMIT) {
        errorMessagesHistory.shift();
    }
}

let instance: FlashMessages | undefined = undefined;
const IDENTICAL_ERROR_MESSAGE_IGNORE_PERIOD_MS = 5000;

function occurredRecently(errorMessage: string) {
    return errorMessagesHistory
        .filter(msg => msg.message === errorMessage)
        .some(msg => differenceInMilliseconds(new Date(), msg.timestamp) < IDENTICAL_ERROR_MESSAGE_IGNORE_PERIOD_MS);
}

function dispatchMessage(severity: FlashMessageType, message: string, keepOpen = false) {
    if (severity === FlashMessageType.ERROR) {
        if (occurredRecently(message)) {
            return;
        }
        pushToHistory({ severity, message, timestamp: new Date() });
    }
    instance.setMessage({ severity, message }, keepOpen);
}

type Message = {
    severity: FlashMessageType;
    message: string;
};

interface FlashMessagesState {
    isActive: boolean;
    keepOpen: boolean;
    message: Message | undefined;
}

export class FlashMessages extends React.Component<unknown, FlashMessagesState> {
    constructor(props: unknown) {
        super(props);
        // eslint-disable-next-line @typescript-eslint/no-this-alias
        instance = this;
        this.state = {
            isActive: false,
            keepOpen: false,
            message: undefined,
        };
    }

    static info(message: string, keepOpen = false) {
        captureFrontendEvent(EditorEvent.InfoFlashMessageShown, { message, keepOpen });
        dispatchMessage(FlashMessageType.INFO, message, keepOpen);
    }

    static success(message: string, keepOpen = false) {
        captureFrontendEvent(EditorEvent.SuccessFlashMessageShown, { message, keepOpen });
        dispatchMessage(FlashMessageType.SUCCESS, message, keepOpen);
    }

    static error(message: string, keepOpen = false) {
        captureFrontendEvent(EditorEvent.ErrorFlashMessageShown, { message, keepOpen });
        dispatchMessage(FlashMessageType.ERROR, message, keepOpen);
    }

    setMessage(message: Message, keepOpen = false) {
        this.setState({
            message,
            isActive: true,
            keepOpen,
        });
    }

    private removeMessage() {
        this.setState({ isActive: false });
    }

    render() {
        const { isActive, keepOpen, message } = this.state;
        const messageType = message ? message.severity : undefined;
        const messageText = message ? message.message : "";
        return (
            <FlashMessage
                type={messageType}
                message={messageText}
                onHide={() => this.removeMessage()}
                open={isActive}
                keepOpen={keepOpen}
            />
        );
    }
}
