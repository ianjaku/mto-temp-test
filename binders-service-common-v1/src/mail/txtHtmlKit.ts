/* eslint-disable @typescript-eslint/no-empty-interface */
import { CSSProperties } from "react";
import { ReaderBranding } from "@binders/client/lib/clients/routingservice/v1/contract";
import { mtBrandingMain } from "../style/const";

export type Child = number | string;
export interface IElement { }
export interface ICell extends IElement { }
export interface IRow extends IElement { }
export interface IBody extends IElement { }

export interface BodyOptions {
    maxWidthPx?: number;
}

type DefaultRenderProps = {
    style?: CSSProperties;
    align?: string;
    dangerouslySetInnerHTML?: { __html: string };
    width?: string;
    height?: string;
}

type OptionalLinkProps = {
    href?: string;
    target?: string;
}

type OptionalImgProps = {
    src?: string;
    alt?: string;
}

type OptionalTableProps = {
    cellpadding?: number;
    cellspacing?: number;
}

type RenderProps = DefaultRenderProps & OptionalLinkProps & OptionalImgProps & OptionalTableProps;

type Render<T = Child, R = Child> = (children: T | T[], props?: RenderProps) => R;

const toDash = (camel: string) => camel.replace(/[A-Z]/g, m => "-" + m.toLowerCase());
const toCss = (style: CSSProperties = {}) => Object.entries(style).map(([k, v]) => `${toDash(k)}: ${v};`).join(" ");
const toCssPropsString = (props: RenderProps): string => Object.entries(props).map(([k, v]) => k === "style" ? "" : `${toDash(k)}="${v}"`).join(" ");
const childToRow = (child: Child) => tr(td(child));

export const elem = <T, R>(name: string): Render<T, R> => (children, props: RenderProps = {}) => {
    const childrenMarkup = Array.isArray(children) ? children.join(" ") : children;
    return `<${name} ${toCssPropsString(props)} style="${toCss(props.style)}">${childrenMarkup}</${name}>` as unknown as R;
}

export const body: Render<Child, Child> = (children, props) => {
    const bodyRender = elem("body");
    return bodyRender(children, extendRenderProps(props, "defaultFontFamily")) as Child;
}

export const p: Render<Child, Child> = (children, props) => {
    return elem("p")(children, extendRenderProps(props, "looserLineHeight")) as Child;
}

export const h1: Render = elem("h1");
export const span: Render = elem("span");
export const div: Render = elem("div");
export const td: Render<Child, ICell> = elem<Child, ICell>("td");
export const tr: Render<ICell, IRow> = elem<ICell, IRow>("tr");
export const tbody: Render<IRow, IBody> = elem<IRow, IBody>("tbody");
export const table: Render<IBody, Child> = elem<IBody, Child>("table");
export const a: Render = elem("a");
export const img: Render = elem("img");

export const rawHtml: Render<string, Child> = (html: string) => {
    return html;
};

export function entity(name: string, count: number): string {
    return count === 1 ? `${count} ${name}` : `${count} ${name}s`
}

const fixedWidth = { width: "600px", marginLeft: "auto", marginRight: "auto" };

