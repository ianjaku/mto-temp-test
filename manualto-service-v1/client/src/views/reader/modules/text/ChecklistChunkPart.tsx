import * as React from "react";
import ChecklistStatus from "@binders/ui-kit/lib/elements/checklistStatus";
import { ContentChunkProps } from "./types";
import { useHasNewerPublication } from "../../../../stores/hooks/binder-hooks";
import { useSearchParams } from "../../../../stores/hooks/router-hooks";

const { useMemo } = React;

type ChecklistChunkPartProps = ContentChunkProps;

export const ChecklistChunkPart: React.FC<ChecklistChunkPartProps> = ({
    checklist,
    checklistsReset,
    isBlocking,
    onTogglePerformed,
}) => {
    const searchParams = useSearchParams();
    const showChecklist = useMemo(() => {
        if (!checklist) return false;
        if (searchParams == null) return true;
        const onlyChecklistId = searchParams.get("onlyShowChecklist");
        if (onlyChecklistId == null) return true;

        return onlyChecklistId === checklist.id;
    }, [checklist, searchParams]);

    // Used in the checklist progress modal, to only show the current checklist
    const mockChecklistAs = useMemo(() => {
        if (searchParams == null) return null;
        if (!searchParams.has("mockChecklist")) return null;
        return searchParams.get("mockChecklist") === "true";
    }, [searchParams]);

    const hasNewerPublication = useHasNewerPublication();

    if (!showChecklist) return null;

    return (
        <ChecklistStatus
            checklist={checklist}
            isBlockingProgress={isBlocking}
            onCheck={onTogglePerformed}
            disabled={checklistsReset || hasNewerPublication}
            mockChecklistAs={mockChecklistAs ?? undefined}
        />
    )
}

