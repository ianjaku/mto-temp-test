import * as React from "react";
import Modal, { ModalWidth } from "@binders/ui-kit/lib/elements/modal";
import WhoHasAccessConfig, { WhoHasAccessConfigProps } from "./WhoHasAccessConfig";
import Button from "@binders/ui-kit/lib/elements/button";
import { EditorItem } from "@binders/client/lib/clients/repositoryservice/v3/contract";
import { FlashMessages } from "../../../../logging/FlashMessages";
import { TranslationKeys as TK } from "@binders/client/lib/react/i18n/translations";
import { extractTitle } from "@binders/client/lib/clients/repositoryservice/v3/helpers";
import { useMemo } from "react";
import { useTranslation } from "@binders/client/lib/react/i18n";
import "./AccessModal.styl";

type Props = WhoHasAccessConfigProps & {
    acls;
    hidden: boolean;
    onHide: () => void;
    onUnmount: () => void;
    item: EditorItem;
}

const AccessModal: React.FC<Props> = (props) => {
    const { t } = useTranslation();
    const [accessBoxValidationErrors, setAccessBoxValidationErrors] = React.useState<string[]>([]);

    const buildOnRequestHide = (doValidate = false) => {
        return () => {
            if (doValidate) {
                if (accessBoxValidationErrors.length) {
                    FlashMessages.error([...accessBoxValidationErrors].pop());
                    return false;
                }
            }
            props.onHide();
        }
    }

    const onAccessBoxValidationErrorsUpdate = (errors: string[]) => {
        setAccessBoxValidationErrors(errors);
    }

    const documentTitle = useMemo(() => extractTitle(props.item), [props.item]);

    return (
        <Modal
            hidden={props.hidden}
            titleHtml={{
                base: t(TK.Acl_AccessSettingsForMobile, { document: documentTitle }),
                md: t(TK.Acl_AccessSettingsFor, { document: documentTitle })
            }}
            buttons={[
                <Button
                    text={t(TK.General_Done)}
                    onClick={buildOnRequestHide(true)}
                />
            ]}
            onHide={buildOnRequestHide()}
            onEscapeKey={buildOnRequestHide()}
            classNames="user-access-modal"
            withoutPadding={true}
            mobileViewOptions={{
                stretchX: { doStretch: true },
                stretchY: { doStretch: true, allowShrink: true, minTopGap: 0, maxTopGap: 150 },
                flyFromBottom: true,
            }}
            modalWidth={ModalWidth.Wide}
        >
            <WhoHasAccessConfig
                {...props}
                onAccessBoxValidationErrorsUpdate={onAccessBoxValidationErrorsUpdate}
            />
        </Modal>
    );
}
export default AccessModal;