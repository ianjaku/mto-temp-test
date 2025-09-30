import * as React from "react";
import MediaPane, { MediaPaneUsage } from "../../../../media/MediaPane";
import { Pane, Tabs } from "@binders/ui-kit/lib/elements/tabs";
import { TFunction, withTranslation } from "@binders/client/lib/react/i18n";
import { clearBinderVisuals, loadBinderVisuals } from "../../../../media/actions";
import {
    removeCollectionThumbnail,
    removeCollectionTitle,
    saveCollectionTitle,
    updateLanguageOfCollectionTitle
} from "../../../../documents/actions";
import AccountStore from "../../../../accounts/store";
import { BinderMediaStoreActions } from "../../../../media/binder-media-store";
import Button from "@binders/ui-kit/lib/elements/button";
import { DocumentCollection } from "@binders/client/lib/clients/repositoryservice/v3/contract";
import { DocumentType } from "@binders/client/lib/clients/model";
import EditCollectionLanguageRow from "./EditCollectionLanguageRow";
import { FlashMessageActions } from "@binders/client/lib/react/flashmessages/actions";
import { IAccountSettings } from "@binders/client/lib/clients/accountservice/v1/contract";
import Modal from "@binders/ui-kit/lib/elements/modal";
import SemanticLinkManager from "../../../../documents/Composer/components/SemanticLinkManager";
import { TranslationKeys as TK } from "@binders/client/lib/react/i18n/translations";
import { UNDEFINED_LANG } from "@binders/client/lib/util/languages";
import { WebDataState } from "@binders/client/lib/webdata";
import autobind from "class-autobind";
import { findSemanticLinks } from "../../../../documents/actions/loading";
import { getLanguageLabel } from "@binders/client/lib/languages/helper";
import {
    identifyLanguageInSemanticLinks
} from "../../../../documents/Composer/components/SemanticLinkManager/actions";
import { isPlaceholderVisual } from "@binders/client/lib/clients/imageservice/v1/visuals";
import { loadCollection } from "../../../actions";
import { thumbnailToVisual } from "../../../../media/helper";
import { updateAccountThumbail } from "../../../../accounts/actions";
import { updateCollectionThumbnail } from "../../../../documents/actions";
import { useSupportedLanguagesMap } from "../../../../machinetranslation/useSupportedLanguagesMap";
import { withHooks } from "@binders/client/lib/react/hooks/withHooks";
import "./collectionForm.styl";

interface EditCollectionFormProps {
    accountSettings: IAccountSettings;
    collectionId: string;
    collectionObject;
    initialTabIndex: number | undefined;
    isForActive: boolean;
    modalPlaceholder;
    onClose: () => void;
    onDoubleClickVisual: (visual) => void;
    onSetThumbnail?: () => void;
    supportedLanguagesMap: { [p: string]: string[] };
    t?: TFunction;
    translatorLanguages: string[];
}

interface LanguageRow {
    name: string;
    languageCode: string;
    languageLabel: string;
    isUndefinedLanguage: boolean;
}

interface EditCollectionFormState {
    collection: DocumentCollection | undefined;
    isFormLoaded: boolean;
    languageRows: LanguageRow[];
    languagesForTranslation: { code: string, name: string }[];
    loadingRow: number | undefined;
    persistShowNewLanguage: boolean;
    selectedVisual;
    showNewLanguage: boolean;
    tempName: string | undefined;
}

class EditCollectionForm extends React.Component<EditCollectionFormProps, EditCollectionFormState> {

    private _mounted: boolean;

    constructor(props: EditCollectionFormProps) {
        super(props);
        autobind(this, EditCollectionForm.prototype);
        this.state = {
            collection: undefined,
            languageRows: [],
            selectedVisual: this.buildSelectedVisual(props),
            isFormLoaded: false,
            loadingRow: undefined,
            tempName: undefined,
            languagesForTranslation: [],
            persistShowNewLanguage: false,
            showNewLanguage: false,
        };
    }

