import * as React from "react";
import {
    APIDoRecursiveAction,
    APIGetLanguagesUsedInCollection,
    APIValidateRecursiveAction
} from "../api";
import Dropdown, { IDropdownElement } from "@binders/ui-kit/lib/elements/dropdown";
import { ILanguageInfo, getLanguageInfo } from "@binders/client/lib/languages/helper";
import {
    IRecursiveAction,
    LanguageSummary,
    MAXIMUM_NUMBER_OF_ITEMS,
    RecursiveAction,
    RecursiveErrors,
    RecursiveOpeartionResult,
    ValidationResult
} from "@binders/client/lib/clients/repositoryservice/v3/contract";
import { TFunction, withTranslation } from "@binders/client/lib/react/i18n";
import Button from "@binders/ui-kit/lib/elements/button";
import CheckBox from "@binders/ui-kit/lib/elements/checkbox";
import CircularProgress from "@binders/ui-kit/lib/elements/circularprogress";
import ConfirmationQuestion from "./ConfirmationQuestion";
import FilterableDropdown from "@binders/ui-kit/lib/elements/dropdown/FilterableDropdown";
import { Markdown } from "@binders/ui-kit/lib/elements/Markdown";
import Modal from "@binders/ui-kit/lib/elements/modal";
import RadioButton from "@binders/ui-kit/lib/elements/RadioButton";
import RadioButtonGroup from "@binders/ui-kit/lib/elements/RadioButton/RadioButtonGroup";
import { TranslationKeys as TK } from "@binders/client/lib/react/i18n/translations";
import Table from "@binders/ui-kit/lib/elements/Table/SimpleTable";
import { UNDEFINED_LANG_UI } from "@binders/client/lib/util/languages";
import { buildConfirmationMessageInfo } from "./helpers";
import cx from "classnames";
import { getLanguageElements } from "../../browsing/tsHelpers";
import { recursiveActions } from "./constants";
import "./recursiveActions.styl";

interface IRecursiveActionError {
    title?: string;
    link?: string;
    label: string;
}

interface IRecursiveActionErrorInfo {
    languageName?: string;
    languageCode?: string;
}

const errorMessages = {
    [RecursiveErrors.MISSING_LANGUAGE]: (additionalInfo: IRecursiveActionErrorInfo, t) => t(TK.Edit_RecursiveModalErrorNoTranslation, { languageName: additionalInfo.languageName }),
    [RecursiveErrors.INVALID_PUBLICATION]: (additionalInfo: IRecursiveActionErrorInfo, t) => t(TK.Edit_RecursiveModalErrorInvalidPublication, { languageName: additionalInfo.languageName }),
    [RecursiveErrors.EXCEEDED_MAX_NUMBER]: (additionalInfo: IRecursiveActionErrorInfo, t) => t(TK.Edit_RecursiveModalErrorMaxDocCountExceeded, { maxDocs: MAXIMUM_NUMBER_OF_ITEMS }),
    [RecursiveErrors.GIVEN_ID_IS_ROOT_COLLECTION]: (additionalInfo: IRecursiveActionErrorInfo, t) => t(TK.Edit_RecursiveModalErrorNoRootCollection),
    [RecursiveErrors.INSTANCES_EXIST]: (additionalInfo: IRecursiveActionErrorInfo, t, isWarning) => isWarning ? t(TK.Edit_RecursiveModalWarningNoInstances) : t(TK.Edit_RecursiveModalErrorNoInstances),
    [RecursiveErrors.ACTIVE_PUBLICATIONS_EXISTS]: (additionalInfo: IRecursiveActionErrorInfo, t) => t(TK.Edit_RecursiveModalErrorCantDeleteWithPublications),
    [RecursiveErrors.UNKNOWN_ERROR]: (additionalInfo: IRecursiveActionErrorInfo, t) => t(TK.General_UnknownError),
    [RecursiveErrors.BINDER_HAS_PUBLICATIONS]: (additionalInfo: IRecursiveActionErrorInfo, t) => t(TK.Edit_RecursiveModalErrorCantDeleteWithPublications),
    [RecursiveErrors.COLLECTION_NOT_EMPTY]: (additionalInfo: IRecursiveActionErrorInfo, t) => t(TK.Edit_RecursiveModalErrorCantDeleteCollectionWithDocs),
    [RecursiveErrors.UNSUPORTED_LANGUAGE]: (additionalInfo: IRecursiveActionErrorInfo, t) => t(TK.Edit_RecursiveModalErrorWrongLanguage, { languageName: additionalInfo.languageCode }),
    [RecursiveErrors.COGNITIVE_API_TIMEOUT]: (additionalInfo: IRecursiveActionErrorInfo, t) => t(TK.Edit_RecursiveModalErrorTimeout),
    [RecursiveErrors.MISSING_TITLE]: (additionalInfo: IRecursiveActionErrorInfo, t) => t(TK.Edit_RecursiveModalErrorNoTitle, { languageName: additionalInfo.languageName }),
    [RecursiveErrors.NOTHING_TO_PUBLISH]: (additionalInfo: IRecursiveActionErrorInfo, t) => t(TK.Edit_RecursiveModalErrorNothingToPublish, { languageName: additionalInfo.languageName }),
    [RecursiveErrors.NOTHING_TO_UNPUBLISH]: (additionalInfo: IRecursiveActionErrorInfo, t) => t(TK.Edit_RecursiveModalErrorNoActivePublication, { languageName: additionalInfo.languageName }),
    [RecursiveErrors.MISSING_APPROVALS]: (additionalInfo: IRecursiveActionErrorInfo, t) => t(TK.Edit_PublishFailNoApprovals),
    [RecursiveErrors.MASTER_LANGUAGE_NOT_SET]: (additionalInfo: IRecursiveActionErrorInfo, t) => t(TK.Edit_TranslateMissingMasterLanguage)
}

