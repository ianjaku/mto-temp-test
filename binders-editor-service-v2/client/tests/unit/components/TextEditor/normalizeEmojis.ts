import { Binder } from "@binders/client/lib/clients/repositoryservice/v3/contract";
import { normalizeEmojis } from "../../../../src/documents/actions/normalizing";

describe("normalizeEmojis", () => {
    it("should normalize twemoji img tags in both chunks and json props", () => {
        const inputBinder = {
            id: "1",
            modules: {
                text: {
                    chunked: [
                        {
                            key: "t1",
                            chunks: [
                                [
                                    "<p>a paragraph</p>",
                                    "<img src=\"/assets/svg/1f534.svg\" alt=\"🔴\" class=\"twemoji\"/>"
                                ]
                            ],
                            json: [
                                "{\"type\":\"doc\",\"content\":[{\"type\":\"paragraph\",\"content\":[{\"type\":\"text\",\"text\":\"a paragraph\"}]},{\"type\":\"image\",\"attrs\":{\"src\":\"/assets/svg/1f7e1.svg\",\"alt\":\"🟡\",\"title\":null,\"class\":\"twemoji\"}}]}"
                            ]
                        }
                    ]
                }
            }
        };
        const expectedBinder = {
            id: "1",
            modules: {
                text: {
                    chunked: [
                        {
                            key: "t1",
                            chunks: [
                                [
                                    "<p>a paragraph</p>",
                                    "🔴"
                                ]
                            ],
                            json: [
                                "{\"type\":\"doc\",\"content\":[{\"type\":\"paragraph\",\"content\":[{\"type\":\"text\",\"text\":\"a paragraph\"}]},{\"type\":\"text\",\"text\":\"🟡\"}]}"
                            ]
                        }
                    ]
                }
            }
        };
        const normalized = normalizeEmojis(inputBinder as Binder);
        expect(normalized).toEqual(expectedBinder);
    });

});
