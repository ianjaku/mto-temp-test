import { Modal, ModalProps, getUniqueId } from "./ModalViewProvider";

interface ModalListener {
    id: string;
    callback: (modal: Modal<unknown, unknown>) => void;
}

let modalListeners: ModalListener[] = [];


/**
 * @deprecated Use the useShowModal hook in the ModalViewProvider.tsx file instead.
 */
export const showModal = <Params, Response>(
    component: React.ComponentType<ModalProps<Params, Response>>,
    params?: Params
): Promise<Response | null> => {
    return new Promise(resolve => {
        const modal = {
            id: getUniqueId(),
            component,
            params,
            callback: resolve
        };
        modalListeners.forEach(l => l.callback(modal));
    });
}

export const addModalListener = (listener: ModalListener["callback"]): string => {
    const id = getUniqueId();
    modalListeners.push({
        id,
        callback: listener
    });
    return id;
}

export const removeModalListener = (id: ModalListener["id"]): void => {
    modalListeners = modalListeners.filter(l => l.id !== id)
}
