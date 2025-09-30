import * as fs from "fs";
import * as fsExtra from "fs-extra";
import * as path from "path";
import {
    BinderModules,
    IBinderVisual,
    IThumbnail,
    Publication
} from "@binders/client/lib/clients/repositoryservice/v3/contract";
import { ClientRequestArgs, get as httpGet } from "http";
import {
    CustomTagStyle,
    ReaderCssProps
} from "@binders/client/lib/clients/routingservice/v1/contract";
import { Format, ImageServiceContract, Visual } from "@binders/client/lib/clients/imageservice/v1/contract";
import { IPDFExportOptions, IPDFFontsSize } from "@binders/client/lib/clients/exportservice/v1/contract";
import { LOCALIZED_SHORT_FULL_DATE_FORMAT, fmtDate, fmtNow } from "@binders/client/lib/util/date";
import {
    NoVideoFormatsError,
    extractBinderIdFromUrl,
    extractIdFromUrl,
} from "@binders/client/lib/clients/imageservice/v1/visuals";
import { findVisualIdFromUrl, fixDevUrl, getScreenshotUrlsFromVisual } from "./util";
import { isProduction, isStaging } from "@binders/client/lib/util/environment";
import { Visual as ClientVisualObject } from "@binders/client/lib/clients/imageservice/v1/Visual";
import { Logger } from "@binders/binders-service-common/lib/util/logging";
import { TranslationKeys as TK } from "@binders/client/lib/react/i18n/translations";
import { appendMadeByManualToChunk } from "../../repositoryservice/helper";
import { defaultReaderProps } from "@binders/binders-service-common/lib/style/reader";
import { getGoogleFontContent } from "@binders/binders-service-common/lib/util/googlefonts";
import { glob } from "@binders/binders-service-common/lib/util/files";
import { get as httpsGet } from "https";
import i18next from "@binders/client/lib/i18n";
import { uniq } from "ramda";
// eslint-disable-next-line @typescript-eslint/no-var-requires
const PDFMerger = require("pdf-merger-js");

// eslint-disable-next-line @typescript-eslint/no-var-requires
const URL = require("url");
// eslint-disable-next-line @typescript-eslint/no-var-requires
const wkhtmltopdf = require("wkhtmltopdf");

const PAGE_SCOPE_SIZE = 10;

const pdfConfig = {
    pageWidth: "320mm",
    pageHeight: "180mm",
    marginTop: 0,
    marginLeft: 0,
    marginRight: 0,
    marginBottom: 0,
    encoding: "utf-8",
    // debug: true,
    // debugStdOut: true
};

interface ITtfInto {
    name: string;
    url: string;
}

const defaultFontSize: IPDFFontsSize = {
    h1: 32,
    h2: 24,
    h3: 19,
    paragraph: 16,
    dateLabel: 12,
    li: 12,
};

const defaultOptions: IPDFExportOptions = {
    renderTitlePage: true,
    renderOnlyFirstCarrouselItem: true,
    fontsSize: defaultFontSize,
};

if (process.env.HOME?.trim().length === 0) {
    throw new Error("process.env.HOME was not set or is empty.")
}
const localFontsDir = process.env.HOME + "/.local/share/fonts/";

type PageSize = { pageHeightPx: number, pageWidthPx: number };
const getPageSize = (isPreview: boolean): PageSize => isPreview ?
    { pageHeightPx: 680, pageWidthPx: 1235 } :  // Kept in sync with preview modal window size
    { pageHeightPx: 850, pageWidthPx: 1500 };

const sortFormatsDecreasing = (f1: Format, f2: Format) => f1.width > f2.width ? -1 : 1;

