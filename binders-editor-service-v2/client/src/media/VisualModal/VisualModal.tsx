import * as React from "react";
import Button from "@binders/ui-kit/lib/elements/button";
import { IThumbnail } from "@binders/client/lib/clients/repositoryservice/v3/contract";
import Modal from "@binders/ui-kit/lib/elements/modal";
import { TranslationKeys as TK } from "@binders/client/lib/react/i18n/translations";
import { Visual } from "@binders/client/lib/clients/imageservice/v1/Visual";
import { VisualView } from "@binders/ui-kit/lib/elements/VisualView";
import { downloadVisual } from "../helper";
import { useTranslation } from "@binders/client/lib/react/i18n";
import "./VisualModal.styl";

const { useMemo } = React;

export type VisualModalProps = {
    onHide: () => void;
    showDownloadButton?: boolean;
    visual: Visual & IThumbnail;
}

export const VisualModal: React.FC<VisualModalProps> = ({ visual, onHide, showDownloadButton }) => {
    const { t } = useTranslation();
    const { filename, extension } = visual || {};
    const title = useMemo(
        () => `${filename || ""}${extension ? `.${extension}` : ""}`,
        [filename, extension],
    );
    const visualObj = useMemo(() => Object.assign(Object.create(Visual.prototype), visual), [visual]);

    return (
        <Modal
            title={title}
            buttons={showDownloadButton ?
                [<Button
                    text={t(TK.General_Download)}
                    onClick={() => downloadVisual(visual)}
                />] :
                []
            }
            onHide={onHide}
            classNames="visual-modal"
            withoutPadding={true}
            withoutFooter={!showDownloadButton}
            zIndexBump={100}
        >
            <VisualView
                visual={visualObj}
            />
        </Modal>
    );
}

