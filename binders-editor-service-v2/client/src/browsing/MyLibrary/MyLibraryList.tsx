import * as React from "react";
import { Dispatch, FC, SetStateAction } from "react";
import { MyLibraryItem, MyLibraryItemType } from "./MyLibraryItem";
import { useActiveAccountSettings, useIsSortingEnabled } from "../../accounts/hooks";
import { useActiveBrowsePathOrDefault, useActiveCollection } from "../hooks";
import { AccountSortMethod } from "@binders/client/lib/clients/accountservice/v1/contract";
import Breadcrumbs from "@binders/ui-kit/lib/elements/breadcrumbs";
import { RouteComponentProps } from "react-router";
import { createCommonHitMap } from "@binders/client/lib/ancestors";
import { extractTitle } from "@binders/client/lib/clients/repositoryservice/v3/helpers";
import { identity } from "ramda";
import { sortItems } from "@binders/client/lib/util/sorting";

export const MyLibraryList: FC<RouteComponentProps & {
    attentionTo: string;
    isLandingBrowsePage: boolean;
    isPending: boolean;
    items: MyLibraryItemType[];
    modalPlaceholder: HTMLElement;
    setAttentionTo: Dispatch<SetStateAction<string>>;
    setItemsLoaded: Dispatch<SetStateAction<boolean>>;
}> = props => {
    const accountSettings = useActiveAccountSettings();
    const activeCollection = useActiveCollection();
    const breadcrumbsData = useActiveBrowsePathOrDefault(undefined);
    const { items, isLandingBrowsePage, isPending } = props;
    const isSortingEnabled = useIsSortingEnabled();

    const renderItemFunction = (item, index) => (
        <MyLibraryItem
            attentionTo={props.attentionTo}
            history={props.history}
            location={props.location}
            match={props.match}
            index={index}
            setAttentionTo={props.setAttentionTo}
            setItemsLoaded={props.setItemsLoaded}
            key={index}
            item={item}
            title={extractTitle(item)}
            isPending={isPending}
            modalPlaceholder={props.modalPlaceholder}
        />
    )

    const sortMethod = accountSettings?.sorting?.sortMethod ?? AccountSortMethod.None;
    const sortedItems = isSortingEnabled ? sortItems(items, sortMethod) as MyLibraryItemType[] : items;

    const renderItems = () => sortedItems.reduce(
        (reduced, item, index) => {
            const parentCollectionSummaries = item.kind === "document" ?
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (item as any).parentCollectionSummaries || [] :
                [];
            return {
                ...reduced,
                [item.id]: [{
                    renderItem: renderItemFunction(item, index),
                    parentCollectionSummaries,
                }]
            }
        },
        {} as Record<string, {
            renderItem: JSX.Element;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            parentCollectionSummaries: any;
        }[]>
    )
    const commonParentItemMap = isLandingBrowsePage ?
        createCommonHitMap(items, identity, renderItemFunction) :
        renderItems();

    const commonParentItemMapKeys = Object.keys(commonParentItemMap);

    // we use the same expression to make "New" button disabled before we finish with ancestors
    const isReady = breadcrumbsData &&
        (activeCollection === null || breadcrumbsData.length > 0);

    const hasBreadcrumbsData = isReady && (
        (breadcrumbsData ?? []).length === 0 &&
        commonParentItemMapKeys.length > 1
    )

    return <>{
        commonParentItemMapKeys.map((id, i) => {
            const renderedItem = commonParentItemMap[id].map(({ renderItem }) => renderItem);
            if (!hasBreadcrumbsData) {
                return renderedItem;
            }
            const collectionTitles = commonParentItemMap[id]
                .at(0)
                ?.parentCollectionSummaries
                .map(collectionSummaries =>
                    <Breadcrumbs
                        key={`breadcrumb-${id}-${i}`}
                        items={collectionSummaries.map((colSummary) => ({ name: colSummary.title }))}
                    />
                );
            return (
                <div className="myLibrary-items-parentCollectionModule" key={id}>
                    <div className="myLibrary-items-parentCollectionModule-title">
                        {collectionTitles}
                    </div>
                    {renderedItem}
                </div>
            );
        })
    }</>;
}

