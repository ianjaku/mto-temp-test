import { EditorCapability, useAccountStoreState } from "../../stores/zustand/account-store";
import { useContentMapStoreState } from "../../stores/zustand/content-map-store";

export function useAmIEditor(): EditorCapability[] {
    const { canEditElsewhere, docsToEdit } = useAccountStoreState(state => ({
        canEditElsewhere: state.canEditElsewhere,
        docsToEdit: state.docsToEdit
    }));
    const landingPageBinderIds = useContentMapStoreState(state => state.landingPageBinderIds);
    const landingPageCollectionIds = useContentMapStoreState(state => state.landingPageCollectionIds);
    const collectionAncestorIds = useContentMapStoreState(state => state.collectionAncestorIds);
    const activeCollectionId = useContentMapStoreState(state => state.activeCollectionId);
    const itemIds = collectionAncestorIds.length ?
        [...collectionAncestorIds, activeCollectionId] :
        [...landingPageCollectionIds, ...landingPageBinderIds];
    const amIEditorHere = itemIds?.find((id) => docsToEdit.includes(id));

    const editorValues = [];
    if (canEditElsewhere || amIEditorHere) {
        editorValues.push(EditorCapability.YesElsewhere);
    }
    if (amIEditorHere) {
        editorValues.push(EditorCapability.YesHere);
    }
    return editorValues;
}

export function useCanEditCurrentDocument(): boolean {
    const canEdit = useAmIEditor();
    return canEdit.includes(EditorCapability.YesHere);
}

export function useCanEditAnything(): boolean {
    const canEdit = useAmIEditor();
    return canEdit.includes(EditorCapability.YesHere) || canEdit.includes(EditorCapability.YesElsewhere);
}

