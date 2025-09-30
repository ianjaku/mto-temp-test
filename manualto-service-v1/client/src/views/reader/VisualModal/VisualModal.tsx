import { IThumbnail } from "@binders/client/lib/clients/repositoryservice/v3/contract";
import Modal from "@binders/ui-kit/lib/elements/modal";
import { ModalComponent } from "@binders/ui-kit/lib/compounds/modals/ModalViewProvider";
import React from "react";
import { Visual } from "@binders/client/lib/clients/imageservice/v1/Visual";
import { VisualView } from "@binders/ui-kit/lib/elements/VisualView";
import { useMemo } from "react";

export const VisualModal: ModalComponent<{ visual: Visual & IThumbnail }> = ({ params: { visual } }) => {
    const visualObj = useMemo(() => Object.assign(Object.create(Visual.prototype), visual), [visual]);
    return (
        <Modal
            buttons={[]}
            withoutPadding={true}
            withoutFooter={true}
            zIndexBump={100}
        >
            <VisualView
                visual={visualObj}
            />
        </Modal>
    );
}