const RecursiveActionWizardState = {
    CONFIGURATION: "0",
    VALIDATION: "1",
    CONFIRMATION: "2",
    ERRORS: "3",
    ACTION_IN_PROGRESS: "4",
    SUMMARY: "5",
    UNKNOWN_ERROR: "6",
    WARNINGS: "7",
};

interface IRecursiveActionsModalProps {
    collectionId: string;
    parentCollectionId: string;
    hideModal: () => void,
    t: TFunction;
    accountId: string;
    collectionTitle: string;
    mostUsedLanguages: string[];
}

interface IRecursiveActionsModalState {
    allLanguagesUsedInSelectedCollection: ILanguageInfo[];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    currentWizardState: any;
    affectedItemsCount?: number;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    actionResult: RecursiveOpeartionResult<any>;
    selectedAction: IRecursiveAction;
    selectedLanguageCodes: Array<string>;
    languagesToAdd: IDropdownElement[];
    additionalSelectedLanguageCode: string;
    actionIsLoading: boolean;
    errorDuringExecution: string;
    modalHeaderColorOverride?: string;
    isConfirmationStepValid: boolean;
    languagesUsedWithPublicationInfoMap: unknown;
}

interface RecursiveActionWizardStage {
    title: string,
    buildContent: () => React.ReactElement,
    buttons: (state: Partial<IRecursiveActionsModalState>) => Array<React.ReactElement>,
}

