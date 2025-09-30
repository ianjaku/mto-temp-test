import { ILogEntry, parseLine } from "../../../src/actions/nginx/parser";
import { HTTPVerb } from "@binders/client/lib/clients/routes"

// eslint-disable-next-line quotes
const TEST_LINE_1 = `147.161.172.169 - [147.161.172.169] - - [21/Feb/2022:12:57:47 +0000] "POST /binders/v3/fromclient/items HTTP/1.1" 200 3681 "https://editor.manual.to/" "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/98.0.4758.80 Safari/537.36" 1640 0.175 [production-binders-v3-service-8011] 10.0.22.175:8011 3681 0.176 200 f193d298265623ba3b0b76885242ecf2`
// eslint-disable-next-line quotes
const TEST_LINE_2 = `195.62.68.232 - [195.62.68.232] - - [21/Feb/2022:12:54:04 +0000] "POST /tracking/v1/statistics/views/all HTTP/2.0" 500 37 "https://editor.manual.to/" "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/97.0.4692.71 Safari/537.36 Edg/97.0.1072.55" 345 0.197 [production-tracking-v1-service-8012] 10.0.28.69:8012 37 0.196 500 db1f46d8f538160382af202af22c4a47`
// eslint-disable-next-line quotes
const TEST_LINE_3 = `18.195.116.120 - [18.195.116.120] - waldek [21/Feb/2022:12:54:25 +0000] "GET /-/ready HTTP/1.1" 200 21 "-" "axios/0.21.1" 200 0.003 [monitoring-binders-monitoring-prometheus-server-80] 10.244.2.7:9090 21 0.004 200 6edbf9d24770604d8c5a5bbd8b361f42`;


it("parse line 1 correctly", async () =>{
    const parsedLine: ILogEntry = parseLine(TEST_LINE_1);
    const { clientIp, path, verb, statusCode, date, requestDurationInMs,
        upstreamName, upstreamAddress } = parsedLine;
    expect(clientIp).toEqual("147.161.172.169");
    expect(path).toEqual("/binders/v3/fromclient/items");
    expect(verb).toEqual(HTTPVerb.POST);
    expect(statusCode).toEqual(200);
    expect(date.toISOString()).toEqual("2022-02-21T12:57:47.000Z");
    expect(requestDurationInMs).toEqual(175);
    expect(upstreamName).toEqual("production-binders-v3-service-8011");
    expect(upstreamAddress).toEqual("10.0.22.175:8011");
});

it("parse line 2 correctly", async () =>{
    const parsedLine: ILogEntry = parseLine(TEST_LINE_2);
    const { clientIp, path, verb, statusCode, date, requestDurationInMs,
        upstreamName, upstreamAddress } = parsedLine;
    expect(clientIp).toEqual("195.62.68.232");
    expect(path).toEqual("/tracking/v1/statistics/views/all");
    expect(verb).toEqual(HTTPVerb.POST);
    expect(statusCode).toEqual(500);
    expect(date.toISOString()).toEqual("2022-02-21T12:54:04.000Z");
    expect(requestDurationInMs).toEqual(197);
    expect(upstreamName).toEqual("production-tracking-v1-service-8012");
    expect(upstreamAddress).toEqual("10.0.28.69:8012");
});

it("parse line 3 correctly", async () => {
    const parsedLine: ILogEntry = parseLine(TEST_LINE_3);
    const { clientIp, path, verb, statusCode, date, requestDurationInMs,
        upstreamName, upstreamAddress } = parsedLine;
    expect(clientIp).toEqual("18.195.116.120");
    expect(path).toEqual("/-/ready");
    expect(verb).toEqual(HTTPVerb.GET);
    expect(statusCode).toEqual(200);
    expect(date.toISOString()).toEqual("2022-02-21T12:54:25.000Z");
    expect(requestDurationInMs).toEqual(3);
    expect(upstreamName).toEqual("monitoring-binders-monitoring-prometheus-server-80");
    expect(upstreamAddress).toEqual("10.244.2.7:9090");

})