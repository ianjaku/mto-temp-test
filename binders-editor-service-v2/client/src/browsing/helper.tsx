import * as React from "react";
import Breadcrumbs, { IBreadcrumbItem } from "@binders/ui-kit/lib/elements/breadcrumbs";
import { DocumentCollection, EditorItem } from "@binders/client/lib/clients/repositoryservice/v3/contract";
import i18next, { useTranslation } from "@binders/client/lib/react/i18n";
import { BROWSE_ROUTE } from "./MyLibrary/routes";
import { History } from "history";
import ItemContextMenu from "../documents/ItemContextMenu";
import { TranslationKeys as TK } from "@binders/client/lib/react/i18n/translations";
import { getBinderMasterLanguage } from "@binders/client/lib/clients/repositoryservice/v3/helpers";

export const generatePathFromCollectionIds = (pathParams) => {
    const paths = pathParams.parentCollections.concat(pathParams.currentCollection);
    return paths.length > 0 ? `/${paths.map(name => name).join("/")}` : "";
};

/**
 * @param item {Binder | DocumentCollection}
 * @returns {string}
 */
export const extractTitleForBreadcrumb = (item) => {
    if (item.kind) {
        return item.kind === "collection" ?
            item.titles[0].title :
            getBinderMasterLanguage(item).storyTitle || i18next.t(TK.DocManagement_DocNew);
    }
    return `AV300-${item}`; // temp, for debugging purpose
}

const getLeafItem = (breadCrumbsPath) => {
    return breadCrumbsPath && breadCrumbsPath[breadCrumbsPath.length - 1];
}

export const BreadcrumbsSet = (props: {
    breadcrumbsPaths: DocumentCollection[][],
    activeItem: DocumentCollection,
    isForActive: boolean,
    history: History,
    modalPlaceholder: HTMLElement,
    inCompose: boolean,
    showMyLibraryLink: boolean,
    hideBreadcrumbsContextMenu: boolean,
    hideMyLibrary: boolean,
    hideRootCollection: boolean,
}) => {
    return (
        <div className="breadcrumbs-set">
            {props.breadcrumbsPaths.map((breadcrumbsPath, index) => <BreadcrumbsPath
                key={`bc-path-${index}`}
                breadcrumbsPath={breadcrumbsPath}
                activeItem={props.activeItem}
                isForActive={props.isForActive}
                history={props.history}
                modalPlaceholder={props.modalPlaceholder}
                inCompose={props.inCompose}
                showMyLibraryLink={props.showMyLibraryLink}
                hideBreadcrumbsContextMenu={props.hideBreadcrumbsContextMenu}
                hideMyLibrary={props.hideMyLibrary}
                hideRootCollection={props.hideRootCollection}
            />)}
        </div>
    );
}