class RecursiveActionsModal extends React.Component<IRecursiveActionsModalProps, IRecursiveActionsModalState> {
    stages: { [prop: string]: RecursiveActionWizardStage };
    actionTypes: { Publish: string, Unpublish: string, Delete: string, Translate: string };
    disabledLanguageTooltip;
    constructor(props) {
        super(props);
        this.selectAction = this.selectAction.bind(this);
        this.toggleSelectedLanguage = this.toggleSelectedLanguage.bind(this);
        this.onChangeIsConfirmationStepValid = this.onChangeIsConfirmationStepValid.bind(this);
        this.state = {
            languagesUsedWithPublicationInfoMap: undefined,
            allLanguagesUsedInSelectedCollection: undefined,
            currentWizardState: RecursiveActionWizardState.CONFIGURATION,
            actionResult: { errors: [], results: [], totaldocumentsInSubtree: 0 },
            selectedAction: undefined,
            selectedLanguageCodes: [],
            languagesToAdd: [],
            additionalSelectedLanguageCode: "newLang",
            actionIsLoading: false,
            errorDuringExecution: undefined,
            isConfirmationStepValid: false,
        }

        const { t, hideModal } = props;
        this.stages = {
            [RecursiveActionWizardState.CONFIGURATION]: {
                title: t(TK.Edit_RecursiveModalConfigurationTitle),
                buttons: (state) => [
                    <Button
                        key="cancel"
                        text={`${t(TK.General_Cancel)}`}
                        secondary
                        onClick={hideModal}
                    />,
                    <Button
                        key="proceed"
                        text={t(TK.General_Proceed)}
                        isEnabled={state.selectedAction?.type === RecursiveAction.DELETE || (state.selectedLanguageCodes.length >= 1 && state.selectedLanguageCodes[0] !== "newLang")}
                        onClick={this.validateRecursiveAction.bind(this)}
                    />
                ],
                buildContent: this.buildConfigurationContent.bind(this),
            },
            [RecursiveActionWizardState.VALIDATION]: {
                title: t(TK.Edit_RecursiveModalValidationTitle),
                buildContent: this.buildValidationContent.bind(this),
                buttons: () => [],
            },
            [RecursiveActionWizardState.ERRORS]: {
                title: t(TK.Edit_RecursiveModalValidationErrorsTitle),
                buildContent: this.buildErrorsContent.bind(this),
                buttons: () => [
                    <Button
                        key="back"
                        text={t(TK.General_Back)}
                        onClick={this.setInitialWizardState.bind(this)}
                    />,
                    <Button
                        key="close"
                        text={t(TK.General_Close)}
                        onClick={hideModal}
                    />
                ],
            },
            [RecursiveActionWizardState.CONFIRMATION]: {
                title: t(TK.Edit_RecursiveModalConfirmationTitle),
                buildContent: this.buildConfirmationContent.bind(this),
                buttons: (state) => [
                    <Button
                        key="cancel"
                        text={t(TK.General_Back)}
                        secondary
                        onClick={this.setInitialWizardState.bind(this)}
                    />,
                    <Button
                        key="proceed"
                        text={t(TK.General_Proceed)}
                        onClick={this.invokeRecursiveAction.bind(this)}
                        isEnabled={state.isConfirmationStepValid}
                    />
                ],
            },
            [RecursiveActionWizardState.ACTION_IN_PROGRESS]: {
                title: t(TK.Edit_RecursiveModalActionInProgressTitle),
                buildContent: this.buildActionInProgressContent.bind(this),
                buttons: () => [],
            },
            [RecursiveActionWizardState.SUMMARY]: {
                title: t(TK.Edit_RecursiveModalSummaryTitle),
                buildContent: this.buildSummaryContent.bind(this),
                buttons: () => [
                    <Button
                        key="done"
                        text={t(TK.General_Done)}
                        onClick={hideModal}
                    />
                ],
            },
            [RecursiveActionWizardState.UNKNOWN_ERROR]: {
                title: t(TK.Edit_RecursiveModalUnexpected),
                buildContent: this.buildUnknownErrorContent.bind(this),
                buttons: () => [
                    <Button
                        key="close"
                        text={t(TK.General_Close)}
                        onClick={hideModal}
                    />
                ],
            },
            [RecursiveActionWizardState.WARNINGS]: {
                title: t(TK.Edit_RecursiveModalWarnings),
                buildContent: this.buildWarningsContent.bind(this),
                buttons: () => [
                    <Button
                        key="cancel"
                        text={t(TK.General_Back)}
                        secondary
                        onClick={this.setInitialWizardState.bind(this)}
                    />,
                    <Button
                        key="proceed"
                        text={t(TK.General_Proceed)}
                        onClick={this.goToConfirmationStep.bind(this)}
                        isEnabled={true}
                    />
                ]
            }
        }
    }


    setInitialWizardState() {
        this.setState({
            currentWizardState: RecursiveActionWizardState.CONFIGURATION,
        });
    }

