import * as React from "react";
import { TranslationKeys as TK } from "@binders/client/lib/react/i18n/translations";
import { User } from "@binders/client/lib/clients/userservice/v1/contract";
import { getUserName } from "@binders/client/lib/clients/userservice/v1/helpers";
import { useMemo } from "react";
import { useTranslation } from "@binders/client/lib/react/i18n";

interface Props {
    owners: User[];
}

const OwnersLabel: React.FC<Props> = ({ owners }) => {

    const { t } = useTranslation();

    const [visibleOwners, notOnScreenCount] = useMemo(() => {
        const visibleOwners = owners.slice(0, 2);
        const notOnScreenCount = owners.length - visibleOwners.length;
        return [visibleOwners, notOnScreenCount];
    }, [owners]);

    if (!owners?.length) {
        return null;
    }

    return (
        <div className="groupOwnerTile-ownersLabel">
            <label>
                {`${t(TK.User_GroupOwners_Owners)}: `}
            </label>
            <label className="groupOwnerTile-ownersLabel-owner">
                {visibleOwners.map(u => getUserName(u)).join(", ")}
            </label>
            {notOnScreenCount > 0 && (
                <label className="groupOwnerTile-ownersLabel-owner">
                    {` +${notOnScreenCount}`}
                </label>
            )}
        </div>
    )
}

export default OwnersLabel;