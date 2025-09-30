import * as React from "react";
import CircularProgress from "@binders/ui-kit/lib/elements/circularprogress";
import Close from "@binders/ui-kit/lib/elements/icons/Close";
import { useCallback } from "react";

interface Props {
    userRow: { label: string, id: string };
    onUnlinkUser: (userId: string) => Promise<void>;
}

const UserRow: React.FC<Props> = ({
    userRow,
    onUnlinkUser,
}) => {

    const [isLoading, setIsLoading] = React.useState(false);
    const onUnlink = useCallback(async (e: React.MouseEvent) => {
        e.stopPropagation();
        setIsLoading(true);
        await onUnlinkUser(userRow.id);
        setIsLoading(false);
    }, [onUnlinkUser, userRow]);

    return (
        <div className="userLinkerListRows-row">
            <label>
                {userRow.label}
            </label>
            <div className="userLinkerListRows-row-tail">
                {isLoading ?
                    CircularProgress() :
                    (
                        <div onClick={onUnlink} className="userLinkerListRows-row-tail-unlinkBtn">
                            <Close />
                        </div>
                    )}
            </div>
        </div>
    )
}

export default UserRow;