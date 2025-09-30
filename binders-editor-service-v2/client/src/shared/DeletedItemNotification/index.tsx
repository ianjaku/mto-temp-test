import * as React from "react";
import AccountStore from "../../accounts/store";
import Button from "@binders/ui-kit/lib/elements/button";
import { EditorItem } from "@binders/client/lib/clients/repositoryservice/v3/contract";
import { IParentItemsMap } from "../../trash/store";
import { PostRestoreAction } from "../../trash/actions";
import RestoreDeletedItemModal from "../../trash/RestoreDeletedItemModal";
import { TranslationKeys as TK } from "@binders/client/lib/react/i18n/translations";
import Warning from "@binders/ui-kit/lib/elements/icons/Warning";
import { fmtDateIso8601TimeLocalizedTZ } from "@binders/client/lib/util/date";
import { getUser } from "./actions";
import { isCollection } from "@binders/client/lib/clients/repositoryservice/v3/helpers";
import { useFluxStoreAsAny } from "@binders/client/lib/react/helpers/hooks";
import { useMyPermissionMapOrEmpty } from "../../authorization/hooks";
import { useTranslation } from "@binders/client/lib/react/i18n";
import "./DeletedItemNotification.styl";

const { useEffect, useState } = React;

interface IProps {
    item: EditorItem;
    parentItemsMap: IParentItemsMap;
    isTranslatorMode?: boolean;
}

const DeletedItemNotification: React.FC<IProps> = ({ item, parentItemsMap, isTranslatorMode }) => {

    const [isFacingRestore, setIsFacingRestore] = React.useState(false);
    const { t } = useTranslation();
    const accountId: string = useFluxStoreAsAny(AccountStore, (_prevState, store) => store.getActiveAccountId());
    const permissions = useMyPermissionMapOrEmpty();
    // deletedGroupdCollectionId exsists but its not equal to item id - means it was a child of recursively deleted collection
    const isChildFromRecursiveDelete = !!item.deletedGroupCollectionId && (item.id !== item.deletedGroupCollectionId);
    // deletedGroupdCollectionId exsists and its equal to item id - means it was recursively deleted collection
    const isRootOfRecursiveDelete = !!item.deletedGroupCollectionId && item.id === item.deletedGroupCollectionId;

    const [deletedByEmail, setDeletedByEmail] = useState("");

    useEffect(() => {
        if (!deletedByEmail && item.deletedById) {
            getUser(item.deletedById).then(user => setDeletedByEmail(user.login));
        }
    }, [deletedByEmail, item]);

    const msg = React.useMemo(() => {
        const { deletionTime } = item;
        if (!deletionTime) {
            return null;
        }
        return t(TK.Trash_DeletedItemInfoMsg, {
            item: (isCollection(item) ? t(TK.DocManagement_Col) : t(TK.DocManagement_Doc)).toLowerCase(),
            who: deletedByEmail,
            when: fmtDateIso8601TimeLocalizedTZ(new Date(item.deletionTime)),
        });
    }, [item, t, deletedByEmail]);

    const renderRestoreBtn = React.useCallback(() => {
        return (
            <Button
                onClick={() => setIsFacingRestore(true)}
                text={isRootOfRecursiveDelete ? t(TK.Trash_RestoreAll) : t(TK.Trash_RestoreTooltip)}
                secondary={true}
            />
        )
    }, [t, isRootOfRecursiveDelete]);

    const maybeRenderRestoreModal = React.useCallback(() => {
        return isFacingRestore ?
            (
                <RestoreDeletedItemModal
                    onCancel={() => setIsFacingRestore(false)}
                    itemFacingRestore={item}
                    activeAccountId={accountId}
                    parentItemsMap={parentItemsMap}
                    permissions={permissions}
                    postRestoreAction={PostRestoreAction.redirect}
                />
            ) :
            null;
    }, [accountId, isFacingRestore, item, parentItemsMap, permissions]);

    return (
        <>
            <div className="deletedItemNotification">
                {Warning()}
                <label>{msg}</label>
                {((!isChildFromRecursiveDelete) || !isTranslatorMode) && renderRestoreBtn()}
            </div>
            {maybeRenderRestoreModal()}
        </>
    )
}

export default DeletedItemNotification