export const styles = {
    fullWidth: { width: "100%" },
    centerPaneWrapper: { width: "100%", backgroundColor: "#f3f1ef" },
    centerPane: { marginTop: "2em", marginBottom: "2em", ...fixedWidth },
    whiteBg: { backgroundColor: "#ffffff" },
    fixedWidth,
    brand: { backgroundColor: "#fac242", color: "black" },
    gapMedium: { borderSpacing: "1em" },
    gapSmall: { borderSpacing: ".5em" },
    paddingSmall: { padding: ".75em" },
    paddingMedium: { padding: "1em" },
    paddingMedium2: { padding: "1.75em" },
    paddingMediumBottom: { paddingBottom: "1em" },
    paddingMediumLeft: { paddingLeft: "1em" },
    paddingMediumRight: { paddingRight: "1em" },
    paddingMediumTop: { paddingTop: "1em" },
    paddingMediumVertical: { paddingTop: "1em", paddingBottom: "1em" },
    paddingLarge: { padding: "2em" },
    paddingLargeBottom: { paddingBottom: "2em" },
    paddingLargeHorizontal: { paddingLeft: "2em", paddingRight: "2em" },
    marginSmall: { margin: "0.5em" },
    marginLarge: { margin: "2em" },
    marginLargeTop: { marginTop: "2em" },
    marginXLargeTop: { marginTop: "3em" },
    marginLargeBottom: { marginBottom: "2em" },
    marginLargeLeft: { marginLeft: "2em" },
    marginLargeRight: { marginRight: "2em" },
    marginMediumTop: { marginTop: "1em" },
    marginMediumBottom: { marginBottom: "1em" },
    marginMedium2Top: { marginTop: "1.5em" },
    marginSmallTop: { marginTop: "0.5em" },
    block: { display: "block" },
    fontSmall: { fontSize: "0.75em" },
    fontMedium: { fontSize: "1.15em" },
    fontXLarge: { fontSize: "1.9em" },
    center: { textAlign: "center" },
    label: { fontWeight: "400", color: "hsl(39.23deg 4.27% 47.42%)" },
    value: { fontWeight: "600", color: "black" },
    box: { boxSizing: "border-box", backgroundColor: "white", border: "1px solid lightgray" },
    headerText: { fontSize: "1.5em", lineHeight: 1, margin: 0, whiteSpace: "nowrap", textAlign: "right" },
    headerLogo: { fontSize: "1.5em", lineHeight: 1, margin: 0, whiteSpace: "nowrap", textAlign: "left" },
    footerLeft: { textAlign: "left" },
    footerRight: { textAlign: "right", float: "right" },
    logoAdmin: { color: "white" },
    logoDomain: { color: "black" },
    accountsLeftColumn: { width: "25ch" },
    noGap: { padding: 0, margin: 0 },
    noMargin: { margin: 0 },
    defaultFontFamily: { fontFamily: "Helvetica, Arial, sans-serif" },
    bold: { fontWeight: "bold" },
    grayPrint: { color: "#8A9AB5" },
    colorGold: { color: "#F6CE6A" },
    button: { textDecoration: "none", padding: ".75em 1.5em", borderRadius: "5px", display: "inline-block" },
    grayFrame: { border: "1px solid #E0E0E0", borderRadius: "4px" },
    looserLineHeight: { lineHeight: "26px" },
    lightTopBorder: { border: "1px solid #E0E0E0" },
    outlineButton: { border: "2px solid #000000", color: "#000000", borderRadius: "5px", padding: ".5em .75em", fontSize: "0.75em", cursor: "pointer", fontWeight: "600" },
} as { [style: string]: CSSProperties };

type StyledContent = { content: string, style?: CSSProperties };

function extendRenderProps(props: RenderProps = {}, ...styleNames: string[]): RenderProps {
    const styleAdditionsObj = (styleNames || []).reduce((acc, styleName) => ({
        ...acc,
        ...style(styleName).style
    }), {});
    const ext = {
        ...props,
        style: {
            ...props.style,
            ...styleAdditionsObj,
        }
    }
    return ext;
}

export function style<T extends keyof typeof styles>(...keys: T[]): { style: CSSProperties } {
    return { style: keys.reduce((res, key) => ({ ...res, ...styles[key] }), {}) };
}

export function brandingBgStyle(readerBranding?: ReaderBranding): { style: CSSProperties } {
    const backgroundColor = readerBranding?.stylusOverrideProps?.bgDark || mtBrandingMain;
    const color = readerBranding?.stylusOverrideProps?.headerFontColor || "#ffffff";
    return {
        style: {
            backgroundColor,
            color,
        },
    };
}

export function brandingColorStyle(readerBranding?: ReaderBranding): { style: CSSProperties } {
    const backgroundColor = readerBranding?.stylusOverrideProps?.headerBgColor || mtBrandingMain;
    const color = readerBranding?.stylusOverrideProps?.headerFontColor || "#ffffff";
    return {
        style: {
            backgroundColor,
            color,
        },
    };
}

export function Header({ domain, title }: { domain: string, title: string }): Child {
    const [sub, dom, tld] = domain.split(".")
    const logoMarkup = [
        span(`${sub}․`, style("logoAdmin", "noGap")),
        span(`${dom}․${tld}`, style("logoDomain", "noGap")),
    ];
    const headerMarkup = [title];
    return Table([
        tr([
            td(
                h1(logoMarkup, style("headerText", "headerLogo")),
                style("paddingMedium"),
            ),
            td(
                h1(headerMarkup, style("headerText")),
                style("paddingMedium"),
            ),
        ], style("brand"))
    ], style("fullWidth"));
}