const prepareTitlePage = async (
    publication: Publication,
    exportOptions: IPDFExportOptions,
    visuals: Array<Visual>,
    timezone: string,
    domain: string,
    bgMedium: string,
    isPreview: boolean,
    imageHost: string,
    title: string,
    exportDate: string,
    footerTextFn: FooterTextFn,
    interfaceLanguage?: string,
) => {
    if (!exportOptions.renderTitlePage) {
        return "";
    }

    const { translatedChunks, cdnnify } = exportOptions;
    const isMachineTranslated = !!translatedChunks;

    const { thumbnail } = publication
    const visualElement = prepareVisualElement(thumbnail, cdnnify, visuals, imageHost, isPreview, bgMedium);

    const t = (key: string, params = {}) => i18next.t(key, { lng: interfaceLanguage, ...params });
    const publicationDate = fmtDate(publication.publicationDate, LOCALIZED_SHORT_FULL_DATE_FORMAT, { timeZone: timezone, locale: interfaceLanguage })
    const publicationDateLabel = t(TK.Edit_PdfExportPublished, { domain, publicationDate });
    const exportDateLabel = t(TK.Edit_PdfExportPdfExported, { exportDate });
    const machineTranslatedLabel = isMachineTranslated ? t(TK.Edit_PdfExportMTInfo) : "";

    const footer = isPreview ?
        "" :
        `<div class="chunk-footer">
            <label class="chunk-footer-lbl">${footerTextFn(1, true)}</label>
        </div>`;

    return `
        <div class="chunk">
            ${visualElement}
            <div class="chunk-text">
                <div class="chunk-text-content">
                    <div class="title-wrapper" dir="auto">
                        <h1>${title}</h1>
                    </div>
                    <label class="date-lbl">${publicationDateLabel}</label>
                    <br/>
                    <label class="date-lbl">${exportDateLabel}</label>
                    <br/>
                    <label class="date-lbl">${machineTranslatedLabel}</label>
                </div>
            </div>
            ${footer}
        </div>
    `;
};

function prepareVisualElement(thumbnail: IThumbnail, cdnnify: boolean, visuals: Visual[], imageHost: string, isPreview: boolean, bgMedium: string) {
    let url = thumbnail ? thumbnail.medium : "";
    // case for cdn off and inherited thumbnail
    if (!cdnnify) {
        url = `${url}?t=${thumbnail.urlToken}`;
    }

    const visualId = extractIdFromUrl(url);
    const serviceVisual = visualId && visuals.find(v => v.id === visualId);

    const formats = serviceVisual ? serviceVisual.formats : [];
    const { pageHeightPx, pageWidthPx } = getPageSize(isPreview);
    const coverImageFormatCandidates = formats.filter(f => f.width >= pageWidthPx && f.height >= pageHeightPx).sort(sortFormatsDecreasing);
    let coverImageFormat = coverImageFormatCandidates.length > 0 && coverImageFormatCandidates[0];
    if (!coverImageFormat && formats.length > 0) {
        coverImageFormat = formats.sort(sortFormatsDecreasing)[0];
    }
    const coverImageUrl = fixDevUrl(coverImageFormat ? coverImageFormat.url : url, imageHost, isPreview);
    const visual = thumbnail ? { ...thumbnail, url: coverImageUrl } : {};

    return prepareImage(visual, bgMedium, isPreview, imageHost, serviceVisual, cdnnify);
}

