import * as React from "react";
import { APIFindItems, APIGetItemsAncestors } from "../../binders/loader";
import { Binder, CollectionTitle, DocumentCollection, Story } from "@binders/client/lib/clients/repositoryservice/v3/contract";
import { PermissionMap, PermissionName } from "@binders/client/lib/clients/authorizationservice/v1/contract";
import {
    compose,
    intersection,
    length,
    maxBy,
    reduce,
    uniq
} from "ramda";
import Breadcrumbs from "@binders/ui-kit/lib/elements/breadcrumbs";
import { StoryTile } from "../../binders/contract";
import { TranslationKeys } from "@binders/client/lib/react/i18n/translations";
import i18n from "@binders/client/lib/react/i18n";

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export function toStoryTile(item): StoryTile {
    let icon: string;
    if (item.kind === "collection" || item.kind === "collectionsummary") {
        icon = "far fa-folder-open";
    }
    let languageCode = "xx";
    if (item.kind === "collectionsummary") {
        const collection = item.original;
        const title = item.title;
        const titleInfo = collection?.titles.find(ti => ti.title === title) ??
            collection?.titles[0] ??
            { languageCode: "xx" }
        languageCode = titleInfo.languageCode
    }
    if (item.kind === "summary") {
        const summary = item.original;
        const title = item.title;
        const languages = summary?.languages ?? [];
        const language = languages.find(l => l.storyTitle === title) ??
            languages[0] ??
            {iso639_1: "xx"};
        languageCode = language.iso639_1;
    }
    return Object.assign({ icon, languageCode }, item);
}

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types,@typescript-eslint/no-explicit-any
export const browseInfoFromRouteParams = (routeParams: any) => {
    const splat = routeParams[0];
    const parentCollections = splat ? splat.split("/") : [];
    const currentCollection = routeParams.collectionId;
    const currentDocument = routeParams.binderId;
    return {
        parentCollections,
        currentCollection,
        currentDocument
    }
}

const composePaths = async (itemId) => {
    const ancestors = await APIGetItemsAncestors([itemId]);
    const composedPaths = populatePaths(
        [
            {
                pathArray: [itemId],
                finished: false
            }
        ],
        ancestors);
    return composedPaths.map(path => path.pathArray.reverse());
}

const populatePaths = (paths, ancestors) => {
    const unfinishedPaths = paths.filter(p => !p.finished);
    if (unfinishedPaths.length === 0) {
        return paths;
    }
    unfinishedPaths.forEach(path => {
        const itemId = path.pathArray[path.pathArray.length - 1];
        const parents = ancestors[itemId];
        switch (parents.length) {
            case 0:
                path.finished = true;
                break;
            case 1:
                path.pathArray.push(parents[0]);
                break;
            default:
                paths = paths.filter(p => p.pathArray !== path.pathArray);
                parents.forEach(parent => {
                    paths.push({
                        pathArray: path.pathArray.concat(parent),
                        finished: false
                    })
                });
        }
    });
    return populatePaths(paths, ancestors);
}


export const getItemIdsFromPermissionMap = (permissions: PermissionMap[], permissionNames: PermissionName[]): string[] => {
    const filtered = permissionNames ?
        permissions.filter(p => permissionNames.indexOf(p.permission) > -1) :
        permissions;
    return uniq(filtered.reduce(
        (res, { resources }) => [...res, ...resources.reduce(
            (prev, { ids }) => [...prev, ...ids],
            [])],
        []));
}


const trimPathToAllowedWithInfo = (idPath, permissions) => {
    const colsWithReadPermissions = getItemIdsFromPermissionMap(permissions, [PermissionName.VIEW]);
    const { path } = idPath.reduce((reduced, id) => {
        const { path, readOnlyMode, editMode } = reduced;
        if (readOnlyMode || colsWithReadPermissions.indexOf(id) > -1) {
            path.push({
                id,
                readonly: false,
            });
            return { path, readOnlyMode: true, editMode };
        }
        return {
            path,
            readOnlyMode,
            editMode
        };
    }, { path: [], readOnlyMode: false, editMode: false });
    if(path.length === 0 ){
        const last = idPath[idPath.length - 1];
        return last ? [{id: last}] : [];
    }
    return path;
}
const idPathToItemPath = (idPathWithInfo, usedItems) => {
    return idPathWithInfo.reduce((reduced, { id, readonly }) => {
        const item = usedItems.find(i => i.id === id) || id;
        if (item) {
            if (item.id !== undefined) {
                item.readonly = readonly;
            }
            reduced.push(item);
        }
        return reduced;
    }, []);
}

export interface BrowseInfo {
    currentCollection?: string;
    parentCollections?: string[];
}

export const loadBrowseContext = async (browseInfo: BrowseInfo, permissions: PermissionMap[], accountId: string): Promise<Array<Binder | DocumentCollection | string>> => {
    const { parentCollections, currentCollection } = browseInfo;
    if (!currentCollection) {
        return [];
    }
    const activeItemId = currentCollection;
    const idPaths = await composePaths(activeItemId);
    // special failsafe for instances. so we do not too much
    const chooseMaxIntersectionPart = reduce(maxBy(compose(length,intersection(parentCollections))), [])
    const maxCommonPart = parentCollections[0] === "" ? idPaths[0] :  chooseMaxIntersectionPart(idPaths);
    const allowedIdPathWithInfo = permissions ? trimPathToAllowedWithInfo(maxCommonPart, permissions) : [];
    // can happen for public access ( browse/colA, where only colA public)
    if(allowedIdPathWithInfo.length === 0) {
        return [];
    }
    const usedItems = await APIFindItems(allowedIdPathWithInfo.map(({id}) => id), accountId);
    if (usedItems.find(i => i.id === currentCollection) === undefined) {
        return [];
    }
    const browsePath = idPathToItemPath(allowedIdPathWithInfo, usedItems);
    return browsePath;

}

function getPreferredTitleObject(
    titles: Array<CollectionTitle>,
    languageCodes: string[] = [],
): CollectionTitle {
    for (const languageCode of languageCodes) {
        const titleObject = titles.find(l => l.languageCode === languageCode);
        if (titleObject != null) return titleObject;
    }
    return titles[0];
}

export const extractTitleForBreadcrumb = (collection: Story | string, prioLanguageCodes?: string[]): string => {
    if (typeof collection === "string") {
        return "";
    }
    return getPreferredTitleObject(
        (collection as DocumentCollection).titles,
        prioLanguageCodes
    )?.title;
}

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types,@typescript-eslint/no-explicit-any
export const renderBreadcrumbs = (breadcrumbsPath: any, prioLanguages: string[]): React.ReactNode => {
    const items = breadcrumbsPath.reduce((prev, curr, i) => {
        return [...prev, {
            link: `${prev[i].link}/${curr.id}`,
            name: extractTitleForBreadcrumb(curr, prioLanguages),
            readonly: curr.readonly,
        }];
    }, [{
        name: i18n.t(TranslationKeys.myLibrary),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        link: `${(window as any).bindersConfig.pathPrefix || ""}/browse`,
    }]);
    return <Breadcrumbs key={"bcs"} items={items} itemContextMenu={<span/>} />;// it's needed for keeping dots (...) on left for longer breadcrumbs
};

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types,@typescript-eslint/no-explicit-any
export const renderBreadcrumbsSet = (breadcrumbsPath: any, prioLanguages: string[]): React.ReactNode => {
    return (
        <div className="breadcrumbs-set">
            {breadcrumbsPath && renderBreadcrumbs(breadcrumbsPath, prioLanguages)}
        </div>
    );
};