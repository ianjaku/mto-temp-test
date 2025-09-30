import * as React from "react";
import { FC, useMemo, useState } from "react";
import Table, { SORT } from "@binders/ui-kit/lib/elements/Table";
import { compareDesc, format, formatISO } from "date-fns";
import { useBindersMapForActions, useGetProgress, useUsersMapForActions } from "./hooks";
import { useChecklistsActions, useMultiChecklistConfigs } from "../../hooks";
import CheckboxChecked from "@binders/ui-kit/lib/elements/icons/CheckboxChecked";
import CheckboxUnchecked from "@binders/ui-kit/lib/elements/icons/CheckboxUnchecked";
import { ItemTitleCell } from "./ItemTitleCell";
import Modal from "@binders/ui-kit/lib/elements/modal";
import { ModalProps } from "@binders/ui-kit/lib/compounds/modals/ModalViewProvider";
import { StepCell } from "./StepCell";
import { TranslationKeys as TK } from "@binders/client/lib/react/i18n/translations";
import circularProgress from "@binders/ui-kit/lib/elements/circularprogress";
import { exportRowsToSheetsFiles } from "@binders/client/lib/util/xlsx";
import { extractTitle } from "@binders/client/lib/clients/repositoryservice/v3/helpers";
import { useTranslation } from "@binders/client/lib/react/i18n";
import "./ChecklistsActionsModal.styl";


export const ChecklistsActionsModal: FC<ModalProps<{
    itemId: string
}, undefined>> = ({ params, hide }) => {
    const { t } = useTranslation();

    const [actionsPerPage, setActionsPerPage] = useState(10);
    const [currentPage, setCurrentPage] = useState(0);
    const [filterString, setFilterString] = useState("");

    const {
        data: actions,
        isFetching: isFetchingActions,
    } = useChecklistsActions(params.itemId);

    const binderIds = useMemo(() => {
        if (actions == null) return [];
        const binderIds = new Set<string>();
        actions.forEach(action => binderIds.add(action.binderId));
        return Array.from(binderIds);
    }, [actions])

    const {
        data: checklistConfigs,
        isFetching: isFetchingChecklistConfigs
    } = useMultiChecklistConfigs(binderIds);

    const getProgress = useGetProgress(actions, checklistConfigs);

    const {
        isFetching: isFetchingUsers,
        data: usersMap,
        getDisplayName
    } = useUsersMapForActions(actions);

    const {
        isFetching: isFetchingBinders,
        data: bindersMap
    } = useBindersMapForActions(actions);
    
    const actionsWithUserId = useMemo(
        () => (actions ?? []).filter(a => a.performedByUserId != null),
        [actions]
    );

    const filteredActions = useMemo(() => {
        if (actionsWithUserId == null || usersMap == null) return [];
        if (filterString === "") return actionsWithUserId;
        return actionsWithUserId.filter(action => {
            const user = usersMap[action.performedByUserId];
            const userName = user?.displayName ?? user?.login;
            const email = user?.login;
            if (userName == null && email == null) return false;
            return userName?.toLowerCase()?.includes(filterString.toLowerCase()) ||
                email?.toLowerCase()?.includes(filterString.toLowerCase());
        });
    }, [actionsWithUserId, filterString, usersMap]);

    const sortedActions = useMemo(() => {
        return filteredActions
            .sort((a, b) => {
                return compareDesc(
                    new Date(a.performedDate),
                    new Date(b.performedDate)
                )
            })
    }, [filteredActions]);

    const formData = useMemo(() => {
        return sortedActions
            .slice(
                currentPage * actionsPerPage,
                (currentPage + 1) * actionsPerPage
            )
            .map(action => {
                const user = usersMap[action.performedByUserId];
                const userName = user?.displayName ?? user?.login;
                const checkboxComponent = action.performed ? <CheckboxChecked /> : <CheckboxUnchecked />;

                return [
                    <div className="checklist-progress-icon-wrapper">
                        <div className="checklist-progress-icon">{checkboxComponent}</div>
                    </div>,
                    userName,
                    <ItemTitleCell binder={bindersMap[action.binderId]} />,
                    format(new Date(action.performedDate), "yyyy-LL-dd HH:mm"),
                    getProgress(action),
                    <StepCell action={action} />,
                ];
            })
    }, [bindersMap, getProgress, sortedActions, currentPage, actionsPerPage, usersMap]);

    const isFetching = useMemo(
        () => isFetchingActions ||
            isFetchingUsers ||
            isFetchingBinders ||
            isFetchingChecklistConfigs,
        [isFetchingActions, isFetchingUsers, isFetchingBinders, isFetchingChecklistConfigs]
    );

    const exportData = (exportType: "excel" | "csv") => {
        const headers = [
            t(TK.User_User),
            t(TK.Checklists_Doc),
            t(TK.Checklists_PerformedOn),
            t(TK.Checklists_Completion),
            t(TK.Checklists_Step)
        ]
        const data = sortedActions.map(action => {
            const step = action.step + 1
            return [
                getDisplayName(action.performedByUserId),
                extractTitle(bindersMap[action.binderId]),
                formatISO(new Date(action.performedDate)),
                getProgress(action),
                step
            ];
        });

        const extension = exportType === "csv" ? "csv" : "xlsx";
        const name = `exported_checklists_${format(new Date(), "yyyy-LL-dd")}.${extension}`;
        exportRowsToSheetsFiles(
            [headers, ...data],
            "SheetJS",
            name,
            exportType === "csv",
        );
    }
    
    return (
        <Modal title="Checklist progress" onHide={hide}>
            <div className="checklist-progress">
                {isFetching && (
                    <div className="checklist-progress-loader">
                        {circularProgress("", {}, 24)}
                    </div>
                )}
                {!isFetching && actionsWithUserId.length === 0 && (
                    <div className="checklist-progress-empty">
                        {t(TK.Checklists_NoActions)}
                    </div>
                )}
                {!isFetching && actionsWithUserId.length > 0 && (
                    <Table
                        data={formData}
                        exportable
                        onExportData={(exportType) => exportData(exportType as "csv" | "excel")}
                        onSearch={s => setFilterString(s)}
                        searchPlaceholder={t(TK.Checklists_FilterUsers)}
                        recordsPerPage={actionsPerPage}
                        onPageChange={page => setCurrentPage(page-1)}
                        onChangeRecordsPerPage={v => setActionsPerPage(v)}
                        normalizedHeaders={[
                            { label: "", type: "string" },
                            { label: t(TK.User_User), type: "string" },
                            { label: t(TK.Checklists_Doc), type: "string" },
                            { label: t(TK.Checklists_PerformedOn), type: "date" },
                            { label: t(TK.Checklists_Completion), type: "string" },
                            { label: t(TK.Checklists_Step), type: "string" }
                        ]}
                        max={filteredActions.length}
                        sort={[SORT.NOSORT, SORT.NOSORT, SORT.NOSORT, SORT.NOSORT, SORT.NOSORT]}
                    />
                )}
            </div>
        </Modal>
    )
}