const preparePdfStructure = async (
    userFont: string,
    titleFont: string,
    titlePage: string,
    chunks: string,
    fontsSize: IPDFFontsSize,
    imageServiceHost: string,
    isPreview = false,
    logger: Logger
): Promise<string> => {
    const { pageHeightPx, pageWidthPx } = getPageSize(isPreview);
    let userFontFaces = "", titleFontFaces = "", materialFontFaces = "";
    try {
        // @TODO: When not previewing use the local .ttf fonts
        userFontFaces = ((await getFontContent(userFont, imageServiceHost)).fontContent) || "";
        titleFontFaces = ((await getFontContent(titleFont, imageServiceHost)).fontContent) || "";
        materialFontFaces = ((await getFontContent("Material Icons", imageServiceHost)).fontContent) || "";
    } catch (error) {
        logger.error(`Failed to get font content: ${error}`, "pdf-export")
    }
    return `
      <html style="font-size: 10px">
        <head>
            <style>
                ${userFontFaces}
                ${titleFontFaces}
                ${materialFontFaces}
                body {
                    margin: 0;
                }
                img.emoji {
                    height: 1em;
                    width: 1em;
                    margin: 0 .05em 0 .1em;
                    vertical-align: -0.1em;
                }
                ul li, ol li {
                    margin-top: 1rem;
                    margin-bottom: 1rem;
                }
                strong {
                    font-weight: bold !important;
                }
                .title-wrapper h1 {
                    margin-bottom: 2em;
                }
                .chunk {
                    display: block;
                    width: 100%;
                    height: ${pageHeightPx}px;
                    page-break-before: always;
                    clear: both;
                    margin-bottom: ${isPreview ? "20px" : "initial"};
                    position: relative;
                }
                .screenshots-wrapper {
                    float: left;
                    font-size: 0px;
                }
                .screenshot {
                    width: ${Math.floor(pageHeightPx / 3) - 2}px;
                    height: ${Math.floor(pageHeightPx / 3) - 2}px;
                    background-position: center;
                    background-repeat: no-repeat;
                    display: inline-block;
                    margin-top: 1px;
                }
                .middle-screenshot {
                    margin-left: 2px;
                    margin-right: 2px;
                    margin-top: 1px;
                }
                .crop {
                    background-size: cover;
                }
                .fit {
                    background-size: contain;
                }
                .chunk-visual {
                    height: ${pageHeightPx}px;
                    width: ${pageHeightPx}px;
                    box-shadow: 1px 0px 0px 0px #e4e4e4;
                    background-position: center;
                    background-repeat: no-repeat;
                    float: left;
                }
                .chunk-text {
                    word-break: break-word;
                    padding: ${isPreview ? "0px" : "0px 20px"};
                    font-family: ${userFont};
                    height: ${pageHeightPx}px;
                    width: ${pageWidthPx - pageHeightPx - 40}px;
                    display: table;
                    overflow-y: visible !important;
                    overflow-x: hidden;
                    ${isPreview ? "float: right;" : ""}
                }
                .chunk-text-content {
                    display: table-cell;
                    vertical-align: middle;
                    height: 100%;
                    width: 100%;
                    overflow-y: visible !important;
                }
                .carrousel-thumbs {
                    text-align: center;
                    clear: both;
                }
                .carrousel-wrapper .chunk-visual {
                    box-shadow: initial;
                }
                .carrousel-cover .chunk-visual {
                    float: none;
                    margin: 0 auto;
                }
                .chunk-footer {
                    bottom: 10px;
                    right: 10px;
                    width: 100%;
                    text-align: right;
                    position: absolute;
                    z-index: 10;
                }
                h1 {
                    font-size: ${fontsSize.h1}px;
                }
                h2 {
                    font-size: ${fontsSize.h2}px;
                }
                h3 {
                    font-size: ${fontsSize.h3}px;
                }
                h1, h2, h3, h4, h5, h6 {
                    font-family: ${titleFont}
                }
                p {
                    font-size: ${fontsSize.paragraph}px;
                }
                .date-lbl {
                    font-size: ${fontsSize.dateLabel}px;
                }
                .chunk-footer-lbl {
                    font-size: 10px;
                    font-family: ${userFont};
                    color: #666666;
                }
                ul,ol li {
                    font-size: ${fontsSize.li}px;
                }
                div[data-attentionblocktype="info"] {
                    padding: ${fontsSize.paragraph / 2}px ${fontsSize.paragraph * 2}px ${fontsSize.paragraph / 2}px ${fontsSize.paragraph * 2}px;
                    margin-bottom: ${fontsSize.paragraph}px;
                    display: table; /* alternative to width: fit-content, which does not work in wkhtmltopdf */
                    position: relative;
                    background-color: #fcf1d2;
                    border-left: 4px solid #ffc100;
                }
                div[data-attentionblocktype="info"]::before {
                    font-family: "Material Icons";
                    font-size: ${fontsSize.paragraph / 0.9};
                    position: absolute;
                    top: ${fontsSize.paragraph / 1.7};
                    left: ${fontsSize.paragraph / 2};
                    content: "\\e0f0";
                    color: #ffc100;
                }
                div[data-attentionblocktype="info"] p {
                    margin: 0 !important;
                }
                div[data-attentionblocktype="warning"] {
                    padding: ${fontsSize.paragraph / 2}px ${fontsSize.paragraph * 2}px ${fontsSize.paragraph / 2}px ${fontsSize.paragraph * 2}px;
                    margin-bottom: ${fontsSize.paragraph}px;
                    display: table; /* alternative to width: fit-content, which does not work in wkhtmltopdf */
                    position: relative;
                    background-color: #fce4d0;
                    border-left: 4px solid #ff7a00;
                }
                div[data-attentionblocktype="warning"]::before {
                    font-family: "Material Icons";
                    font-size: ${fontsSize.paragraph / 0.9};
                    position: absolute;
                    top: ${fontsSize.paragraph / 1.7};
                    left: ${fontsSize.paragraph / 2};
                    content: "\\e002";
                    color: #ff7a00;
                }
                div[data-attentionblocktype="warning"] p {
                    margin: 0 !important;
                }
            </style>
            <script src="https://cdnjs.cloudflare.com/ajax/libs/twemoji/11.2.0/twemoji.min.js"></script>
            <script>window.onload = function () { twemoji.parse(document.body);}</script>
        </head>
        <body>${titlePage}${chunks}</body>
      </html>
    `;
};

const prepareRotationProperty = (rotation: number) => {
    const rotationValue = !rotation ? "0" : `rotate(${rotation}deg)`;
    return `transform: ${rotationValue}; ` +
        `-webkit-transform: ${rotationValue};`;
}