    buildUnknownErrorContent() {
        const { errorDuringExecution } = this.state;
        return (
            <div className="recursiveA-modal-content-info">
                <div className="recursiveA-modal-content-info-content">
                    <div>{errorDuringExecution}</div>
                </div>
            </div>
        )
    }

    buildActionInProgressContent() {
        const { t } = this.props;
        return (
            <div className="recursiveA-modal-content-info">
                <div className="recursiveA-modal-content-info-content">
                    <div>{CircularProgress("", {}, 24)}</div>
                    <div>{t(TK.Edit_RecursiveModalActionInProgressInfo)}</div>
                </div>
            </div>
        );
    }

    checkIfConfigurationFinished() {
        const { selectedLanguageCodes } = this.state;
        return selectedLanguageCodes.length >= 1;
    }

    renderSummaryInfo() {
        const { actionResult, selectedAction, selectedLanguageCodes } = this.state;
        const { t } = this.props;
        const docsWithProblems = new Set(actionResult.errors.map(err => err.itemId)).size;

        switch (selectedAction.type) {
            case RecursiveAction.DELETE:
                return (
                    <div>
                        <div>{`${t(TK.Edit_RecursiveModalProcessedDocuments)}: ${actionResult.totaldocumentsInSubtree}`}</div>
                        <div>{`${t(TK.Edit_RecursiveModalDeletedDocuments)}: ${actionResult.results.length}`}</div>
                        <div>{`${t(TK.Edit_RecursiveModalDocumentsWithProblems)}: ${docsWithProblems}`}</div>
                    </div>
                )
            case RecursiveAction.PUBLISH:
                return (
                    <div>
                        <div>{`${t(TK.Edit_RecursiveModalProcessedDocuments)}: ${actionResult.totaldocumentsInSubtree}`}</div>
                        <div>{`${t(TK.Edit_RecursiveModalCreatedPublications)}: ${actionResult.results.length}`}</div>
                        <div>{`${t(TK.Edit_RecursiveModalDocumentsWithProblems)}: ${docsWithProblems}`}</div>
                    </div>
                )
            case RecursiveAction.UNPUBLISH:
                return (
                    <div>
                        <div>{`${t(TK.Edit_RecursiveModalProcessedDocuments)}: ${actionResult.totaldocumentsInSubtree}`}</div>
                        <div>{`${t(TK.Edit_RecursiveModalDeletedPublications)}: ${actionResult.results.length}`}</div>
                        <div>{`${t(TK.Edit_RecursiveModalDocumentsWithProblems)}: ${docsWithProblems}`}</div>
                    </div>
                )
            case RecursiveAction.TRANSLATE:
                return (
                    <div>
                        <div>{`${t(TK.Edit_RecursiveModalProcessedItems)}: ${actionResult.totalItemsInSubtree}`}</div>
                        <div>{`${t(TK.Edit_RecursiveModalTranslatedItems)} ${getLanguageInfo(selectedLanguageCodes[0]).name}: ${actionResult.results.length}`}</div>
                        <div>{`${t(TK.Edit_RecursiveModalItemsWithProblems)}: ${docsWithProblems}`}</div>
                    </div>
                )
            default:
                return <div />
        }

    }


    buildSummaryContent() {
        const { t } = this.props;
        const preparedUIErrors = this.prepareErrorsFromAPI();
        return <div className="recursiveA-modal-content-errors">
            <span className="recursiveA-modal-content-info">{t(TK.Edit_RecursiveModalActionCompleted)}<br />{t(TK.Edit_RecursiveModalActionSummaryInfo)}</span><br />
            {this.renderSummaryInfo()}
            {preparedUIErrors.length > 0 && <Table
                recordsPerPage={5}
                customHeaders={[t(TK.General_Title), "Information"]}
                data={preparedUIErrors}
            />}
        </div>
    }

