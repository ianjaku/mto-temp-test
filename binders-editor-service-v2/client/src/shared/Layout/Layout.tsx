import * as React from "react";
import { Children, cloneElement, useEffect, useMemo } from "react";
import type { DetailedReactHTMLElement, FC, ReactChildren } from "react";
import {
    DocumentCollection,
    EditorItem
} from "@binders/client/lib/clients/repositoryservice/v3/contract";
import {
    FEATURE_DEBUG_LOGGING,
    FEATURE_READONLY_EDITOR
} from "@binders/client/lib/clients/accountservice/v1/contract";
import { getItemIdsFromPermissionMap, permissionsFoundInPath } from "../../authorization/helper";
import {
    useActiveBrowsePathOrDefault,
    useActiveCollection,
    useActiveDocument,
    useBrowsePathsOrDefault
} from "../../browsing/hooks";
import { useRibbonsBottomHeight, useRibbonsTopHeight } from "@binders/ui-kit/lib/compounds/ribbons/hooks";
import { BreadcrumbsSet } from "../../browsing/helper";
import type { BrowseInfoFn } from "../../browsing/MyLibrary/routes";
import DebugLog from "@binders/client/lib/util/debugLogging";
import { ErrorFullPage } from "../../application/error";
import {
    IPermissionFlag
} from "@binders/client/lib/clients/authorizationservice/v1/contract";
import { PermissionName } from "@binders/client/lib/clients/authorizationservice/v1/contract";
import type { RouteComponentProps } from "react-router";
import { TranslationKeys as TK } from "@binders/client/lib/react/i18n/translations";
import { clearActiveBinder } from "../../documents/actions/loading";
import { loadBrowseContext } from "../../browsing/actions";
import { useActiveAccountFeatures } from "../../accounts/hooks";
import { useActiveItem } from "../hooks/useActiveItem";
import { useBrowseStore } from "../../stores/browse-store";
import { useMyPermissionMapOrEmpty } from "../../authorization/hooks";
import { usePermissionFlags } from "../../documents/Composer/hooks/usePermissionFlags";
import { useTranslation } from "@binders/client/lib/react/i18n";
import "./layout.styl";