const prepareImage = (
    visual,
    bgMedium: string,
    isPreview: boolean,
    imageServiceHost: string,
    serviceVisual?: Visual,
    cdnnify?: boolean,
    width?: number,
    height?: number,
): string => {
    const visualWithUrlToken = serviceVisual ? { ...visual, urlToken: serviceVisual.urlToken } : visual;
    const visualObj = Object.assign(Object.create(ClientVisualObject.prototype), visualWithUrlToken);
    const serviceVisualObj = Object.assign(Object.create(ClientVisualObject.prototype), serviceVisual);
    const { url, fitBehaviour, bgColor: backgroundColor, rotation } = visual;
    const { pageHeightPx } = getPageSize(isPreview);
    const isVideo = serviceVisual && serviceVisual.id.startsWith("vid-");
    let visualUrl: string;

    if (visual.id === "img-0") {
        visualUrl = visual.url;
    } else {
        const originalFormat = serviceVisual ? (serviceVisual.formats as Array<Format>).find(f => f.name === "ORIGINAL") : visualWithUrlToken;
        const isLandscape = originalFormat.width > originalFormat.height;
        const viewPortDimension = pageHeightPx;
        const viewportDims = { width: viewPortDimension, height: viewPortDimension }

        if (!cdnnify) {
            const image = serviceVisual ? serviceVisualObj.buildRenderUrl({ bestFitOptions: { isLandscape, viewportDims } }) : url;
            visualUrl = isVideo ?
                (visualObj.buildRenderUrl({ url: (serviceVisual.formats as Array<Format>).find(f => f.name === "VIDEO_SCREENSHOT_BIG").url })) :
                image;
        } else {
            const image = serviceVisual ? serviceVisualObj.buildRenderUrl({ bestFitOptions: { isLandscape, viewportDims } }) : url;
            visualUrl = isVideo ?
                (visualObj.buildRenderUrl({ url: (serviceVisual.formats as Array<Format>).find(f => f.name === "VIDEO_SCREENSHOT_BIG").url })) :
                (image);
        }
    }

    let style = `background-color: ${formatColor(backgroundColor || bgMedium)}; background-image: url(${fixDevUrl(visualUrl, imageServiceHost, isPreview)}); ` +
        prepareRotationProperty(rotation);
    if (width !== undefined) {
        style += `width: ${width}px;`
    }
    if (height !== undefined) {
        style += `height: ${height}px;`
    }
    return `
         <div class="chunk-visual ${fitBehaviour || "fit"}" style="${style}">
         </div>
     `;
};

const SCREENSHOT_NAME_PATTERN = /THUMBNAIL_0+([0-9])VIDEO_SCREENSHOT/;
const cmpScreenShots = (left: string, right: string) => {
    const matchesLeft = left.match(SCREENSHOT_NAME_PATTERN);
    const matchesRight = right.match(SCREENSHOT_NAME_PATTERN);
    if (matchesRight !== null && matchesLeft !== null) {
        const leftIndex = Number.parseInt(matchesLeft[1], 10);
        const rightIndex = Number.parseInt(matchesRight[1], 10);
        return leftIndex - rightIndex;
    }
    return 0;
}

const prepareVideo = (
    visual: IBinderVisual,
    bgMedium: string,
    binderId: string,
    serviceVisual: Visual,
    isPreview: boolean,
    imageServiceHost: string,
    cdnnify?: boolean
): string => {
    let screenshotUrls = getScreenshotUrlsFromVisual(visual, serviceVisual, cdnnify, imageServiceHost, isPreview, binderId);
    if (screenshotUrls.length < 9) {
        throw new NoVideoFormatsError();
    }
    screenshotUrls = screenshotUrls.length > 9 ? screenshotUrls.slice(1, 10) : screenshotUrls;
    screenshotUrls.sort(cmpScreenShots);
    const backgroundColor = formatColor(visual.bgColor ?? bgMedium);
    return `
        <div class="screenshots-wrapper chunk-visual">
            ${screenshotUrls.map((ssUrl, i) => {
        const dimDumpClasses = `
                    ${[1, 4, 7].indexOf(i) > -1 ? "middle-screenshot" : ""}
                `;
        return `
                    <div class="visual screenshot ${visual.fitBehaviour} ${dimDumpClasses}" style="background-color: ${backgroundColor}; background-image: url(${ssUrl})"></div>
                `;
    }).join("")}
        </div>
    `;
};