    async invokeRecursiveAction() {
        const { collectionId, parentCollectionId, accountId } = this.props;
        const { selectedAction, selectedLanguageCodes } = this.state;
        this.setState({
            currentWizardState: RecursiveActionWizardState.ACTION_IN_PROGRESS
        });

        const payload = {
            accountId,
            languages: selectedLanguageCodes,
        };

        try {
            const actionResult = await APIDoRecursiveAction(collectionId, parentCollectionId, selectedAction, payload);

            this.setState({
                actionResult: actionResult,
                currentWizardState: RecursiveActionWizardState.SUMMARY,
            });
        } catch (err) {
            this.setState({
                errorDuringExecution: err.message,
                currentWizardState: RecursiveActionWizardState.UNKNOWN_ERROR
            });
        }
    }

    onChangeIsConfirmationStepValid(isConfirmationStepValid: boolean) {
        this.setState({
            isConfirmationStepValid,
        });
    }

    buildConfirmationContent() {
        const { selectedAction, affectedItemsCount, selectedLanguageCodes, additionalSelectedLanguageCode } = this.state;
        const { t, collectionTitle } = this.props;
        const requiredConfirmationInfo = buildConfirmationMessageInfo(
            collectionTitle,
            selectedAction,
            affectedItemsCount,
            { selectedLanguageCodes, additionalSelectedLanguageCode }
        );
        if (!requiredConfirmationInfo) {
            return (
                <div className="recursiveA-modal-content-stackedInfo">
                    Unknown action {selectedAction.type}
                </div>
            );
        }
        return (
            <div className="recursiveA-modal-content-stackedInfo">
                {requiredConfirmationInfo && <Markdown element="div">
                    {t(selectedAction.i18nKeys.confirmation, requiredConfirmationInfo as unknown as Record<string, string>)}
                </Markdown>}
                <ConfirmationQuestion
                    recursiveAction={selectedAction}
                    affectedItemsCount={affectedItemsCount}
                    onChangeIsValid={this.onChangeIsConfirmationStepValid}
                />
            </div>
        )
    }

    buildWarningsContent() {
        const { t } = this.props;
        const preparedUIErrors = this.prepareErrorsFromAPI(true);

        return preparedUIErrors.length > 0 && <div>
            <span>{t(TK.Edit_RecursiveModalWarningsInfo)}</span>
            <Table
                recordsPerPage={5}
                customHeaders={[t(TK.General_Title), t(TK.General_Warning)]}
                className="recursiveA-modal-content-errors"
                data={preparedUIErrors}
            />
            <span>{t(TK.Edit_RecursiveModalSureToContinue)}</span>
        </div >
    }

    async validateRecursiveAction() {
        const { collectionId } = this.props;
        const { selectedAction } = this.state;
        this.setState({
            currentWizardState: RecursiveActionWizardState.VALIDATION,
        });
        try {
            const validationResult: ValidationResult = await APIValidateRecursiveAction(collectionId, selectedAction)
            if (!validationResult.valid) {
                this.setState({
                    actionResult: { errors: validationResult.errors, results: [], totaldocumentsInSubtree: 0 },
                    currentWizardState: RecursiveActionWizardState.ERRORS,
                })
            } else if (validationResult.warnings && validationResult.warnings.length > 0) {
                this.setState({
                    currentWizardState: RecursiveActionWizardState.WARNINGS,
                    actionResult: { errors: validationResult.warnings, results: [] },
                    affectedItemsCount: validationResult.affectedItemsCount,
                })
            } else {
                this.setState({
                    currentWizardState: RecursiveActionWizardState.CONFIRMATION,
                    affectedItemsCount: validationResult.affectedItemsCount,
                })
            }
        } catch (err) {
            this.setState({
                errorDuringExecution: err.message,
                currentWizardState: RecursiveActionWizardState.UNKNOWN_ERROR
            })
        }
    }

    goToConfirmationStep() {
        this.setState({
            currentWizardState: RecursiveActionWizardState.CONFIRMATION,
        });
    }

