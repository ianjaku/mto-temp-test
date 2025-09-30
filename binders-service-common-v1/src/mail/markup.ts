import {
    CenterPane,
    Child,
    Content,
    ImageHeader,
    Main,
    ManualToFooter,
    Para,
    body,
    brandingBgStyle,
    style
} from "./txtHtmlKit";
import { Attachment } from "./mailgun";
import { ReaderBranding } from "@binders/client/lib/clients/routingservice/v1/contract";
import { TK } from "@binders/client/lib/react/i18n/translations";
import i18next from "@binders/client/lib/i18n";

interface TransactionalMailMarkupOptions {
    salutation?: string;
    includeSignature?: boolean;
    transparentBackgroundInCenterPane?: boolean;
    noPaddingInCenterRange?: boolean;
}

export interface TransactionalMailMarkup {
    html: string,
    inlineAttachments?: Array<Attachment>;
}

export function buildTransactionalMailMarkup(
    imageHeaderFallbackText: string,
    children: Child[],
    readerBranding?: ReaderBranding,
    options: TransactionalMailMarkupOptions = {},
): TransactionalMailMarkup {
    const brandingLogo = readerBranding?.logo?.base64Strings?.small;
    const html = `${body(
        Main(
            [
                CenterPane([
                    ImageHeader({
                        hasBrandingLogo: !!brandingLogo,
                        fallbackText: imageHeaderFallbackText,
                    }, brandingBgStyle(readerBranding)),
                    Content(
                        [
                            ...(options.salutation ?
                                [
                                    Para([
                                        { content: options.salutation },
                                    ], style(
                                        "center",
                                        "fontXLarge",
                                        "paddingMedium",
                                        "noMargin",
                                        ...(options.transparentBackgroundInCenterPane ? ["whiteBg"] : []), // transparentBackgroundInCenterPanes excludes the salutation section right now
                                    )),
                                ] :
                                []),
                            ...children,
                            ...(options.includeSignature ?
                                [
                                    Para([
                                        { content: `${i18next.t(TK.General_Regards)}, Manual.to` },
                                    ], style("marginLargeTop", "marginMediumBottom", "grayPrint", "center")),
                                ] :
                                []),
                        ],
                        style(
                            "fontMedium",
                            ...(options.noPaddingInCenterRange ? [] : ["paddingLarge"]),
                        )
                    ),
                ], options.transparentBackgroundInCenterPane),
                ManualToFooter(),
            ],
            style("centerPaneWrapper")
        ),
    )}`;

    const inlineAttachments = [
        {
            filename: "manualto.png",
            path: `${global["commonStaticRoot"]}/email-icons/manualto.png`,
            cid: "manualto.png",
        },
        {
            filename: "facebook.png",
            path: `${global["commonStaticRoot"]}/email-icons/facebook.png`,
            cid: "facebook.png",
        },
        {
            filename: "instagram.png",
            path: `${global["commonStaticRoot"]}/email-icons/instagram.png`,
            cid: "instagram.png",
        },
        {
            filename: "linkedin.png",
            path: `${global["commonStaticRoot"]}/email-icons/linkedin.png`,
            cid: "linkedin.png",
        },
        {
            filename: "x.png",
            path: `${global["commonStaticRoot"]}/email-icons/x.png`,
            cid: "x.png",
        },
        ...(brandingLogo ?
            [{
                filename: "brandingLogo.jpg",
                data: Buffer.from(brandingLogo, "base64"),
                cid: "brandingLogo.jpg",
            }] :
            []),
    ];
    return { html, inlineAttachments };
}