const prepareCarousel = (
    chunkImages: IBinderVisual[],
    bgMedium: string,
    visuals: Array<Visual>,
    isPreview: boolean,
    imageServiceHost: string,
    cdnnify?: boolean,
) => {
    const { pageHeightPx } = getPageSize(isPreview);
    const { length: numberOfChunkImages } = chunkImages;
    const numberOfThumbs = numberOfChunkImages - 1;
    const cover = chunkImages[0];
    const coverVisual = visuals.find(v => v.id === cover.id);

    const bottomSectionHeightPercentage = chunkImages.length < 4 ? 38 : Math.floor(100 / numberOfThumbs);
    const bottomSectionHeightFactor = bottomSectionHeightPercentage / 100;
    const bottomSectionHeight = Math.floor(pageHeightPx * bottomSectionHeightFactor);
    const topSectionHeight = pageHeightPx - bottomSectionHeight;

    const thumbWidth = Math.floor((1 / numberOfThumbs) * pageHeightPx);
    const lastThumbWidth = pageHeightPx - (thumbWidth * (numberOfThumbs - 1));

    return `
        <div class="carrousel-wrapper chunk-visual">
            <div class="carrousel-cover">
                ${prepareImage(cover, bgMedium, isPreview, imageServiceHost, coverVisual, cdnnify, pageHeightPx, topSectionHeight)}
            </div>
            <div class="carrousel-thumbs">
                ${chunkImages.slice(1).map((visual, pos) => prepareImage(
        visual,
        bgMedium,
        isPreview,
        imageServiceHost,
        visuals.find(v => v.id === visual.id),
        cdnnify,
        (pos === numberOfThumbs - 1) ? lastThumbWidth : thumbWidth,
        bottomSectionHeight
    )).join("")}
            </div>
        </div>
    `;
};

type Scope = { start: number, end: number };

interface IPrepareChunksResult {
    html: string;
    nextScope?: Scope;
}

const prepareChunks = async (
    publication: Publication,
    exportOptions: IPDFExportOptions,
    pageScope: Scope,
    visuals: Array<Visual>,
    bgMedium: string,
    imageServiceHost: string,
    footerTextFn: FooterTextFn,
    customStyles?: CustomTagStyle[],
    isPreview?: boolean,
): Promise<IPrepareChunksResult> => {

    const moduleKey = publication.language.modules[0];
    const chunks = publication.modules.text.chunked.filter(({ key }) => (key === moduleKey))[0].chunks;

    const { translatedChunks } = exportOptions;
    const chunksToIterate = (translatedChunks || chunks.map(chunk => chunk[0]));
    const { start, end } = pageScope;
    const scopedChunks = chunksToIterate.slice(start, end);

    const html = scopedChunks.map((html, index) =>
        prepareChunk(
            publication,
            exportOptions,
            visuals,
            html,
            index + start,
            bgMedium,
            imageServiceHost,
            footerTextFn,
            customStyles,
            isPreview,
        ),
    ).join("");

    const nextScope = chunksToIterate.length > end ?
        { start: end, end: end + PAGE_SCOPE_SIZE } as Scope :
        undefined;

    return {
        html,
        nextScope,
    }
};

const prepareChunk = (
    publication: Publication,
    exportOptions: IPDFExportOptions,
    visuals: Array<Visual>,
    html: string,
    index: number,
    bgMedium: string,
    imageServiceHost: string,
    footerTextFn: FooterTextFn,
    customStyles?: CustomTagStyle[],
    isPreview?: boolean,
) => {
    const visualElement = prepareChunkVisualElement(
        publication,
        exportOptions,
        index,
        bgMedium,
        visuals,
        isPreview,
        imageServiceHost,
    );

    let content = html || "";
    if (customStyles) {
        customStyles.forEach(customStyle => {
            const { tag, style } = customStyle;
            const inlineStyle = style.replace("\n", " ");
            content = content.replace(
                new RegExp(`<${tag}`, "g"),
                `<${tag} style="${inlineStyle}"`,
            );
        });
    }
    const pageNumber = index + 2;  // 1 for title and 1 for 0 indexing of chunk

    const footer = isPreview ?
        "" :
        `<div class="chunk-footer">
            <label class="chunk-footer-lbl">${footerTextFn(pageNumber)}</label>
        </div>`;

    return `
        <div class="chunk">
            ${visualElement}
            <div class="chunk-text">
                <div class="chunk-text-content" dir="auto">
                    ${content}
                </div>
            </div>
            ${footer}
        </div>
    `;
};