    prepareErrorsFromAPI(isWarningsView?) {
        const { actionResult: { errors } } = this.state;
        const { t } = this.props;
        return errors.map(err => {
            const additionalInfo = err.languageCode ? { languageCode: err.languageCode, languageName: getLanguageInfo(err.languageCode).name } : {};
            const obj: IRecursiveActionError = { label: errorMessages[err.error](additionalInfo, t, isWarningsView) };
            if (err.itemTitle) {
                obj.title = err.itemTitle;
            } else {
                obj.title = `<${t(TK.DocManagement_NoTitle)}>`;
            }
            if (err.itemId) {
                obj.link = !err.isBinder ? `/browse/${err.itemId}` : `/documents/${err.itemId}`;
            }
            return [<div className="recursiveA-modal-content-errors-link"><a target="_blank" rel="noreferrer" href={obj.link}>{obj.title}</a></div>, obj.label];
        });
    }


    buildValidationContent() {
        const { t } = this.props;
        return (
            <div className="recursiveA-modal-content-info">
                <div className="recursiveA-modal-content-info-content">
                    <div>{CircularProgress("", {}, 24)}</div>
                    <div>{t(TK.Edit_RecursiveModalValidatingInProgress)}</div>
                </div>
            </div>
        )
    }


    buildErrorsContent() {
        const { t, collectionTitle } = this.props;
        const { selectedAction } = this.state;
        const preparedUIErrors = this.prepareErrorsFromAPI();

        return preparedUIErrors.length > 0 && <div>
            <span>{t(TK.Edit_RecursiveModalValidatedActionInfo, { selectedActionType: t(selectedAction.i18nKeys.action), collectionTitle })}</span>
            <Table
                recordsPerPage={5}
                customHeaders={[t(TK.General_Title), t(TK.General_Error)]}
                className="recursiveA-modal-content-errors"
                data={preparedUIErrors}
            />
        </div >
    }

    async selectAction(actionId: string) {
        const { collectionId, mostUsedLanguages } = this.props;
        const selectedAction = recursiveActions.find(ra => ra.id === actionId);
        this.setState({
            selectedAction,
            selectedLanguageCodes: [],
            actionIsLoading: true,
        });
        if (RecursiveAction[actionId] !== RecursiveAction.DELETE) {
            const languagesUsedExtendedInfo: Array<LanguageSummary> = await APIGetLanguagesUsedInCollection(collectionId, true);
            let languagesUsed = [];
            let languagesUsedWithPublicationInfoMap = {};
            if (languagesUsedExtendedInfo.length > 0) {
                languagesUsed = languagesUsedExtendedInfo.map(({ languageCode }) => languageCode);
                languagesUsedWithPublicationInfoMap = languagesUsedExtendedInfo.reduce((acc, l) => (
                    {
                        ...acc,
                        [l.languageCode]: {
                            atLeastOneCanPublish: l.atLeastOneCanPublish,
                            atLeastOneCanUnpublish: l.atLeastOneCanUnpublish,
                        }
                    }
                ), {});
            }

            let { elements: languagesToAdd } = getLanguageElements({
                languageCodesToOmit: languagesUsed,
                languageCodesToPrioritize: mostUsedLanguages,
            });
            if (selectedAction.availableLanguagesFilter) {
                languagesUsed = languagesUsed.filter(selectedAction.availableLanguagesFilter);
                languagesToAdd = languagesToAdd.filter(info => selectedAction.availableLanguagesFilter(`${info.id}`));
            }
            const allLanguagesUsedInSelectedCollection = languagesUsed.map(l => ({ ...getLanguageInfo(l), iso639_1: l }));
            this.setState({
                allLanguagesUsedInSelectedCollection,
                languagesUsedWithPublicationInfoMap,
                languagesToAdd,
            }, function () {
                setTimeout(() => this.setState({ actionIsLoading: false }), 2500); /* delayed to allow max-height transition to complete */
            });
        } else {
            this.setState({
                allLanguagesUsedInSelectedCollection: undefined,
            })
        }

    }

    selectLanguageCode(e, value) {
        this.setState({
            selectedLanguageCodes: [value],
        });
    }


    selectAdditionalLanguageCode(code) {
        this.setState({
            additionalSelectedLanguageCode: code,
            selectedLanguageCodes: [code],
        });

    }

    toggleSelectedLanguage(langCode) {
        return (isChecked) => {
            const { selectedLanguageCodes } = this.state;
            if (!isChecked && selectedLanguageCodes.includes(langCode)) {
                this.setState({
                    selectedLanguageCodes: selectedLanguageCodes.filter(lang => lang !== langCode)
                });

            } else {
                this.setState({
                    selectedLanguageCodes: [...selectedLanguageCodes, langCode]
                })
            }
        }

    }

