import { IMessageButton, MessageSeverity, getFlashMessageStoreActions } from "./store";

export class FlashMessageActions {

    private static getKey(): string {
        return Math.random().toString(36);
    }

    private static message(
        message: string,
        severity: MessageSeverity,
        autohideDelayInMs?: number,
        buttons?: IMessageButton[]
    ) {
        const key = FlashMessageActions.getKey();
        getFlashMessageStoreActions().addMessage({ buttons, key, message, severity })
        if (autohideDelayInMs !== undefined) {
            setTimeout(() => FlashMessageActions.dismissMessage(key), autohideDelayInMs);
        }
        return key;
    }
    static info(message: string, autohideDelayInMs?: number, buttons?: IMessageButton[]): string {
        return FlashMessageActions.message(message, MessageSeverity.INFO, autohideDelayInMs, buttons);
    }

    static success(message: string, autohideDelayInMs?: number, buttons?: IMessageButton[]): string {
        return FlashMessageActions.message(message, MessageSeverity.SUCCESS, autohideDelayInMs, buttons);
    }

    static warning(message: string, autohideDelayInMs?: number, buttons?: IMessageButton[]): string {
        return FlashMessageActions.message(message, MessageSeverity.WARNING, autohideDelayInMs, buttons);
    }

    static error(message: string, autohideDelayInMs?: number, buttons?: IMessageButton[]): string {
        return FlashMessageActions.message(message, MessageSeverity.ERROR, autohideDelayInMs, buttons);
    }

    static dismissMessage(key: string): void {
        getFlashMessageStoreActions().dismissMessage(key);
    }
}
