import DOMPurify from "dompurify";

export function sanitizeUserInput(text: string): string {
    if (!text) {
        return text;
    }
    return DOMPurify.sanitize(text, { USE_PROFILES: { html: true } });
}