    async componentDidMount() {
        const { collectionId } = this.props;
        const [ collection ] = await Promise.all([
            loadCollection(collectionId),
            findSemanticLinks(collectionId),
            loadBinderVisuals({ id: collectionId, kind: "collection" })
        ]);
        this.buildLanguageRows();
        this._mounted = true;
        this.setState({
            isFormLoaded: true,
            // This makes sure the visual is of type Visual and inherits all the prototype
            selectedVisual: this.buildSelectedVisual(this.props),
            collection,
        });
    }

    componentDidUpdate(_: EditCollectionFormProps, prevState: EditCollectionFormState) {
        const { showNewLanguage: prevShowNewLanguage, collection: prevCollection } = prevState;
        const { collection, showNewLanguage } = this.state;
        if (collection !== prevCollection || prevShowNewLanguage !== showNewLanguage) {
            this.buildLanguageRows();
        }
    }

    componentWillUnmount() {
        this._mounted = false;
        clearBinderVisuals();
    }

    buildLanguageRows() {
        const { collection, showNewLanguage } = this.state;
        const languageRows = (collection?.titles || []).map((title) => {
            return {
                name: title.title,
                languageCode: title.languageCode,
                languageLabel: getLanguageLabel(title.languageCode, false),
                isUndefinedLanguage: title.languageCode === UNDEFINED_LANG,
            }
        });
        if (showNewLanguage) {
            languageRows.push({
                name: "",
                languageCode: "",
                languageLabel: "",
                isUndefinedLanguage: true,
            })
        }

        const languagesForTranslation = languageRows
            .filter(l => l.languageCode)
            .sort(({ languageCode: code1 }, { languageCode: code2 }) => {
                if (code1 === "en") {
                    return -1;
                } else if (code2 === "en") {
                    return 1;
                }
                return 0;
            })
            .map(({ languageCode, name }) => ({ code: languageCode, name }))

        this.setState({
            languageRows,
            languagesForTranslation,
        })
    }

    buildSelectedVisual(props: EditCollectionFormProps) {
        const { collectionObject: { thumbnail } } = props ?? {};
        if (!thumbnail) {
            return undefined;
        }
        const visualUrl = thumbnail.medium || thumbnail.buildRenderUrl({ requestedFormatNames: ["medium"] });
        return !isPlaceholderVisual(visualUrl) && !thumbnail.medium ? thumbnail : thumbnailToVisual(thumbnail);
    }


    onSetThumbnail(visual) {
        const { collectionObject, onSetThumbnail, isForActive } = this.props;
        if (visual) {
            updateCollectionThumbnail(collectionObject, visual, isForActive);
        }
        if (onSetThumbnail) {
            onSetThumbnail();
        }
        if (collectionObject && collectionObject.isRootCollection) {
            updateAccountThumbail(collectionObject.accountId, visual);
        }
    }

    async onSelect(visual) {
        if (visual == null) {
            const updatedCollection = await removeCollectionThumbnail(
                this.props.collectionObject,
                this.props.isForActive
            );
            this.setState({
                selectedVisual: updatedCollection.thumbnail
            });
            return;
        }
        const newThumbnail = visual;
        this.onSetThumbnail(newThumbnail);
        this.setState({
            selectedVisual: newThumbnail
        });
    }

    onUpdateVisual(id: string, _moduleKey: unknown, update: Record<string, unknown>) {
        const properVisual = BinderMediaStoreActions.getVisual(id);
        const updatedVisual = Object.keys(update).reduce((acc, key) => { acc[key] = update[key]; return acc; }, properVisual);
        this.onSetThumbnail(updatedVisual);
        this.setState({
            selectedVisual: updatedVisual,
        });
    }

    buildOnChangeName(languageCode: string) {
        return (name: string) => {
            const { languageRows } = this.state;
            const updatedLanguageRows = languageRows.map(languageRow =>
                languageRow.languageCode === languageCode ? { ...languageRow, name } : languageRow
            );
            this.setState({
                languageRows: updatedLanguageRows,
            });
        }
    }