    markAllLanguages(selected: boolean) {
        const { selectedAction, languagesUsedWithPublicationInfoMap } = this.state;

        const allLanguagesUsed: ILanguageInfo[] = this.state.allLanguagesUsedInSelectedCollection;
        const isPublishSelected = selectedAction.type === RecursiveAction.PUBLISH;
        const isUnpublishSelected = selectedAction.type === RecursiveAction.UNPUBLISH;

        this.setState({
            selectedLanguageCodes: selected ?
                allLanguagesUsed.map(l => l.iso639_1).filter(languageCode => {
                    let isEnabled = false;
                    if (isPublishSelected) {
                        isEnabled = languagesUsedWithPublicationInfoMap[languageCode].atLeastOneCanPublish;
                    } else if (isUnpublishSelected) {
                        isEnabled = languagesUsedWithPublicationInfoMap[languageCode].atLeastOneCanUnpublish;
                    }
                    return isEnabled;
                }) :
                []
        });
    }

    renderLanguageSelector() {
        const { allLanguagesUsedInSelectedCollection, selectedAction, languagesToAdd, selectedLanguageCodes, additionalSelectedLanguageCode, languagesUsedWithPublicationInfoMap } = this.state;
        const { t } = this.props;
        if (allLanguagesUsedInSelectedCollection === undefined) {
            return <div className="recursiveA-modal-content-info">
                {CircularProgress("", {}, 24)}
            </div>
        }

        const isSelectedTranslate = selectedAction.type === RecursiveAction.TRANSLATE;
        const isPublishSelected = selectedAction.type === RecursiveAction.PUBLISH;
        const isUnpublishSelected = selectedAction.type === RecursiveAction.UNPUBLISH;

        if (allLanguagesUsedInSelectedCollection.length === 0) {
            return (
                <div className="recursiveA-modal-content-info">
                    <div className="recursiveA-modal-content-info-content">
                        <div>{isSelectedTranslate ? t(TK.Edit_RecursiveModalTranslateOnlyDefinedLanguage) : t(TK.Edit_RecursiveModalNoDocs)}</div>
                    </div>
                </div>
            )
        }

        if (isSelectedTranslate) {
            const allLanguagesInCollectionWithoutNA = allLanguagesUsedInSelectedCollection.filter(
                lang => lang.name !== UNDEFINED_LANG_UI
            );
            return (
                <div className="recursiveA-modal-content-languageSelector">
                    <span className="recursiveA-modal-content-languageSelector-label">{t(TK.Edit_RecursiveModalChooseLanguageLabel, { count: 1 })}</span>
                    <RadioButtonGroup
                        name="languages"
                        className="recursiveA-modal-content-languageSelector-radios"
                        value={selectedLanguageCodes[0] || ""}
                        onChange={this.selectLanguageCode.bind(this)}
                    >
                        <div
                            className="recursiveA-modal-content-languageSelector-columns"
                        >
                            {
                                allLanguagesInCollectionWithoutNA.map(lang => {
                                    return <RadioButton
                                        value={lang.iso639_1}
                                        label={lang.name}
                                        key={lang.iso639_1}
                                        className="recursiveA-modal-content-languageSelector-radioButton"
                                    />
                                })
                            }
                            <div className="recursiveA-modal-content-languageSelector-newLanguageRadioButton">
                                <RadioButton
                                    value={additionalSelectedLanguageCode}
                                    label={""}
                                    key={"newLang"}
                                />
                                <FilterableDropdown
                                    maxRows={5}
                                    type={"Choose new language"}
                                    onSelectElement={this.selectAdditionalLanguageCode.bind(this)}
                                    elements={languagesToAdd}

                                />
                            </div>
                        </div>
                    </RadioButtonGroup>
                </div>)
        }

        return (
            <div className="recursiveA-modal-content-languageSelector">
                <div className="recursiveA-modal-content-languageSelector-label">
                    {t(TK.Edit_RecursiveModalChooseLanguageLabel, { count: 2 })}
                    <span className="recursiveA-modal-content-languageSelector-label-links"> (
                        <a
                            className="recursiveA-modal-content-languageSelector-label-link"
                            onClick={() => this.markAllLanguages(true)}
                        >{t(TK.General_All)}</a> / <a
                            className="recursiveA-modal-content-languageSelector-label-link"
                            onClick={() => this.markAllLanguages(false)}
                        >{t(TK.General_None)}</a>)
                    </span>
                </div>
                <div
                    className="recursiveA-modal-content-languageSelector-columns"
                >
                    {allLanguagesUsedInSelectedCollection.map(lang => {
                        let isDisabled = false;
                        if (isPublishSelected) {
                            isDisabled = !(languagesUsedWithPublicationInfoMap[lang.iso639_1].atLeastOneCanPublish);
                        } else if (isUnpublishSelected) {
                            isDisabled = !(languagesUsedWithPublicationInfoMap[lang.iso639_1].atLeastOneCanUnpublish);
                        }

                        return (
                            <div key={lang.iso639_1} className="recursiveA-modal-content-languageSelector-checkBox">
                                <CheckBox
                                    key={lang.iso639_1}
                                    label={lang.name}
                                    disabled={isDisabled}
                                    checked={this.state.selectedLanguageCodes.includes(lang.iso639_1)}
                                    onCheck={this.toggleSelectedLanguage(lang.iso639_1)}
                                    tooltip={
                                        isDisabled && t(
                                            TK.Edit_RecursiveModalDisabledLanguage,
                                            { action: isPublishSelected ? t(TK.Edit_Publish).toLowerCase() : t(TK.Edit_Unpublish).toLowerCase() }
                                        )
                                    }
                                />
                            </div>
                        )
                    })}
                </div>
            </div>
        )
    }



