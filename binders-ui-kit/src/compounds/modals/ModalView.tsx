import * as React from "react";
import { FC, useEffect, useMemo, useState } from "react";
import { Modal, ModalViewProvider } from "./ModalViewProvider";
import { addModalListener, removeModalListener } from "./showModal";


export const ModalView: FC<{
    hideChildrenOnModalOpen?: boolean
}> = ({ children, hideChildrenOnModalOpen }) => {
    const [modals, setModals] = useState<Modal<unknown, unknown>[]>([]);
    
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const showModal = <Params, Response>(
        modal: Modal<Params, Response>
    ): Promise<Response> => {
        return new Promise((resolve) => {
            if (modal.callback == null) {
                modal.callback = resolve;
            } else {
                resolve(null);
            }
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            setModals(modals => [...modals, modal as any]);
        });
    }

    const hideModal = (id: string, response?: unknown) => {
        const modal = modals.find(m => m.id === id);
        if (modal == null) return;
        if (modal.callback) {
            modal.callback(response);
        }
        setModals(modals => modals.filter(modal => modal.id !== id));
    }

    const activeModal = useMemo(() => modals[0] ?? null, [modals]);
    const activeModalId = useMemo(() => activeModal ? activeModal.id : null, [activeModal]);
    const childrenShown = !hideChildrenOnModalOpen || (hideChildrenOnModalOpen && !activeModal);

    useEffect(() => {
        const id = addModalListener(modal => showModal(modal));
        return () => removeModalListener(id);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [showModal]);
    
    return (
        <ModalViewProvider value={{ activeModalId, modals, hideModal, showModal }}>
            <div>
                {modals.map(modal => (
                    React.createElement(
                        modal.component,
                        {
                            key: modal.id,
                            params: modal.params,
                            hide: (response: unknown = null) => hideModal(modal.id, response),
                        }
                    )
                ))}
                {childrenShown && children}
            </div>
        </ModalViewProvider>
    );
}

