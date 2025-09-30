import BinderClass from "@binders/client/lib/binders/custom/class";
import { BinderVisual } from "@binders/client/lib/clients/repositoryservice/v3/BinderVisual";
import { BindersModuleMeta } from "@binders/client/lib/clients/repositoryservice/v3/contract";
import { EditorState } from "draft-js";
import { Language } from "@binders/client/lib/clients/repositoryservice/v3/contract";
import { SetStateBinderFn } from "../../hooks/useStateBinder";

export interface IBinderLanguageProps {
    binder: BinderClass;
    changeLanguage: (lang, cb) => void;
    className?: string;
    hasDraft: boolean;
    hasPublications: boolean;
    includeVisuals?: boolean;
    isPrimary?: boolean;
    isInDiffView: boolean;
    isInTranslationView: boolean;
    languageCode: string;
    languagesVisibleInDropdown: Language[];
    opposingLanguageCode: string;
    readonlyMode?: boolean;
    setStateBinder: SetStateBinderFn;
}

export interface IDocumentInfo {
    chunk1EqualsTitle: boolean;
    documentHasVisuals: boolean;
    isEmptyDocument: boolean;
    isTitleTextEmpty: boolean;
    moduleSets: IModuleSet[],
    titleModuleSet: IModuleSet,
}

export interface IModuleImageSet {
    images?: Array<BinderVisual>;
    meta?: BindersModuleMeta;
}

export interface IModuleTextSet {
    data?: Array<Array<string>>;
    json?: string;
    meta?: BindersModuleMeta;
    state?: EditorState;
}

export interface IModuleSet {
    image: IModuleImageSet;
    isEmpty?: boolean;
    isEmptyAcrossLanguages?: boolean;
    text: IModuleTextSet;
    uuid?: string;
}
