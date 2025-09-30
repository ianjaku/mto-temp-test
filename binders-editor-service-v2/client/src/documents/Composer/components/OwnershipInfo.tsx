import * as React from "react";
import Tooltip, {
    TooltipPosition,
    hideTooltip,
    showTooltip
} from "@binders/ui-kit/lib/elements/tooltip/Tooltip";
import BinderClass from "@binders/client/lib/binders/custom/class";
import { EditorItem } from "@binders/client/lib/clients/repositoryservice/v3/contract";
import Icon from "@binders/ui-kit/lib/elements/icons";
import OwnershipModal from "../../../browsing/MyLibrary/document/OwnershipModal/OwnershipModal";
import { TK } from "@binders/client/lib/react/i18n/translations";
import { useRef } from "react";
import { useTranslation } from "@binders/client/lib/react/i18n";
import "./OwnershipInfo.styl";


const OwnersInfo: React.FC<{
    binder: BinderClass;
}> = ({ binder }) => {
    const [modalVisible, setModalVisible] = React.useState(false);
    const { t } = useTranslation();
    const triggerButtonTooltipRef = useRef(null);

    return (
        <>
            {modalVisible &&
                <OwnershipModal
                    onHide={() => {
                        setModalVisible(false);
                    }}
                    item={binder as unknown as EditorItem}
                />
            }
            <div className="composer-owners">
                <label
                    className="composer-owners-triggerBtn"
                    onClick={() => setModalVisible(true)}
                    onMouseEnter={(e) => showTooltip(e, triggerButtonTooltipRef.current, TooltipPosition.BOTTOM)}
                    onMouseLeave={(e) => hideTooltip(e, triggerButtonTooltipRef.current)}
                >
                    <Icon name="assignment_ind" />
                </label>
                <Tooltip ref={triggerButtonTooltipRef} message={t(TK.Edit_DocumentOwners_Tooltip)} />
            </div>
        </>
    );
};

export default OwnersInfo;
