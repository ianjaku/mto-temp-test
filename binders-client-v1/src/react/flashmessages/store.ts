import { createStore, useStore } from "zustand";

export enum MessageSeverity {
    ERROR,
    WARNING,
    INFO,
    SUCCESS
}

export interface IMessageButton {
    text: string;
    onClick: () => unknown;
    clickDismissesMessage?: boolean;
}

export interface Message {
    key: string;
    message: string;
    severity: MessageSeverity;
    buttons?: IMessageButton[];
}

export type FlashMessageStoreActions = {
    addMessage: (msg: Message) => void;
    dismissMessage: (key: string) => void;
    setMessages: (messages: FlashMessageStoreState["messages"]) => void;
    setMaxMessageCount: (messages: FlashMessageStoreState["maxMessageCount"]) => void;
};

export type FlashMessageStoreState = {
    messages: Message[];
    maxMessageCount: number;
};

export type FlashMessageStore = FlashMessageStoreState & {
    actions: FlashMessageStoreActions;
};

const flashMessageStore = createStore<FlashMessageStore>(set => ({
    messages: [],
    maxMessageCount: 0,
    actions: {
        addMessage(msg) {
            set((prev) => {
                const updatedMessages = [msg, ...prev.messages];
                const max = prev.maxMessageCount;
                if (max > 0 && updatedMessages.length > max) {
                    return { ...prev, messages: updatedMessages.slice(0, max) };
                }
                return { ...prev, messages: updatedMessages };
            });
        },
        dismissMessage(key) {
            set(prev => ({
                ...prev,
                messages: prev.messages.filter(m => m.key !== key)
            }));
        },
        setMessages(messages) {
            set(prev => ({ ...prev, messages }));
        },
        setMaxMessageCount(maxMessageCount) {
            set(prev => ({ ...prev, maxMessageCount }));
        },
    },
}));

/**
 * @deprecated use hook functions instead
 */
export function getFlashMessageStoreActions(): FlashMessageStoreActions {
    return flashMessageStore.getState().actions;
}

export function useFlashMessageStore(): FlashMessageStore {
    const store = useStore(flashMessageStore);
    return store;
}

export function useFlashMessageStoreState(): FlashMessageStoreState {
    const state = useStore(flashMessageStore);
    return state;
}

export function useFlashMessageStoreActions(): FlashMessageStoreActions {
    const { actions } = useFlashMessageStore();
    return actions;
}

