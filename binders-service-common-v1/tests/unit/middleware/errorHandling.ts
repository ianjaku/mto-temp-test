import * as bodyParser from "body-parser";
import * as express from "express";
import { Agent } from "http";
import { defaultErrorHandler } from "../../../src/middleware/errorHandler";
import fetch from "node-fetch";

const agent = new Agent({
    keepAlive: false,
})

// console.error ends up being called with req, and it's just noisy in the tests
const error = jest.spyOn(console, "error").mockImplementation(jest.fn());

const PORT = 3000;
const server = startUpServer();

describe("Error Handling", () => {
    afterAll(() => {
        server.close();
        error.mockRestore();
    });

    it("should return 404 for POST / when the response is sent before an unexpected error is throw", async () => {
        const response = await sendJsonPostRequest("{}", { sendBodyBeforeFail: "yes" });
        expect(response.status).toEqual(404);
        const json = await response.json();
        expect(json).toEqual({ "error": "Not found" });
    });

    it("should return 500 for POST / on unexpected error", async () => {
        const response = await sendJsonPostRequest("{}");
        expect(response.status).toEqual(500);
        const json = await response.json();
        expect(json).toEqual({ "error": "An unknown error occurred" });
    });

    it("should return 400 for POST / when the JSON payload is invalid", async () => {
        const response = await sendJsonPostRequest("{ invalidJSON");
        expect(response.status).toEqual(400);
        const json = await response.json();
        expect(json).toEqual({"error": "Invalid payload."});
    });

    it("should return 413 for POST / when the JSON payload too large", async () => {
        const response = await sendCustomJsonPostRequest(
            JSON.stringify({ prop: "a too long string that make the payload too big" })
        );
        expect(response.status).toEqual(413);
        const json = await response.json();
        expect(json).toEqual({"error": "Payload too large."});
    });
});

function startUpServer() {
    const app = express();
    app.use(bodyParser.json({ limit: 100,type: "application/json" }));
    app.use(bodyParser.json({ limit: 10, type: "application/custom-json" }));
    app.post("/", (req, res, _next) => {
        if (req.query?.sendBodyBeforeFail) {
            res.status(404);
            res.json({"error": "Not found"});
        }
        throw new Error("some unexpected error");
    });
    app.use(defaultErrorHandler);

    return app.listen(PORT, () => {
        // eslint-disable-next-line no-console
        console.log(`Server is running on http://localhost:${PORT}`);
    });
}

const sendJsonPostRequest = (body: string, queryParams: Record<string, string> = {}, contentType = "application/json") =>
    fetch(`http://localhost:${PORT}/?${new URLSearchParams(queryParams).toString()}`, {
        agent,
        method: "POST",
        headers: {
            "Content-Type": contentType,
        },
        body,
    });

const sendCustomJsonPostRequest = (body: string) =>
    sendJsonPostRequest(body, {}, "application/custom-json");