export function ImageHeader({
    hasBrandingLogo,
    fallbackText = "Manual.to",
}: { hasBrandingLogo?: boolean, fallbackText: string }, props?: RenderProps): Child {
    const centralElement = hasBrandingLogo ?
        img([], { src: "cid:brandingLogo.jpg", alt: fallbackText, height: "50px" }) :
        span(fallbackText, style("fontMedium"));

    return div([centralElement], extendRenderProps(props, "center", "paddingMedium"));
}

export function Content(children: Child[], props?: RenderProps): Child {
    return Table(children.map(childToRow), extendRenderProps(props, "fullWidth"));
}

export function Main(children: Child[], props?: RenderProps): Child {
    const rp = extendRenderProps(props, "fullWidth");
    return Table(children.map(childToRow), rp);
}

export function CenterPane(children: Child[], transparentBackground = false): Child {
    return Table(children.map(childToRow), style(
        "centerPane",
        ...(transparentBackground ? [] : ["whiteBg"])
    ));
}

export function Para(contentArray: StyledContent[], props?: RenderProps): Child {
    return p(contentArray.map(({ content, style }) => span(content, { style })), props);
}

export function Div(contentArray: StyledContent[], props?: RenderProps): Child {
    return div(contentArray.map(({ content, style }) => div(content, { style })), props);
}

export function Span(contentArray: StyledContent[], props?: RenderProps): Child {
    return span(contentArray.map(({ content, style }) => span(content, { style })), props);
}

export function Stat({ name, value }: { name: string, value: number }): ICell {
    return td([
        span(value, style("value", "block", "fontXLarge")),
        span(name, style("label", "block")),
    ], style("box", "paddingMedium"))
}

export function Table(children: IRow[], props: RenderProps = {}): Child {
    return table(
        tbody(children as ICell[]),
        {
            cellpadding: 0,
            cellspacing: 0,
            ...props,
            style: {
                border: "none",
                borderSpacing: "0",
                ...props.style,
            },
        },
    );
}

export function Button({ text, href }: { text: string, href: string }, props: RenderProps = {}): Child {
    return a(text, extendRenderProps({ ...props, href }, "button"));
}

export function Hr(props?: RenderProps): Child {
    return elem("hr")([], props) as Child;
}

export function ManualToFooter(): Child {
    return table([
        tr([
            td([
                rawHtml(`
                    <img alt="manual.to logo" width="148" height="29" src="cid:manualto.png" />
                `),
                span("@2023 Manual.to. All right reserved", {
                    style: {
                        color: "#8A9AB5", display: "block", fontSize: "12px"
                    }
                })
            ], style("footerLeft")),
            td([
                table([
                    tr([
                        td([
                            a([
                                rawHtml(`
                                    <img alt="facebook" width="20" height="21" src="cid:facebook.png" />
                                `)
                            ], extendRenderProps({ href: "https://www.facebook.com/www.manual.to", target: "_blank" }, "marginLargeLeft"))
                        ]),
                        td([
                            a([
                                rawHtml(`
                                    <img alt="instagram" width="20" height="21" src="cid:instagram.png" />
                                `)
                            ], extendRenderProps({ href: "https://www.instagram.com/manual.to", target: "_blank" }, "marginLargeLeft"))
                        ]),
                        td([
                            a([
                                rawHtml(`
                                    <img alt="x" width="20" height="21" src="cid:x.png" />
                                `)
                            ], extendRenderProps({ href: "https://x.com/manual_to", target: "_blank" }, "marginLargeLeft"))
                        ]),
                        td([
                            a([
                                rawHtml(`
                                    <img alt="linkedin" width="20" height="21" src="cid:linkedin.png" />
                                `)
                            ], extendRenderProps({ href: "https://www.linkedin.com/company/manual.to", target: "_blank" }, "marginLargeLeft"))
                        ])
                    ])
                ], extendRenderProps({ align: "right" }, "footerRight", "paddingMediumBottom"))
            ], style("footerRight"))
        ])
    ], style("fixedWidth"));
}
