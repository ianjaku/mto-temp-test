import * as React from "react";
import { TranslationKeys as TK } from "@binders/client/lib/react/i18n/translations";
import cx from "classnames";
import { useTranslation } from "@binders/client/lib/react/i18n";

// eslint-disable-next-line @typescript-eslint/no-empty-interface
interface Props {
    linkedUsersCount?: number;
}

const UserLinkerListTitle: React.FC<Props> = ({
    linkedUsersCount,
}) => {
    const { t } = useTranslation();
    return (
        <div className={cx("userLinker-section-title", "userLinker-section-title--flex")}>
            <label>
                {t(TK.User_UserLinkerLinkedUsers)}
            </label>
            <label className="userLinkerListTitleCount">
                {linkedUsersCount}
            </label>
        </div>
    )
}

export default UserLinkerListTitle;