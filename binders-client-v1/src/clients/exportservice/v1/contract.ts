export interface ExportServiceContract {

    docInfosCsv(
        accountId: string,
    ): Promise<string>;

    colInfosCsv(
        accountId: string,
    ): Promise<string>;

    exportPublication(
        publicationId: string,
        domain: string,
        timezone: string,
        options?: IPDFExportOptions,
        from?: "reader" | "editor",
    ): Promise<string>;

    getPdfExportOptionsForBinder(
        binderId: string,
        languageCode: string,
    ): Promise<IPDFExportOptions>;

    previewExportPublication(
        publicationId: string,
        domain: string,
        timezone: string,
        options?: IPDFExportOptions,
    ): Promise<string>;

}

export interface IPDFFontsSize {
    h1: number;
    h2: number;
    h3: number;
    paragraph: number;
    dateLabel: number;
    li: number;
}

export interface IPDFExportOptions {
    renderTitlePage?: boolean;
    renderOnlyFirstCarrouselItem?: boolean;
    fontsSize?: IPDFFontsSize;
    translatedChunks?: string[];
    languageCode?: string;
    cdnnify?: boolean;
    shouldRenderAdditionalChunk?: boolean;
    translateAdditionalChunk?: (langCode: string) => Promise<string>;
}