export const Layout: FC<RouteComponentProps<{ documentId?: string; collectionId?: string; scopeCollectionId?: string }> & {
    breadcrumbsClassName?: string;
    browseInfoFromRouteParams: BrowseInfoFn;
    children: JSX.Element | JSX.Element[];
    className?: string;
    cloneBreadcrumbsPaths?: boolean;
    containerClassName?: string;
    delayBreadcrumbsActivation?: boolean;
    hideBreadcrumbs?: boolean;
    hideBreadcrumbsContextMenu?: boolean;
    inCompose?: boolean;
    innerContainerClassName?: string;
    modalPlaceholder: HTMLElement;
    showMyLibraryLink?: boolean;
}> = props => {
    const {
        breadcrumbsClassName,
        browseInfoFromRouteParams,
        className,
        containerClassName,
        delayBreadcrumbsActivation,
        hideBreadcrumbs,
        hideBreadcrumbsContextMenu,
        history,
        inCompose,
        innerContainerClassName,
        match: { params: matchParams },
        modalPlaceholder,
        showMyLibraryLink,
    } = props;

    const accountFeatures = useActiveAccountFeatures();
    const activeCollection = useActiveCollection();
    const activeDocument = useActiveDocument();
    const breadcrumbsPaths = useBrowsePathsOrDefault(null);
    const browseContext = useActiveBrowsePathOrDefault([]);
    const permissionMap = useMyPermissionMapOrEmpty();
    const ribbonsBottomheight = useRibbonsBottomHeight();
    const ribbonsTopHeight = useRibbonsTopHeight();
    const { t } = useTranslation();

    const isReadonlyEditor = accountFeatures.includes(FEATURE_READONLY_EDITOR);

    const editableItemIds = useMemo(() => {
        const relevantPermissions = isReadonlyEditor ?
            [PermissionName.ADMIN, PermissionName.EDIT, PermissionName.VIEW] :
            [PermissionName.ADMIN, PermissionName.EDIT];
        return getItemIdsFromPermissionMap(permissionMap, relevantPermissions);
    }, [permissionMap, isReadonlyEditor]);

    const browseInfo = useMemo(
        () => browseInfoFromRouteParams(matchParams),
        [browseInfoFromRouteParams, matchParams]
    );

    const permissionFlags = usePermissionFlags(browseInfo.currentDocument, browseInfo.currentCollection);

    const newActiveCollection = browseInfo.currentCollection || null;
    const newActiveDocument = browseInfo.currentDocument;
    const newActiveParentCollections = browseInfo.parentCollections;

    const hasNewCollection = activeCollection !== newActiveCollection;
    const hasNewDocument = activeDocument !== newActiveDocument;

    useEffect(() => {
        if (!hasNewCollection && !hasNewDocument) return;
        useBrowseStore.getState().setActiveCollection(newActiveCollection);
    }, [hasNewCollection, hasNewDocument, newActiveCollection]);

    useEffect(() => {
        if (!hasNewCollection && !hasNewDocument) return;
        useBrowseStore.getState().setActiveDocument(newActiveDocument);
    }, [hasNewCollection, hasNewDocument, newActiveDocument]);

    useEffect(() => {
        if (!hasNewCollection && !hasNewDocument) return;
        useBrowseStore.getState().setActiveParentCollections(newActiveParentCollections);
    }, [hasNewCollection, hasNewDocument, newActiveParentCollections]);

    useEffect(() => {
        if (!browseInfo) return;
        loadBrowseContext(browseInfo, !delayBreadcrumbsActivation, permissionMap, isReadonlyEditor);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [JSON.stringify({ browseInfo, delayBreadcrumbsActivation, isReadonlyEditor, permissionMap })])

    useEffect(() => {
        return () => {
            clearActiveBinder();
        }
    }, []);

    const adminPermissions = permissionMap.filter(p => p.permission === PermissionName.ADMIN);
    const editPermissions = permissionMap.filter(p => p.permission === PermissionName.EDIT);
    const viewPermissions = permissionMap.filter(p => p.permission === PermissionName.VIEW);

    // take all possible ancestors ids (breadcrumbsData can be nested because of instances)
    const allBreadcrumbItemIds = useMemo(() => {
        if (!breadcrumbsPaths) return [];
        // NOTE(rel-february-25): casting is intentional, as it renders null on some accounts
        const ids = breadcrumbsPaths.flatMap(bcs => bcs.map(bc => (bc.id || bc) as string).filter(Boolean));
        return Array.from(new Set(ids));
    }, [breadcrumbsPaths]);

    const canIEdit = permissionsFoundInPath(editableItemIds, editPermissions);
    const canIView = permissionsFoundInPath(allBreadcrumbItemIds, viewPermissions);
    const canIAdmin = permissionsFoundInPath(allBreadcrumbItemIds, adminPermissions);

    const hasBreadcrumbs = allBreadcrumbItemIds.length > 0
    const editingDisabled = !isReadonlyEditor && !canIEdit;
    const viewingDisabled = isReadonlyEditor && !canIView;

    // we show blank screen if readonly editor feature flag is off and user doesn't have edit rights
    // or feature flag on and user doesn't have view rights
    if (hasBreadcrumbs && (editingDisabled || viewingDisabled)) {
        if (accountFeatures.includes(FEATURE_DEBUG_LOGGING)) {
            DebugLog.log(`rendering null: ${JSON.stringify({
                canIEdit, canIView, canIAdmin, hasBreadcrumbs, isReadonlyEditor, editingDisabled, viewingDisabled,
            })}`, "layout-tsx");
            const breadcrumbsPathsDebug = breadcrumbsPaths.flatMap(
                bcs => bcs.map(bc => bc.id ? { id: bc.id } : bc)
            );
            DebugLog.log(`breadcrumbsPaths: ${JSON.stringify(breadcrumbsPathsDebug)}`, "layout-tsx");
        }
        return <ErrorFullPage />;
    }

    return (
        <div
            className={`layout ${className}`}
            style={{
                marginTop: `${ribbonsTopHeight}px`,
                marginBottom: `${ribbonsBottomheight}px`,
            }}
        >
            {!hideBreadcrumbs && (
                <div className="myLibrary-topBar container-inner">
                    <div>
                        <h2>{t(TK.myLibrary)}</h2>
                        <div className={`breadcrumbs-viewer ${breadcrumbsClassName}`}>
                            <div className="breadcrumbs-wrapper">
                                <Breadcrumbs
                                    breadcrumbsPaths={breadcrumbsPaths}
                                    hideBreadcrumbsContextMenu={hideBreadcrumbsContextMenu}
                                    history={history}
                                    inCompose={inCompose}
                                    modalPlaceholder={modalPlaceholder}
                                    showMyLibraryLink={showMyLibraryLink}
                                    hideMyLibrary={false}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            )}
            <div className={containerClassName || ""}>
                <LayoutChildren
                    breadcrumbsPaths={breadcrumbsPaths ?? [[]]}
                    browseContext={browseContext}
                    canIAdmin={canIAdmin}
                    children={props.children}
                    className={innerContainerClassName ? "container-inner layout-body" : undefined}
                    cloneBreadcrumbsPaths={props.cloneBreadcrumbsPaths}
                    permissionFlags={permissionFlags}
                />
            </div>
        </div>
    );
}

type BreadcrumbsProps = {
    breadcrumbsPaths: DocumentCollection[][];
    hideBreadcrumbsContextMenu?: boolean;
    history: RouteComponentProps["history"];
    inCompose?: boolean;
    modalPlaceholder: HTMLElement;
    showMyLibraryLink?: boolean;
    hideMyLibrary: boolean;
}

const Breadcrumbs: FC<BreadcrumbsProps> = ({
    breadcrumbsPaths,
    hideBreadcrumbsContextMenu,
    history,
    inCompose,
    modalPlaceholder,
    showMyLibraryLink,
    hideMyLibrary,
}) => {
    const activeItem = useActiveItem();
    if (!breadcrumbsPaths) return null;
    return <BreadcrumbsSet
        breadcrumbsPaths={breadcrumbsPaths}
        activeItem={activeItem}
        isForActive={true}
        history={history}
        modalPlaceholder={modalPlaceholder}
        inCompose={inCompose}
        showMyLibraryLink={showMyLibraryLink}
        hideBreadcrumbsContextMenu={hideBreadcrumbsContextMenu}
        hideMyLibrary={hideMyLibrary}
        hideRootCollection
    />
}

const LayoutChildren: FC<{
    breadcrumbsPaths: DocumentCollection[][];
    browseContext: EditorItem[];
    canIAdmin: boolean;
    children: ReactChildren | JSX.Element | JSX.Element[];
    className?: string;
    cloneBreadcrumbsPaths: boolean;
    permissionFlags: IPermissionFlag[];
}> = (props) => {
    const markup = props.cloneBreadcrumbsPaths ?
        Children.map(props.children, child =>
            cloneElement(
                child as DetailedReactHTMLElement<unknown, HTMLElement>,
                props,
            ),
        ) :
        props.children;
    return props.className ?
        <div className={props.className}>{markup}</div> :
        <>{markup}</>;
}

export default Layout;