function prepareChunkVisualElement(
    publication: Publication,
    exportOptions: IPDFExportOptions,
    index: number,
    bgMedium: string,
    visuals: Visual[],
    isPreview: boolean,
    imageServiceHost: string,
) {
    const { renderOnlyFirstCarrouselItem, cdnnify } = exportOptions;
    const pubVisuals = publication.modules.images.chunked[0].chunks[index];
    const firstVisual = pubVisuals[0];
    let visualEl = `
        <div class="visual chunk-visual" style="background-color: ${formatColor(bgMedium)};">
        </div>
    `;
    if (pubVisuals.length > 1 && !renderOnlyFirstCarrouselItem) {
        visualEl = prepareCarousel(pubVisuals, bgMedium, visuals, isPreview, imageServiceHost, cdnnify);
    }
    else if (firstVisual) {
        const { id: visualId, url } = firstVisual;
        const id = visualId || findVisualIdFromUrl(url);
        const serviceVisual = visuals.find(v => v.id === id);
        const isVideo = id.startsWith("vid-");
        visualEl = isVideo ?
            prepareVideo(firstVisual, bgMedium, publication.binderId, serviceVisual, isPreview, imageServiceHost, cdnnify) :
            prepareImage(firstVisual, bgMedium, isPreview, imageServiceHost, serviceVisual, cdnnify);
    }
    return visualEl;
}

const ensureFontsInstalled = async (userFont: string, titleFont: string) => {
    for (const font of [userFont, titleFont]) {
        const firstLetter = font.slice(0, 1);
        const rest = font.slice(1);
        const { length } = await glob(`${localFontsDir}${firstLetter.toUpperCase()}${rest.toLowerCase()}*`);
        if (length === 0) {
            await installFont(font);
        }
    }
};

const getFontContent = async (fontName: string, imageServiceHost: string) => {
    let fontContent = <string>(await getGoogleFontContent(fontName));
    let format = "truetype";

    if (fontContent.indexOf("Font family not found") > -1) {
        format = "woff";
        const imageServiceUrl = `${imageServiceHost}/images/v1/fonts/`;
        fontContent = await new Promise<string>(resolve => {
            const buffer = [];
            const url = URL.parse(imageServiceUrl.concat(fontName.toLowerCase()));
            const requestOptions: ClientRequestArgs = {
                protocol: url.protocol,
                hostname: url.hostname,
                path: url.pathname,
                port: isProduction() || isStaging() ? "443" : url.port,
                headers: { "Connection": "Keep-Alive" },
                timeout: 10000,
            };
            const get = isProduction() || isStaging() ? httpsGet : httpGet;
            get(requestOptions, response => {
                response.on("data", chunk => {
                    buffer.push(chunk);
                });
                response.on("end", () => {
                    resolve(buffer.join(""));
                });
            })
                // eslint-disable-next-line no-console
                .on("error", err => console.error("Error downloading ", fontName, err));
        });
    }

    return { format, fontContent };
};

const installFont = async (fontName: string) => {
    await fsExtra.ensureDir(localFontsDir);
    const fontContent = <string>(await getGoogleFontContent(fontName));
    const regex = /src:.*, local\('(.*)'\), url\((.*)\) format\('truetype'\);/g;
    const ttfArray = [] as ITtfInto[];
    let regExpExecArray: RegExpExecArray;
    // eslint-disable-next-line no-cond-assign
    while (regExpExecArray = regex.exec(fontContent)) {
        const name = regExpExecArray[1];
        const url = regExpExecArray[2];
        ttfArray.push({ name, url });
    }
    const ttfBatches = ttfArray.reduce((batches, ttf, i) => {
        const arr = i % 3 === 0 ? [] : batches.pop();
        arr.push(ttf);
        return [...batches, arr];
    }, []);
    for (const ttfBatch of ttfBatches) {
        await Promise.all(ttfBatch.map(downloadTtf));
    }
};

const downloadTtf = async (ttf: ITtfInto) => {
    const { name, url } = ttf;
    const fontPath = `${localFontsDir}${name}.ttf`;
    const file = fs.createWriteStream(fontPath);
    const ttfUrl = URL.parse(url);
    const requestOptions: ClientRequestArgs = {
        protocol: ttfUrl.protocol,
        hostname: ttfUrl.hostname,
        path: ttfUrl.pathname,
    };
    return new Promise((resolve, reject) => {
        httpsGet(requestOptions, response => {
            response.pipe(file);
            file.on("finish", () => {
                file.close();
            });
        }).on("error", (err) => {
            fs.unlink(fontPath, () => undefined);
            reject(err);
        }).on("finish", resolve);
    });
};


