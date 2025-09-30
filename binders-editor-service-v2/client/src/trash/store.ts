import {
    Binder,
    DocumentCollection
} from  "@binders/client/lib/clients/repositoryservice/v3/contract";
import { User } from "@binders/client/lib/clients/userservice/v1/contract";
import { create } from "zustand";
import { mergeListsById } from "./helpers";
import { mergeRight } from "ramda";

export interface IParentItemsMap {
    [childId: string]: {
        ancestorsIds: string[],
        ancestorsObjects: DocumentCollection[]
    }
}

type TrashStore = {
    softDeletedItems: (Binder | DocumentCollection)[];
    parentItemsMap: IParentItemsMap;
    usersById: Record<string, User>;
    doMoreItemsExist: boolean;
}

export const useTrashStore = create<TrashStore>(() => ({
    softDeletedItems: [],
    parentItemsMap: {},
    usersById: {},
    doMoreItemsExist: false,
}));

export const setValues = (
    softDeletedItems: (Binder | DocumentCollection)[],
    parentItemsMap: IParentItemsMap,
    usersById: Record<string, User>,
    doMoreItemsExist: boolean
): void => {
    useTrashStore.setState({
        softDeletedItems,
        parentItemsMap,
        usersById,
        doMoreItemsExist,
    });
}

export const appendValues = (
    softDeletedItems: (Binder | DocumentCollection)[],
    parentItemsMap: IParentItemsMap,
    usersById: Record<string, User>,
    doMoreItemsExist: boolean
): void => {
    useTrashStore.setState((state) => ({
        softDeletedItems: mergeListsById(state.softDeletedItems, softDeletedItems),
        parentItemsMap: mergeRight(state.parentItemsMap, parentItemsMap),
        usersById: mergeRight(state.usersById, usersById),
        doMoreItemsExist
    }));
}

export const deleteFromTrash = (id: string): void => {
    useTrashStore.setState((state) => ({
        softDeletedItems: state.softDeletedItems.filter(item => item.id !== id)
    }));
}