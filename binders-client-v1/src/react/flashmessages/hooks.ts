import { Message, useFlashMessageStoreState } from "./store";

export function useFlashMessages(): Message[] {
    const { messages } = useFlashMessageStoreState();
    return messages;
}
