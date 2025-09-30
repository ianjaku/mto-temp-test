import * as React from "react";
import { APILoadCollection, APILoadItems } from "../../documents/api";
import { Binder, DocumentCollection } from "@binders/client/lib/clients/repositoryservice/v3/contract";
import { PermissionMap, PermissionName } from "@binders/client/lib/clients/authorizationservice/v1/contract";
import TreeNavigator, { ITreeNavigatorItem, takeLast } from "@binders/ui-kit/lib/elements/treenavigator";
import AccountStore from "../../accounts/store";
import { TFunction } from "@binders/client/lib/i18n";
import { TranslationKeys as TK } from "@binders/client/lib/react/i18n/translations";
import { filterPermissionsWithRestrictions } from "../../authorization/tsHelpers";
import { getItemIdsFromPermissionMap } from "../../authorization/helper";
import { useMyPermissionMapOrEmpty } from "../../authorization/hooks";
import { withHooks } from "@binders/client/lib/react/hooks/withHooks";
import { withTranslation } from "@binders/client/lib/react/i18n";

function takeAllButLast<T>(arr: T[]): T[] {
    return arr.slice(0, arr.length - 1);
}

interface TreeNavigatorProps {
    allowRootSelection?: boolean;
    collectionsOnly?: boolean;
    disableItemCheck?: (item: { id: string, kind?: string }, parentIdsPath: string[]) => boolean;
    includeAllItems?: boolean;
    itemFilter?: (item: { id: string, isSoftDeleted?: boolean }) => boolean;
    onSelect: (docId: string, domainId?: string, parentPath?: string[], name?: string, kind?: string) => void;
    onLoadingChange?: (isLoading: boolean) => void;
    parentItems: ITreeNavigatorItem[];
    permissionMap: PermissionMap[];
    t: TFunction;
    targetAccountId?: string;
    restrictToAdminOnlyPermission?: boolean;
}

interface TreeNavigatorState {
    childrenItems: ITreeNavigatorItem[];
    parentItems: ITreeNavigatorItem[];
    previouslySelected: string | undefined;
    rootItems: ITreeNavigatorItem[];
    showWarning: boolean;
}

class WiredTreeNavigator extends React.Component<TreeNavigatorProps, TreeNavigatorState> {

    constructor(props: TreeNavigatorProps) {
        super(props);
        this.state = {
            childrenItems: undefined,
            parentItems: props.parentItems.map(itm => ({ ...itm, kind: "collection" })) || [],
            rootItems: undefined
        } as TreeNavigatorState;
        this.loadNewCollection = this.loadNewCollection.bind(this);
        this.onNavigate = this.onNavigate.bind(this);
        this.onSelect = this.onSelect.bind(this);
    }

    async componentDidMount() {
        await this.loadRootItems();
        await this.loadNewCollection(this.props.parentItems);
    }

    componentDidUpdate(prevProps: TreeNavigatorProps) {
        const { parentItems } = this.props;
        const { parentItems: prevParentItems } = prevProps;
        if (parentItems !== prevParentItems) {
            this.setState({
                parentItems,
            });
        }
    }

    async loadRootItems() {
        const restrictionlessPermissionMap = filterPermissionsWithRestrictions(this.props.permissionMap);
        const allowedPermissions = this.props.restrictToAdminOnlyPermission ?
            [PermissionName.ADMIN] :
            [PermissionName.ADMIN, PermissionName.EDIT];
        const itemIds = getItemIdsFromPermissionMap(restrictionlessPermissionMap, allowedPermissions);
        const rootItems = await this.loadItems(itemIds, []);
        this.setState({
            rootItems
        });
    }

    async loadNewCollection(collectionPath: TreeNavigatorState["parentItems"]): Promise<void> {
        if (!collectionPath || collectionPath.length === 0) {
            this.props.onLoadingChange?.(false);
            return;
        }
        const { targetAccountId } = this.props;
        const colId = takeLast(collectionPath).id
        this.props.onLoadingChange?.(true);
        const collection = await APILoadCollection(colId, targetAccountId);
        const collectionsInside = collection.elements
            .filter(({ kind }) => this.props.includeAllItems ? true : kind === "collection")
            .map(({ key }) => key);
        const childrenItems = await this.loadItems(collectionsInside, collectionPath.map(({ id }) => id));
        this.setState({
            childrenItems
        });
        this.props.onLoadingChange?.(false);
    }

