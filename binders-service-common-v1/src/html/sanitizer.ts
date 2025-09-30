import * as DOMPurify from "isomorphic-dompurify";
import { HTMLElement, parse } from "node-html-parser";
import { Logger } from "../util/logging";
import {
    incrementHtmlSanitizerStrippedHtmlCounter
} from "../monitoring/prometheus/htmlSanitizing";

type NodeAction = (node: HTMLElement) => void;

const NODE_TYPES = {
    ELEMENT: 1,
    TEXT: 3,
}

export default class HtmlSanitizer {

    protected jSoupBasicAllowList = ["a", "b", "blockquote", "br", "cite", "code", "dd", "dl", "dt", "em", "i", "li", "ol", "p", "pre", "q", "small", "span", "strike", "strong", "sub", "sup", "u", "ul"]; // from jsoup.org
    protected disallowedAttributeValues = ["javascript:", "data:"];
    protected allowRegexes = {
        tags: [...this.jSoupBasicAllowList, "img", "h1", "h2", "h3", "h4", "h5", "h6"].map(tag => `^${tag}$`),
        attributeNames: ["style", "class", "href", "target", "rel", "type"].map(attr => `^${attr}$`),
        attributeValues: [`^((?!(${this.disallowedAttributeValues.join("|")})).)*$`],
        tagAttributeCombos: [{ tagRegex: "^div$", attribute: "data-attentionblocktype" }],
    }

    constructor(protected logger: Logger, protected counterLabel: string) {
        this.sanitizeNode = this.sanitizeNode.bind(this);
        this.forHTMLElementDo = this.forHTMLElementDo.bind(this);
        this.sanitizeHtml = this.sanitizeHtml.bind(this);
    }

    protected reportStrippedHtml(html: string): void {
        this.logger.warn(`Stripped unknown html during sanitizing: ${html}`, "binder-html-sanitizing");
        incrementHtmlSanitizerStrippedHtmlCounter(this.counterLabel);
    }

    protected sanitizeNode(node: HTMLElement): void {
        if (node.nodeType === NODE_TYPES.TEXT) {
            return;
        }
        const tag = node.rawTagName;
        if (node.nodeType === NODE_TYPES.ELEMENT && tag) {

            if (this.allowRegexes.tagAttributeCombos.some(combo => new RegExp(combo.tagRegex, "gi").test(tag) && node.hasAttribute(combo.attribute))) {
                return;
            }

            if (!(this.allowRegexes.tags.some(tagRegex => new RegExp(tagRegex, "gi").test(tag)))) {
                this.reportStrippedHtml(`tag: "${tag}"`);
                node.remove();
                return;
            }
            Object.keys(node.attributes).forEach((attrName: string) => {
                if (!(this.allowRegexes.attributeNames.some(regex => new RegExp(regex, "gi").test(attrName)))) {
                    this.reportStrippedHtml(`tag: "${tag}", attribute name: "${attrName}"`);
                    node.removeAttribute(attrName);
                    return;
                }
                const attrValue = node.attributes[attrName];
                if (!(this.allowRegexes.attributeValues.some(regex => new RegExp(regex, "gi").test(attrValue)))) {
                    this.reportStrippedHtml(`tag: "${tag}", attribute value: "${attrValue}" (on attribute ${attrName})`);
                    node.removeAttribute(attrName);
                    return;
                }
            });
        }
    }

    protected forHTMLElementDo(element: HTMLElement, nodeAction: NodeAction): void {
        nodeAction(element);
        element.childNodes.forEach(node => this.forHTMLElementDo((node as HTMLElement), nodeAction));
    }

    public sanitizeHtml(chunkHtml: string): string {
        if (!chunkHtml) {
            return chunkHtml;
        }
        const rootElement = parse(chunkHtml);
        this.forHTMLElementDo(rootElement, this.sanitizeNode)
        return DOMPurify.sanitize(rootElement.toString(), { USE_PROFILES: { html: true }, ADD_ATTR: ["target"] });
    }
}