    buildOnRetainTempName(languageCode: string) {
        return () => {
            const { languageRows } = this.state;
            const tempName = languageRows.find(tr => tr.languageCode === languageCode).name;
            this.setState({
                tempName,
            });
        }
    }

    buildOnBlurName(index: number, languageCode: string) {
        return async () => {
            const { collectionId } = this.props;
            const { languageRows, tempName } = this.state;
            const name = languageRows.find(tr => tr.languageCode === languageCode).name;
            if (tempName == null) {
                // if the tempName is not set, it means that the user has not changed the name
                // it can be undefined if the user came from the context menu in MyLibrary
                // and selected "Share"
                return;
            }
            if (name === tempName) {
                return;
            }
            if (!name || name.trim().length === 0) {
                this.setState({
                    languageRows: languageRows.map(languageRow =>
                        languageRow.languageCode === languageCode ? { ...languageRow, name: tempName } : languageRow
                    )
                });
                return;
            }
            if (languageCode) {
                if (this._mounted) {
                    this.setState({ loadingRow: index });
                }
                const collection = await saveCollectionTitle(collectionId, languageCode, name);

                const stateUpdate = {
                    collection,
                    loadingRow: undefined,
                } as Pick<EditCollectionFormState, keyof EditCollectionFormState>;

                if (this.state.persistShowNewLanguage) {
                    stateUpdate.persistShowNewLanguage = false;
                } else {
                    stateUpdate.showNewLanguage = false;
                }
                if (this._mounted) {
                    this.setState(stateUpdate);
                }
            }
        }
    }

    buildOnSelectLanguage(index: number, currentLanguageCode: string) {
        return async (languageCode: string) => {
            const { collectionId } = this.props;
            const { languageRows } = this.state;
            const updatedLanguageRows = languageRows.map(languageRow =>
                languageRow.languageCode === currentLanguageCode ? { ...languageRow, languageCode } : languageRow
            );
            const name = languageRows.find(tr => tr.languageCode === currentLanguageCode)?.name;
            if (name) {
                let collection: DocumentCollection | undefined;
                this.setState({ loadingRow: index });
                if (currentLanguageCode) {
                    collection = await updateLanguageOfCollectionTitle(collectionId, currentLanguageCode, languageCode, name)
                    if (currentLanguageCode === UNDEFINED_LANG) {
                        identifyLanguageInSemanticLinks(collectionId, languageCode);
                    }
                } else {
                    collection = await saveCollectionTitle(collectionId, languageCode, name);
                }
                this.setState({ collection, showNewLanguage: false, loadingRow: undefined });
                return;
            }
            this.setState({
                languageRows: updatedLanguageRows,
            });
        }
    }

    onModalHide() {
        // onBlur events on the inputs are not triggered when the modal is closed, trigger them manually
        this.state.languageRows.forEach((languageRow, index) => {
            this.buildOnBlurName(index, languageRow.languageCode)();
        });
        this.props.onClose();
    }

    addNewLanguageOption() {
        const { loadingRow } = this.state;
        this.setState({
            showNewLanguage: true,
            // if this new button was clicked after changing the title in one of the language rows, "loadingRow" will be truthy
            // after the add/change title operation finishes, showNewLanguage is usually set to false (to transform the new language interface to a real one)
            // with the persistShowNewLanguage flag, we indicate that we want the "show new language" view to persist
            persistShowNewLanguage: (loadingRow !== undefined),
        });
    }

    buildOnRemoveCollectionTitle(index: number, languageCode: string) {
        return async () => {
            const { collectionId, t } = this.props;
            const domainsWD = AccountStore.getDomains();
            const domain = [...(domainsWD.state === WebDataState.SUCCESS && domainsWD.data) || []].pop();
            try {
                this.setState({ loadingRow: index });
                const collection = await removeCollectionTitle(domain, collectionId, languageCode);
                this.setState({ collection, loadingRow: undefined });
            } catch (e) {
                FlashMessageActions.error(t(TK.DocManagement_LangRemoveFail));
            }
        }
    }

