import { Translation } from "@binders/client/lib/clients/repositoryservice/v3/contract";

export interface ToolbarProps {
    collapsed?: boolean;
    downloadPdf: () => Promise<void>;
    isSingleUndefinedLanguage: boolean;
    isTranslating: boolean;
    languageCode: string;
    onClickDownloadPdfButton: () => void;
    onClickMachineTranslation: () => void;
    onExpand: () => void;
    switchLanguage: () => void;
    toggleCommentsSidebar: () => void;
    toggleTranslationModal: () => void;
    translatedLanguage?: string;
    viewableTranslations: Translation[];
}

export type Visibility = "hidden" | "visible";
export type Expansion = "collapsed" | "expanded";