export const buildPublicationHTMLParts = async (
    publication: Publication,
    visuals: Array<Visual>,
    stylusOverrideProps: Partial<ReaderCssProps>,
    timezone: string,
    domain: string,
    options: IPDFExportOptions,
    logger: Logger,
    imageServiceHost: string,
    translateFn?: (title: string) => Promise<string>,
    isPreview = true,
    interfaceLanguage?: string,
    skipInstallingFonts?: boolean,
): Promise<string[]> => {
    const userFont = stylusOverrideProps.userFont || defaultReaderProps.userFont;
    const titleFont = stylusOverrideProps.titleFont || defaultReaderProps.titleFont;
    const bgMedium = (stylusOverrideProps.bgMedium || defaultReaderProps.bgMedium);
    if (!skipInstallingFonts) {
        await ensureFontsInstalled(userFont, titleFont);
    }
    const exportOptions: IPDFExportOptions = { ...defaultOptions, ...options };
    let properPublication = publication;
    if (options.shouldRenderAdditionalChunk) {
        const langCode = publication.language.iso639_1;
        const translatedText = await options.translateAdditionalChunk((!langCode || langCode === "xx") ? "en" : langCode);
        properPublication = {
            ...publication, modules: <BinderModules>(await appendMadeByManualToChunk(
                { ...publication.modules },
                options.shouldRenderAdditionalChunk,
                translatedText,
            ))
        }
    }

    let title = publication.language.storyTitle;
    if (typeof translateFn === "function") {
        title = await translateFn(title);
    }
    const exportDate = fmtNow(LOCALIZED_SHORT_FULL_DATE_FORMAT, { timeZone: timezone, locale: interfaceLanguage });
    const footerTextFn = getFooterTextFn(publication, options, title, exportDate, interfaceLanguage);

    const titlePage = await prepareTitlePage(
        publication,
        exportOptions,
        visuals,
        timezone,
        domain,
        bgMedium,
        isPreview,
        imageServiceHost,
        title,
        exportDate,
        footerTextFn,
        interfaceLanguage,
    );
    let pageScope: Scope = { start: 0, end: PAGE_SCOPE_SIZE };
    const htmlParts = [];
    let i = 0;
    while (pageScope) {
        const { html: chunksHtml, nextScope } = await prepareChunks(
            properPublication,
            exportOptions,
            pageScope,
            visuals,
            bgMedium,
            imageServiceHost,
            footerTextFn,
            stylusOverrideProps.customTagsStyles,
            isPreview,
        );
        const { fontsSize } = exportOptions;
        const pdfHtml = await preparePdfStructure(
            userFont,
            titleFont,
            !i ? titlePage : "",
            chunksHtml,
            fontsSize,
            imageServiceHost,
            isPreview,
            logger
        );
        htmlParts.push(pdfHtml);
        pageScope = nextScope;
        i++;
    }
    return htmlParts;
};


type FooterTextFn = (pageNumber: number, isTitlePage?: boolean) => string
function getFooterTextFn(
    publication: Publication,
    options: IPDFExportOptions,
    title: string,
    exportDate: string,
    interfaceLanguage?: string
): FooterTextFn {
    const translatedExportDate = i18next.t(TK.Edit_PdfExportDate, { lng: interfaceLanguage, exportDate });
    const numberOfPages = 1 + publication.modules.text.chunked[0].chunks.length + (options.shouldRenderAdditionalChunk ? 1 : 0);
    const titleAndExportDate = `${title}<br>${translatedExportDate}&emsp;`
    return (pageNumber: number, isTitlePage = false) => `${isTitlePage ? "" : titleAndExportDate}${pageNumber}/${numberOfPages}`;
}

async function generatePdfPart(html: string, logger: Logger, partPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
        const arrayBuffer = [];
        const socket = wkhtmltopdf(html, pdfConfig);
        socket.on("error", err => {
            const errStr = err.toString();
            if (!errStr.includes("ContentNotFoundError") && !errStr.includes("UnknownContentError")) {
                // these errors can occur when a visual isn't found (typically production images on dev)
                // the pdf is still generated though, so they shouldn't be considered fatal
                reject(err);
            }
        });
        socket.on("data", chunk => arrayBuffer.push(chunk));
        socket.on("end", async () => {
            if (arrayBuffer.length === 0) {
                const msg = "Empty file generated";
                logger.error(msg, "pdf-export");
                reject(new Error(msg));
            } else {
                await fsExtra.writeFile(partPath, Buffer.concat(arrayBuffer));
                resolve();
            }
        });
    });
}


