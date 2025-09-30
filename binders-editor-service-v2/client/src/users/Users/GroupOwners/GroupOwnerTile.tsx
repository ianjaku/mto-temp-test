import * as React from "react";
import AddGroupOwnerModal from "./AddGroupOwnerModal";
import { GroupOwnerGroup } from "./contract";
import OwnersLabel from "./OwnersLabel";
import personAdd from "@binders/ui-kit/lib/elements/icons/PersonAdd";

interface Props {
    group: GroupOwnerGroup;
}

const GroupOwnerTile: React.FC<Props> = ({ group }) => {

    const [addModalVisible, setAddModalVisible] = React.useState(false);

    const onShowModal = (e: React.MouseEvent) => {
        e.stopPropagation(); // Prevent interaction with the modal's outside click listener
        setAddModalVisible(true);
    };
    const onHideModal = () => {
        setAddModalVisible(false);
    };

    return (
        <div className="groupOwnerTile">
            <label className="groupOwnerTile-name">
                {group.name}
            </label>
            <div onClick={onShowModal} className="groupOwnerTile-add">
                {group.owners?.length ?
                    (
                        <OwnersLabel owners={group.owners} />
                    ) :
                    (
                        <label className="groupOwnerTile-add-btn">
                            {personAdd()}
                        </label>
                    )}
            </div>
            {addModalVisible && (
                <AddGroupOwnerModal
                    group={group}
                    onRequestClose={onHideModal}
                />
            )}
        </div>
    )
}

export default GroupOwnerTile;