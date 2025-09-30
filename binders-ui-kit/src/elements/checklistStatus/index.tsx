import * as React from "react";
import { detectTimeZone, fmtDate, fmtDateIso8601TZ } from "@binders/client/lib/util/date";
import ChecklistStatusButton from "../button/ChecklistStatusButton";
import { IChecklist } from "@binders/client/lib/clients/repositoryservice/v3/contract";
import { TranslationKeys as TK } from "@binders/client/lib/react/i18n/translations";
import cx from "classnames";
import { useTranslation } from "@binders/client/lib/react/i18n";
import "./ChecklistStatus.styl";

const { useCallback, useMemo } = React;

interface IChecklistStatusProps {
    checklist: IChecklist;
    onCheck: (checklistId: string, performed: boolean) => void;
    disabled?: boolean;
    isBlockingProgress?: boolean;
    mockChecklistAs?: boolean; // Change performed to be true/false independent of the actual checklist value
}

function ChecklistStatus(props: IChecklistStatusProps): React.JSX.Element {
    const { checklist, disabled, onCheck, isBlockingProgress } = props;
    const { performedHistory } = checklist;

    const performed = useMemo(() => {
        if (props.mockChecklistAs == null) return checklist.performed;
        return props.mockChecklistAs;
    }, [props.mockChecklistAs, checklist.performed]);

    const [
        lastPerformedDate,
        lastPerformedByUserName,
        prevLastPerformedDate,
        prevLastPerformedByUserName,
    ] = useMemo(() => {
        if (!(performedHistory || []).length) {
            return [];
        }
        const lastHistory = performedHistory.sort((h1, h2) => h1.lastPerformedDate < h2.lastPerformedDate ? 1 : -1)[0];
        let prevLastPerformedDate: Date | null = null;
        let prevLastPerformedByUserName: string | null = null;
        if (performedHistory.length > 1) {
            prevLastPerformedDate = performedHistory[1].lastPerformedDate;
            prevLastPerformedByUserName = performedHistory[1].lastPerformedByUserName;
        }
        return [
            lastHistory.lastPerformedDate ? new Date(lastHistory.lastPerformedDate) : null,
            lastHistory.lastPerformedByUserName,
            prevLastPerformedDate ? new Date(prevLastPerformedDate) : null,
            prevLastPerformedByUserName
        ];
    }, [performedHistory]);

    const { t } = useTranslation();
    const handleCheck = useCallback((e) => {
        if (!props.disabled) {
            onCheck(checklist.id, !checklist.performed);
        }
        e.stopPropagation();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [checklist, onCheck]);

    function renderPerformedByInfo(rawDate: Date, who: string, isHistory?: boolean) {
        const date = fmtDateIso8601TZ(rawDate);
        const time = fmtDate(rawDate, "HH:mm", { timeZone: detectTimeZone() });
        return (
            <div className={cx("checklistStatus-performedBy", { "checklistStatus-performedBy--isHistory": isHistory })}>
                <label>
                    {`${t(isHistory ? TK.Reader_ChecklistTaskPerformedHistoryWhen : TK.Reader_ChecklistTaskPerformedWhen, { date, time })}`}
                </label>
                <label>
                    {`${t(TK.Reader_ChecklistTaskPerformedWho, { who })}`}
                </label>
            </div>
        );
    }

    return (
        <div
            className={cx(
                "checklistStatus",
                { "checklistStatus--isPerformed": performed },
                { "checklistStatus--isDisabled": disabled },
            )}
        >
            <ChecklistStatusButton
                shouldShake={isBlockingProgress}
                isPerformed={performed}
                onClick={handleCheck}
                disabled={props.disabled}
            />
            {lastPerformedDate && renderPerformedByInfo(lastPerformedDate, lastPerformedByUserName)}
            {prevLastPerformedDate && renderPerformedByInfo(prevLastPerformedDate, prevLastPerformedByUserName, true)}
        </div>
    )
}

export default ChecklistStatus;