async function generatePdfAttempt(htmlParts: string[], logger: Logger): Promise<Buffer> {
    let i = 0;
    const partTitleBase = `${Math.random()}`.substring(2);
    const merger = new PDFMerger();
    for await (const htmlPart of htmlParts) {
        const partPath = `/tmp/${partTitleBase}_${i++}.pdf`;
        await generatePdfPart(htmlPart, logger, partPath);
        await merger.add(partPath);
    }
    await merger.save(`/tmp/${partTitleBase}.pdf`);
    return fsExtra.readFile(`/tmp/${partTitleBase}.pdf`);
}

async function cleanup() {
    for (const file of fs.readdirSync("/tmp").filter(fn => fn.endsWith(".pdf"))) {
        fsExtra.unlinkSync(path.join("/tmp", file));
    }
}


async function sleep(timeout: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, timeout));
}

async function generatePdf(htmlParts: string[], logger: Logger): Promise<Buffer> {
    let attempt = 1;
    let timeout = 0;
    let error: Error;
    while (attempt <= 5) {
        try {
            await sleep(timeout);
            logger.debug(`pdf generation attempt ${attempt}`, "pdf-export");
            return await generatePdfAttempt(htmlParts, logger);
        } catch (e) {
            error = e;
            attempt++;
            timeout += 2000;
        } finally {
            cleanup();
        }
    }
    throw new Error(`Pdf not successfully generated after 5 attempts (last error ${error.message})`);
}

async function getTitleVisual(
    publication: Publication,
    imageServiceContract: ImageServiceContract,
    logger: Logger,
    options?: IPDFExportOptions,
): Promise<Visual> {
    const detectedBinderIds = ["bare", "original", "medium", "thumbnail", "tiny"].reduce((reduced, formatName) => {
        const binderId = publication.thumbnail[formatName] && extractBinderIdFromUrl(publication.thumbnail[formatName]);
        if (binderId) {
            reduced.add(binderId);
        }
        return reduced;
    }, new Set<string>());

    const binderIdsToTry = uniq([
        ...detectedBinderIds,
        publication.thumbnail["ancestorCollectionId"],
    ]);

    for (const binderId of binderIdsToTry) {
        try {
            return await imageServiceContract.getVisual(
                binderId,
                extractIdFromUrl(publication.thumbnail.medium),
                { cdnnify: options?.cdnnify }
            );
        } catch (e) {
            logger.warn(`Error (${e.message}) in fetching visual based on binderId ${binderId}`, "get-title-visual");
        }
    }
    logger.error(`Could not fetch title visual for publication ${publication.id}`, "get-title-visual");
    return undefined;
}

export async function getPublicationVisualsForPdfExport(
    publication: Publication,
    imageServiceContract: ImageServiceContract,
    logger: Logger,
    options?: IPDFExportOptions,
): Promise<Visual[]> {
    const [binderVisuals, titleVisual] = await Promise.all([
        imageServiceContract.listVisuals(publication.binderId, { cdnnify: options?.cdnnify }),
        publication.thumbnail?.ancestorCollectionId && publication.thumbnail.thumbnail ?
            getTitleVisual(publication, imageServiceContract, logger, options) :
            Promise.resolve(undefined as Visual),
    ]);

    const maybeOriginalVisuals = await binderVisuals.reduce(async (reducedPromise, binderVisual) => {
        const reduced = await reducedPromise;
        const { originalVisualData } = binderVisual;
        if (!originalVisualData) { return reduced; }
        const { binderId, originalId } = originalVisualData;
        const visual = await imageServiceContract.getVisual(binderId, originalId, { cdnnify: options?.cdnnify });
        return [...reduced, visual];
    }, Promise.resolve([] as Visual[]));

    return [
        ...binderVisuals,
        ...maybeOriginalVisuals,
        ...(titleVisual ? [titleVisual] : []),
    ].filter(v => !!v);
}

export const exportPublicationAsPdf = async (
    publication: Publication,
    visuals: Array<Visual>,
    stylusOverrideProps: Partial<ReaderCssProps>,
    timezone: string,
    domain: string,
    options: IPDFExportOptions,
    logger: Logger,
    imageServiceHost: string,
    translateFn?: (title: string) => Promise<string>,
    interfaceLanguage?: string,
): Promise<Buffer> => {
    const htmlParts = await buildPublicationHTMLParts(
        publication,
        visuals,
        stylusOverrideProps,
        timezone,
        domain,
        options,
        logger,
        imageServiceHost,
        translateFn,
        false,
        interfaceLanguage,
    );
    return generatePdf(htmlParts, logger);
};

const formatColor = (cssColor: string): string =>
    cssColor.startsWith("#") ? cssColor : `#${cssColor}`;