const BreadcrumbsPath = (props: {
    breadcrumbsPath: DocumentCollection[],
    key: string,
    activeItem: DocumentCollection,
    isForActive: boolean,
    history: History,
    modalPlaceholder: HTMLElement,
    inCompose: boolean,
    showMyLibraryLink: boolean,
    hideBreadcrumbsContextMenu: boolean,
    hideMyLibrary: boolean,
    hideRootCollection: boolean,
}) => {
    const { t } = useTranslation();
    const items = props.breadcrumbsPath.reduce<IBreadcrumbItem[]>(
        (prev, curr) => {
            if (props.hideRootCollection && curr.isRootCollection) return [...prev];
            return [...prev, {
                link: `${prev.at(-1).link}/${curr.id}`,
                name: extractTitleForBreadcrumb(curr),
                readonly: curr.readonly || !!curr.deletionTime,
                strikeThrough: curr.kind === "collection" && !!curr.deletionTime,
                tooltip: curr.deletionTime && curr.kind === "collection" ? t(TK.Trash_CollectionDeletedTooltip) : undefined,
            }];
        },
        props.hideMyLibrary ?
            [{ name: "", link: BROWSE_ROUTE }] :
            [{ name: t(TK.myLibrary), link: BROWSE_ROUTE }]
    );

    const parentItems = props.breadcrumbsPath.filter(itm => itm.kind === "collection");
    const leafItem = getLeafItem(props.breadcrumbsPath);
    const isCollectionLeaf = leafItem && leafItem.kind === "collection";
    const parentCount = isCollectionLeaf ? props.breadcrumbsPath.length - 1 : props.breadcrumbsPath.length;

    if (parentCount === 0 && items.length === 1) {
        items[0].renderAsLast = true;
    }
    const itemContextMenu = props.activeItem && !props.hideBreadcrumbsContextMenu && <BreadcrumbsItemContextMenu
        item={props.activeItem}
        getParentItems={async () => props.isForActive ? parentItems.slice(0, parentCount) : parentItems}
        isForActive={props.isForActive}
        history={props.history}
        modalPlaceholder={props.modalPlaceholder}
        livesInLibraryItem={false}
        inCompose={props.inCompose}
        showMyLibraryLink={props.showMyLibraryLink}
        hideRootCollection={props.hideRootCollection}
    />;

    return (
        <Breadcrumbs
            items={items}
            itemContextMenu={itemContextMenu}
        />
    );
}

export const BreadcrumbsItemContextMenu = (props: {
    item: DocumentCollection,
    getParentItems: () => Promise<EditorItem[]>,
    isForActive?: boolean,
    history: History,
    modalPlaceholder: HTMLElement,
    livesInLibraryItem?: boolean,
    inCompose?: boolean,
    showMyLibraryLink?: boolean,
    hideRootCollection: boolean,
}) => {
    if (!props.modalPlaceholder) return null;
    return (
        <ItemContextMenu
            key="breadcrumbs-icm"
            item={withKind(props.item)}
            history={props.history}
            modalPlaceholder={props.modalPlaceholder}
            getParentItems={props.getParentItems}
            isForActive={props.isForActive}
            livesInLibraryItem={props.livesInLibraryItem ?? true}
            inCompose={props.inCompose}
            showMyLibraryLink={props.showMyLibraryLink}
        />
    );
}

const withKind = (binder) => {
    return {
        ...binder,
        kind: binder.kind || "document",
    };
}

export function extractItemFromBreadcrumbsPaths(breadcrumbsPaths: DocumentCollection[][], itemId: string): DocumentCollection {
    for (const breadCrumbsPath of breadcrumbsPaths) {
        for (const item of breadCrumbsPath) {
            if (item.id === itemId) {
                return item;
            }
        }
    }
}

export const toTitlePath = (breadcrumbsPath) => (
    breadcrumbsPath
        .map((item, i) => `${extractTitleForBreadcrumb(item)}${i < breadcrumbsPath.length - 1 ? " > " : ""}`)
        .join("")
)

export function buildAclsList(permissions, accountRoles) {
    //todo: I'm not sure what's going on here - but I tried to make as generic as I could
    return permissions && permissions.reduce((allAcls, permission) => {
        const role = accountRoles.find(role => role.roleId === permission.roleId);
        if (role) {
            const { name: roleName } = role;
            if (!allAcls[roleName]) {
                allAcls[roleName] = permission.aclId;
            }
        }
        return allAcls;
    }, {});
}

export function withoutScheme(url) {
    return url
        .replace(/^(http:\/\/)/, "")
        .replace(/^(https:\/\/)/, "");
}

// items Array<Document|Collection>
// returns Array<{ id: string; parentItemsIds: string[] }>
export function makeItemsParentMap(items) {
    return items.map(document => ({
        id: document.id,
        parentItemsIds: (document.parentCollectionSummaries || []).reduce((out, parents) => ([
            ...out,
            ...parents.map(p => p.id),
        ]), []),
    }));
}
