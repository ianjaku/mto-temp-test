import * as React from "react";
import { FC, createContext, useCallback, useContext } from "react";

let _idCounter = 0;
export const getUniqueId = (): string => (_idCounter++).toString();

export interface ModalProps<Params, Response> {
    params?: Params;
    hide: (response?: Response) => void;
}

export type ModalComponent<Params> = FC<ModalProps<Params, Response>>;

export interface Modal<Params, Response> {
    id: string;
    component: React.ComponentType<ModalProps<Params, Response>>;
    params: Params;
    callback?: (result: unknown) => void;
}

export interface ModalViewProviderState {
    activeModalId: string | null;
    modals: Modal<unknown, unknown>[];
    showModal: <Params, Response>(modal: Modal<Params, Response>) => Promise<Response>;
    hideModal: (id: string) => void;
}

export const ModalViewProviderContext = createContext<ModalViewProviderState>({
    activeModalId: null,
    modals: [],
    showModal() {
        throw new Error(
            "Please add the <ModalView> component as a provider around one of the parents of this component."
        );
    },
    hideModal() {
        throw new Error(
            "Please add the <ModalView> component as a provider around one of the parents of this component."
        );
    }
});

export const ModalViewProvider: FC<{ value: ModalViewProviderState }> = ({
    children,
    value
}) => {
    return (
        <ModalViewProviderContext.Provider value={value}>
            {children}
        </ModalViewProviderContext.Provider>
    )
}

export const useModalState = (): ModalViewProviderState => {
    return useContext(ModalViewProviderContext);
}

export const useShowModal = <Params, Response>(
    component: React.ComponentType<ModalProps<Params, Response>>,
    uniqueId: string = getUniqueId() // Unique id to identify the modal
): (params?: Params) => Promise<Response> => {
    const showModal = useModalState().showModal;

    return useCallback<(params: Params) => Promise<Response>>(
        (params) => {
            return new Promise((resolve) => {
                const modal = {
                    id: uniqueId,
                    component,
                    params,
                    callback: resolve
                };
                showModal(modal)
            });
        }, [component, showModal, uniqueId],
    );
}

export interface UseModalResponse<Params, Response> {
    show: (params?: Params) => Promise<Response>;
    hide: () => void;
    toggle: () => void;
    isOpen: boolean;
}
export const useModal = <Params, Response>(
    component: React.ComponentType<ModalProps<Params, Response>>,
    uniqueId: string = getUniqueId() // Unique id to identify the modal
): UseModalResponse<Params, Response> => {
    const showModal = useShowModal(component, uniqueId);
    const state = useModalState();
    const isOpen = state.modals.some(m => m.id === uniqueId);

    return {
        show: showModal,
        hide: () => state.hideModal(uniqueId),
        toggle: () => {
            if (isOpen) {
                state.hideModal(uniqueId);
            } else {
                showModal();
            }
        },
        isOpen
    };
}

export const useHasOpenModal = (): boolean => {
    const modalState = useModalState();
    return modalState.activeModalId != null;
}
