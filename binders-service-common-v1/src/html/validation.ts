import { valid } from "node-html-parser";

export function isValidHtml(candidate: string): boolean {
    return valid(candidate);
}