    render() {
        const { isFormLoaded, languageRows } = this.state;
        const { collectionId, modalPlaceholder, translatorLanguages,
            onDoubleClickVisual, collectionObject, t, initialTabIndex } = this.props;
        const { selectedVisual, loadingRow, collection, languagesForTranslation } = this.state;
        const onHide = this.onModalHide.bind(this);

        return isFormLoaded && (
            <Modal
                title={languageRows.length ? t(TK.DocManagement_ColEdit, { name: languageRows[0].name }) : ""}
                onHide={onHide}
                onEscapeKey={onHide}
                buttons={[
                    <Button
                        key="done"
                        text={t(TK.General_Done)}
                        onClick={onHide}
                    />]}
                classNames="collectionForm-modal collectionForm-modal--edit"
            >
                <Tabs initialSelectedIndex={initialTabIndex || 0} >
                    <Pane label="General">
                        <div className="collectionForm">
                            <table className="collectionForm-header collectionForm-table table">
                                <thead>
                                    <tr>
                                        <th>{t(TK.General_Language)}</th>
                                        <th>{t(TK.General_Name)}</th>
                                        <th>{t(TK.General_Delete)}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {languageRows.map((languageRow, index) => (
                                        <EditCollectionLanguageRow
                                            key={`editColRow${index}`}
                                            collection={collection}
                                            languageRow={languageRow}
                                            translatorLanguages={translatorLanguages}
                                            onSelectLanguage={this.buildOnSelectLanguage(index, languageRow.languageCode)}
                                            onChangeName={this.buildOnChangeName(languageRow.languageCode)}
                                            onRetainTempName={this.buildOnRetainTempName(languageRow.languageCode)}
                                            onBlurName={this.buildOnBlurName(index, languageRow.languageCode)}
                                            isLoading={loadingRow === index}
                                            undeletable={languageRows.length === 1}
                                            onRemoveCollectionTitle={this.buildOnRemoveCollectionTitle(index, languageRow.languageCode)}
                                            languagesForTranslation={languagesForTranslation}
                                            supportedLanguagesMap={this.props.supportedLanguagesMap}
                                        />
                                    ))}
                                </tbody>
                            </table>
                            {
                                !(this.state.showNewLanguage) && this.state.languageRows.filter(
                                    ({ languageCode }) => languageCode === UNDEFINED_LANG
                                ).length === 0 &&
                                <div className="collectionForm-languages">
                                    <span className="collectionForm-newLanguage" onClick={this.addNewLanguageOption.bind(this)}>
                                        {t(TK.User_LanguagePreferenceAdd)}
                                    </span>
                                </div>
                            }
                        </div>
                    </Pane>
                    <Pane label="Thumbnail">
                        <MediaPane
                            binder={collectionObject}
                            imageModuleKey="i1"
                            modalPlaceholder={modalPlaceholder}
                            onUpdateVisual={this.onUpdateVisual.bind(this)}
                            selectOtherOnDelete={true}
                            usage={MediaPaneUsage.CollectionEdit}
                            selectedVisualId={selectedVisual.id}
                            onSelect={this.onSelect.bind(this)}
                            onDoubleClickVisual={onDoubleClickVisual}
                        />
                    </Pane>
                    <Pane label={t(TK.DocManagement_ShareTitle)}>
                        <SemanticLinkManager
                            itemId={collectionId}
                            publishedLangCodes={collectionObject.titles.map(t => t.languageCode)} // collection titles are implicitly published
                            lightTheme={true}
                            documentType={DocumentType.COLLECTION}
                            unpublishedLangCodes={[]}
                        />
                    </Pane>
                </Tabs>
            </Modal>
        )
    }

}

const editCollectionFormWithHooks = withHooks(EditCollectionForm, () => ({
    supportedLanguagesMap: useSupportedLanguagesMap(),
}));
export default withTranslation()(editCollectionFormWithHooks);
