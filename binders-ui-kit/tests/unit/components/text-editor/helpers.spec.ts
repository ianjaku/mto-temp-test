import { normalizeHyperlink } from "../../../../src/elements/text-editor/helpers";

describe("normalizeHyperlink", () => {

    it("handles broken protocol", () => {
        expect(normalizeHyperlink({
            url: "http:/foo.bar", isCallToLink: false, target: "", text: "",
        })).toEqual({
            url: "http://foo.bar", isCallToLink: false, target: "", text: "",
        });
        expect(normalizeHyperlink({
            url: "https:/foo.bar", isCallToLink: false, target: "", text: "",
        })).toEqual({
            url: "https://foo.bar", isCallToLink: false, target: "", text: "",
        });
        expect(normalizeHyperlink({
            url: "https:///foo.bar", isCallToLink: false, target: "", text: "",
        })).toEqual({
            url: "https://foo.bar", isCallToLink: false, target: "", text: "",
        });
    });

    it("adds https:// to URLs without protocol", () => {
        expect(normalizeHyperlink({
            url: "foo.bar", isCallToLink: false, target: "", text: "",
        })).toEqual({
            url: "https://foo.bar", isCallToLink: false, target: "", text: "",
        });
        expect(normalizeHyperlink({
            url: "www.foo.bar", isCallToLink: false, target: "", text: "",
        })).toEqual({
            url: "https://www.foo.bar", isCallToLink: false, target: "", text: "",
        });
    });

    it("does not modify URLs that already have a correct protocol", () => {
        expect(normalizeHyperlink({
            url: "http://foo.bar", isCallToLink: false, target: "", text: "",
        })).toEqual({
            url: "http://foo.bar", isCallToLink: false, target: "", text: "",
        });
        expect(normalizeHyperlink({
            url: "https://foo.bar", isCallToLink: false, target: "", text: "",
        })).toEqual({
            url: "https://foo.bar", isCallToLink: false, target: "", text: "",
        });
        expect(normalizeHyperlink({
            url: "mailto:someone@example.com", isCallToLink: false, target: "", text: "",
        })).toEqual({
            url: "mailto:someone@example.com", isCallToLink: false, target: "", text: "",
        });
    });

    it("correctly handles isCallToLink", () => {
        expect(normalizeHyperlink({
            url: "+1 (800) 555-5555", isCallToLink: true, target: "", text: "",
        })).toEqual({
            url: "+18005555555", isCallToLink: true, target: "", text: "",
        });
    });

    it("trims the input and handles empty URLs", () => {
        expect(normalizeHyperlink({
            url: "  https:/foo.bar  ", isCallToLink: false, target: "", text: "",
        })).toEqual({
            url: "https://foo.bar", isCallToLink: false, target: "", text: "",
        });
        expect(normalizeHyperlink({
            url: "   ", isCallToLink: false, target: "", text: "",
        })).toEqual({
            url: "", isCallToLink: false, target: "", text: "",
        });
    });

    it("does not modify URLs with 'http:/' in the middle", () => {
        expect(normalizeHyperlink({
            url: "https://foo.bar/http:/path", isCallToLink: false, target: "", text: "",
        })).toEqual({
            url: "https://foo.bar/http:/path", isCallToLink: false, target: "", text: "",
        });
    });

});
