import * as React from "react";
import { AccountFeatures } from "@binders/client/lib/clients/accountservice/v1/contract";
import BinderClass from "@binders/client/lib/binders/custom/class";
import { Container } from "flux/utils";
import { DATE_CHANGED_MARKER } from "@binders/client/lib/binders/defaults";
import DocumentStore from "../../store";
import { LastEditInfo } from "@binders/client/lib/binders/create";
import { TFunction } from "@binders/client/lib/i18n";
import { TranslationKeys as TK } from "@binders/client/lib/react/i18n/translations";
import cx from "classnames";
import { fixES5FluxContainer } from "@binders/client/lib/react/fluxES5Converter";
import { fmtDateTimeRelative } from "@binders/client/lib/util/date";
import { useActiveAccountFeatures } from "../../../accounts/hooks";
import { withHooks } from "@binders/client/lib/react/hooks/withHooks";
import { withTranslation } from "@binders/client/lib/react/i18n";
import "./DocumentComposerStats.styl";

export interface DocumentComposerStatsProps {
    accountFeatures: AccountFeatures;
    binder: BinderClass;
    className?: string;
    t: TFunction;
}

export interface DocumentComposerStatsState {
    isSaving: boolean;
    lastSaveMoment: Date;
    readableLastSaveMoment: string;
    statistics?: LastEditInfo;
}

const formatDate = (date: Date | undefined): string =>
    date == null ? undefined : fmtDateTimeRelative(date, { addSuffix: true, includeSeconds: true });

class DocumentComposerStats extends React.Component<DocumentComposerStatsProps, DocumentComposerStatsState> {
    intervalId: ReturnType<typeof setInterval> | undefined;

    constructor(props: DocumentComposerStatsProps) {
        super(props);
        this.maybeAskConfirmation = this.maybeAskConfirmation.bind(this);
    }

    static getStores() {
        return [DocumentStore];
    }

    static calculateState() {
        const { lastSaveMoment, isSaving } = DocumentStore.getBinderSavingInfo();
        const readableLastSaveMoment = !isSaving && formatDate(lastSaveMoment);
        return {
            statistics: DocumentStore.getStatisticsForActiveBinder(),
            isSaving,
            lastSaveMoment,
            readableLastSaveMoment
        }
    }

    componentDidMount() {
        const updateHumanReadableMoment = () => {
            this.setState({
                readableLastSaveMoment: formatDate(this.state.lastSaveMoment)
            });
        }
        this.intervalId = setInterval(
            updateHumanReadableMoment.bind(this),
            2000
        );
        window.addEventListener("beforeunload", this.maybeAskConfirmation);
    }

    componentWillUnmount() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
        }
        window.removeEventListener("beforeunload", this.maybeAskConfirmation);
    }

    buildSavingInfo() {
        const { t } = this.props;
        const { readableLastSaveMoment, isSaving } = this.state;
        if (isSaving) {
            return t(TK.Edit_SaveInProgress);
        }
        if (readableLastSaveMoment) {
            return t(TK.Edit_AutoSaved, { lastAutoSaveMoment: readableLastSaveMoment });
        }
    }

    maybeAskConfirmation(e: BeforeUnloadEvent) {
        if (!this.state?.isSaving) {
            return;
        }
        e = e || window.event;
        if (e) { // IE and Firefox prior to version 4
            e.returnValue = ".";
        }
        // Safari
        return ".";
    }

    render() {
        const savingInfo = this.buildSavingInfo();
        const body = savingInfo || this.renderUnmodified();
        return (
            <div className={cx("composer-document-stats", this.props.className)}>
                {body}
            </div>
        )
    }

    renderUnmodified() {
        const { t } = this.props;
        const { statistics } = this.state;
        if (!statistics) {
            return <div></div>;
        }
        const { lastEdit, lastEditBy } = statistics;
        const lastEdited = lastEdit && lastEdit !== DATE_CHANGED_MARKER ?
            formatDate(new Date(lastEdit)) :
            "";
        return lastEdited ?
            (
                <div>
                    {t(TK.Edit_LastEdited, {
                        when: lastEdited,
                        who: lastEditBy || t(TK.Edit_Anonymous),
                    })}
                </div>
            ) :
            (
                <div></div>
            );
    }
}

const container = Container.create(fixES5FluxContainer(DocumentComposerStats), { withProps: true }) as React.ComponentType<DocumentComposerStatsProps>;
const containerWithHooks = withHooks(container, () => ({
    accountFeatures: useActiveAccountFeatures(),
}))
const DocumentComposerStatsContianer = withTranslation()(containerWithHooks)

export default DocumentComposerStatsContianer;
