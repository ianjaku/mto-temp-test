import * as pathFn from "path";
import { BinderStoreGetters, getBinderStoreActions } from "./stores/zustand/binder-store";
import { getBrowsedCollection, getPurePath, isBrowseSubpath, toFullPath } from "./util";
import ManualToRoutes from "@binders/client/lib/util/readerRoutes";
import { buildNestedCollectionsPath } from "./utils/routes";
import { getReaderDomain } from "./util";
import { isProduction } from "@binders/client/lib/util/environment";

export function navigateToUserSettings(browserHistory) {
    browserHistory.push(toFullPath(ManualToRoutes.USER_SETTINGS));
}

export function navigateToHome(history) {
    if (history) {
        history.push(toFullPath("/"));
    } else {
        window.location.href = toFullPath("/", { includeCurrentQueryString: true })
    }
}

export function navigateToContentNotFound(history) {
    history.push(toFullPath(ManualToRoutes.NOT_FOUND));
}

export function navigateToBrowsePath(history, parentPath = []) {
    const path = [ManualToRoutes.BROWSE].concat(parentPath).join("/");
    history.push(toFullPath(path));
}

export function navigateToLaunchPath(history, binderId, queryParams = {}) {
    const params = new URLSearchParams(queryParams);
    const paramsStr = params ? `?${params.toString()}` : "";
    history.push(toFullPath(`${ManualToRoutes.LAUNCH}/${binderId}${paramsStr}`));
}

export function switchToSummary(browserHistory, binderId, languageCode, jumpToText) {

    const path = window.location.pathname;
    const collectionPath = isBrowseSubpath(path) ?
        getBrowsedCollection(path) :
        getPurePath(path, true);
    let launchPath;
    if (collectionPath) {
        launchPath = `${ManualToRoutes.LAUNCH}/${collectionPath}/${binderId}`;
    } else {
        launchPath = `${ManualToRoutes.LAUNCH}/${binderId}`;
    }
    const url = toFullPath(launchPath);
    const suffixes = [];
    if (languageCode) {
        suffixes.push(`lang=${languageCode}`);
    }
    if (jumpToText) {
        suffixes.push(`jumpToText=${encodeURI(jumpToText)}`)
    }
    if (!isProduction()) {
        suffixes.push(`domain=${getReaderDomain()}`);
    }
    const suffix = suffixes.length > 0 ? `?${suffixes.join("&")}` : "";
    browserHistory.push(`${url}${suffix}`);
}

export async function browseCollection(browserHistory, collectionId) {
    const ancestors = BinderStoreGetters.getCollectionAncestors();
    let parentIds;
    if (ancestors && ancestors.length > 0) {
        const ancestorToUse = ancestors[0];
        parentIds = ancestorToUse.parentPaths.map(item => item.id);
    } else {
        parentIds = [];
    }
    const path = toFullPath(pathFn.join(ManualToRoutes.BROWSE, ...parentIds, collectionId));
    browserHistory.push(path);
}

export function switchToReader(browserHistory, publicationId) {
    const newPath = buildNewPath(publicationId, "read");
    if (!newPath) return;
    browserHistory.push(newPath);
}

export function switchToLauncher(browserHistory, item) {
    if (item.kind === "summary") {
        switchToSummary(browserHistory, item.original.id);
        return;
    }
    switchToCollection(browserHistory, item.original.id);
}

function buildNewPath(id, prefix, parentCollectionDefault) {
    const parentCollectionInfo = parentCollectionDefault || BinderStoreGetters.getActiveCollectionInfo();
    return buildNestedCollectionsPath(parentCollectionInfo, id, prefix);
}

function switchToCollection(browserHistory, collectionId) {
    const parentCollectionInfo = BinderStoreGetters.getActiveCollectionInfo();
    getBinderStoreActions().unsetActiveCollection();
    const newPath = buildNewPath(collectionId, "browse", parentCollectionInfo);
    browserHistory.push(newPath);
}
