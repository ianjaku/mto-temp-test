import BinderHtmlSanitizer from "../../../src/repositoryservice/BinderHtmlSanitizer";
import { LoggerBuilder } from "@binders/binders-service-common/lib/util/logging";
import { ObjectConfig } from "@binders/client/lib/config/config";

describe("sanitize html fragments", () => {

    const sanitizer = new BinderHtmlSanitizer(
        LoggerBuilder.fromConfig(new ObjectConfig({
            logging: {
                default: {
                    level: "TRACE"
                }
            }
        }))
    );

    it("should remove tags not on allowList", () => {
        const html = "<script>xss()</script><SCRIPT>xss2()</SCRIPT><p><span>content<span><article>How did that get in here?</article></p>";
        const expectedResult = "<p><span>content</span></p>";
        const sanitizedHtml = sanitizer.sanitizeHtml(html);
        expect(sanitizedHtml).toEqual(expectedResult)
    });
    it("should remove attribute names not on allowList", () => {
        const html = "<p style=\"font-size: 2em\" onClick=\"console.log('I-iz-Hax0rZ')\"><span onMouseOver=\"blowUp()\">content<span></p>";
        const expectedResult = "<p style=\"font-size: 2em\"><span>content</span></p>";
        const sanitizedHtml = sanitizer.sanitizeHtml(html);
        expect(sanitizedHtml).toEqual(expectedResult)
    });
    it("should remove attribute values not on allowList", () => {
        const html = "<p><a href=\"manual.to/allowed/url/with/javascript/in/it\" target=\"_blank\" rel=\"noopener noreferrer\">Manual.to</a><a href='javascript:doIllegalStuff'>content</a></p>";
        const expectedResult = "<p><a href=\"manual.to/allowed/url/with/javascript/in/it\" target=\"_blank\" rel=\"noopener noreferrer\">Manual.to</a><a>content</a></p>";
        const sanitizedHtml = sanitizer.sanitizeHtml(html);
        expect(sanitizedHtml).toEqual(expectedResult)
    });
    it("should remove malicious code in creatively escaped strings (MT-5542)", () => {
        const html = "<p>\u003Cimg/src='#'/onerror=console.log(111)\u003E<span>Content</span></p>";
        const expectedResult = "<p><img src=\"#\"><span>Content</span></p>";
        const sanitizedHtml = sanitizer.sanitizeHtml(html);
        expect(sanitizedHtml).toEqual(expectedResult)
    });
});