    async loadItems(ids: string[], parentIdsPath: string[]) {
        const { targetAccountId } = this.props;
        const accountId = targetAccountId || AccountStore.getActiveAccountId();
        const collectionItems = await APILoadItems(ids, accountId);
        const childrenItems = collectionItems
            .filter(item => this.props.includeAllItems ? true : item["kind"] === "collection")
            .map(({ id, ...item }) => {
                if (item["kind"] === "collection") {
                    return ({
                        id,
                        domainCollectionId: (item as DocumentCollection).domainCollectionId,
                        name: (item as DocumentCollection).titles[0].title,
                        kind: "collection",
                        isSoftDeleted: item.deletionTime != null
                    });
                }
                return ({ id, name: (item as Binder).languages[0].storyTitle || this.props.t(TK.DocManagement_NoTitle), kind: "binder", isSoftDeleted: item.deletionTime != null });
            });
        let filteredItems = this.props.itemFilter ? childrenItems.filter(this.props.itemFilter) : childrenItems;

        const { disableItemCheck } = this.props;
        if (disableItemCheck) {
            filteredItems = filteredItems.map(item => ({
                ...item,
                disabled: disableItemCheck(item, parentIdsPath),
            }))
        }
        // Make sure we preserve order (MT-418)
        return filteredItems.sort((left, right) => ids.indexOf(left.id) - ids.indexOf(right.id));
    }

    onNavigate(item: ITreeNavigatorItem, isBack: boolean): void {
        let parentItems: ITreeNavigatorItem[];
        // if you are going deeper into collections we expand parent list with currently clicked,
        // if we go back - we shorten it with the last element
        if (isBack) {
            parentItems = takeAllButLast(this.state.parentItems) || [];
            this.setState({
                parentItems,
                childrenItems: undefined
            });
        } else {
            parentItems = [...this.state.parentItems, item];
            this.setState({
                parentItems,
                childrenItems: undefined
            });
        }
        const { disableItemCheck } = this.props;
        const parentItemIds = parentItems.map(({ id }) => id).filter(itemId => itemId !== item.id);
        const canISelectItem = (disableItemCheck && !disableItemCheck(item, parentItemIds)) || !disableItemCheck;
        if (canISelectItem) {
            this.onSelect(item.id, parentItems, item.name, item.kind);
        }
        this.loadNewCollection(parentItems);
    }

    onSelect(collectionId: string, parentItems: ITreeNavigatorItem[], name: string, kind: string) {
        const { disableItemCheck } = this.props;
        const parentItemIds = parentItems.map(({ id }) => id).filter(itemId => itemId !== collectionId);
        const canISelectItem = (disableItemCheck && !disableItemCheck({ id: collectionId, kind }, parentItemIds)) || !disableItemCheck;
        if (!canISelectItem) {
            return;
        }
        this.setState({
            showWarning: false,
            parentItems,
            previouslySelected: collectionId,
        });
        if (this.props.onSelect) {
            if (collectionId === undefined) {
                return this.props.onSelect(collectionId, undefined, [], name, kind);
            }
            const collectionParentPath = [];
            for (let i = 0; i < parentItems.length; i++) {
                const parentId = parentItems[i].id;
                if (collectionId === parentId) {
                    break;
                }
                collectionParentPath.push(parentId);
            }
            const showingItems = [...this.state.childrenItems || [], ...parentItems || [], ...this.state.rootItems || []];
            const item = showingItems.find(itm => itm.id === collectionId);
            const domainCollectionId: string | undefined = (item && item["domainCollectionId"]) || undefined;
            this.props.onSelect(collectionId, domainCollectionId, collectionParentPath, name, kind);
        }
    }

    canISelectRoot(parentItems: TreeNavigatorState["parentItems"]): string | undefined {
        const { disableItemCheck } = this.props;
        if (parentItems.length > 0) {
            const parentItemsIds = parentItems.map(({ id }) => id);
            if ((disableItemCheck && !disableItemCheck(parentItems[parentItems.length - 1], parentItemsIds) || !disableItemCheck)) {
                const selected = parentItems[parentItems.length - 1].id;
                this.setState({
                    previouslySelected: selected,
                });
                return selected;
            }
        }
        return undefined;
    }

    render() {
        const { parentItems, rootItems, previouslySelected, childrenItems } = this.state;
        const selectedId = previouslySelected || this.canISelectRoot(parentItems);
        return <TreeNavigator
            parentItems={parentItems}
            items={childrenItems}
            rootItems={rootItems}
            onNavigate={(item: ITreeNavigatorItem, isBack: boolean) => this.onNavigate(item, isBack)}
            onSelect={this.onSelect}
            selectedId={selectedId}
            collectionsOnly={this.props.collectionsOnly}
        />
    }

}

const WiredTreeNavigatorWithHooks = withHooks(WiredTreeNavigator, () => ({
    permissionMap: useMyPermissionMapOrEmpty(),
}))
export default withTranslation()(WiredTreeNavigatorWithHooks);
