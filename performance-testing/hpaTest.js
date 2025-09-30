import { check, sleep } from "k6";
import http from "k6/http";

export const options = {
    vus: 10,
    duration: "2m",
};

const url = "https://api-rel-october-24.staging.binders.media/binders/v3/readerItems/findWithInfo?accountId=aid-0fb03b72-d6ed-4204-abbd-f64b8879b4a6"


export default function () {
    const params = {
        headers: {
            //'Authorization': `Bearer ${AUTH_TOKEN}`,
            "Content-Type": "application/json",
        },
    };
    const payload = {
        options: {
            binderSearchResultOptions: {
                maxResults: 2000
            },
            cdnnify: true,
            skipCache: false
        },
        filter: {
            summary: true,
            preferredLanguages: [],
            domain: "demo.manual.to"
        }
    }
    const res = http.post(url, JSON.stringify(payload), params)

    check(res, {
        "status is 200": (r) => r.status === 200,
    });

    sleep(1);
}