    buildConfigurationContent() {
        const { t } = this.props;
        const { selectedAction, allLanguagesUsedInSelectedCollection, actionIsLoading } = this.state;
        const actionTypeDropdownElements = recursiveActions.map((recursiveAction: IRecursiveAction) => {
            const { id, i18nKeys: { action }, icon } = recursiveAction;
            return { id, label: `${t(action)}`, icon };
        })
        return (
            <React.Fragment>
                <Dropdown
                    type={`${t(TK.Edit_RecursiveModalActionType)}`}
                    className="recursiveA-modal-content-actionType"
                    elements={actionTypeDropdownElements}
                    selectedElementId={selectedAction?.id}
                    maxRows={5}
                    onSelectElement={this.selectAction}
                    hideSelectedElementInList={false}
                    showBorders={true}
                    isDisabled={false}
                />
                <div
                    className={cx(
                        "recursiveA-modal-content-langs",
                        { "loaded": allLanguagesUsedInSelectedCollection?.length > 0 },
                        { "overflowHidden": actionIsLoading },
                    )}
                >
                    {selectedAction && selectedAction.type !== RecursiveAction.DELETE && this.renderLanguageSelector()}
                </div>
            </React.Fragment>
        )
    }

    render() {
        const { hideModal } = this.props;
        const { currentWizardState, selectedAction } = this.state;
        const modalHeaderColorOverride = currentWizardState === RecursiveActionWizardState.CONFIRMATION && selectedAction?.requiresExplicitConfirmation && "red";

        const maybeHideModal = () => {
            if (this.state.currentWizardState === RecursiveActionWizardState.ACTION_IN_PROGRESS) return false;
            return hideModal();
        }

        return (
            <Modal
                title={this.stages[currentWizardState].title}
                buttons={this.stages[currentWizardState].buttons(this.state)}
                classNames={`recursiveA-modal ${currentWizardState === RecursiveActionWizardState.CONFIGURATION ? "isOverflow" : ""}`}
                onHide={maybeHideModal}
                headerColor={modalHeaderColorOverride}
            >
                <div className="recursiveA-modal-content">
                    {this.stages[currentWizardState].buildContent()}
                </div>

            </Modal>
        );
    }
}

export default withTranslation()(RecursiveActionsModal);
