import { DEFAULT_DAYS_TO_EXPIRE, willPasswordCredentialExpire } from "../../../src/lib/graph/util";
import { mockApplicationFactory } from "../../testdata/mockApplication";
import moment from "moment";


describe("willPasswordCredentialExpireSoon", () => {
    it("should return true when password endDateTime below default treshold", async () => {
        const endDateTime = moment().add(1, "days").format()
        const mock = mockApplicationFactory({
            passwordCredentials: [
                {
                    endDateTime
                }
            ]
        })
        const expired = willPasswordCredentialExpire(mock)
        expect(expired).toBe(true)
    })

    it("should return false when password endDateTime above default treshold", async () => {
        const endDateTime = moment().add(DEFAULT_DAYS_TO_EXPIRE + 1, "days").format()
        const mock = mockApplicationFactory({
            passwordCredentials: [
                {
                    endDateTime
                }
            ]
        })
        const expired = willPasswordCredentialExpire(mock)
        expect(expired).toBe(false)
    })

    it("should return true when password endDateTime below custom treshold", async () => {
        const threshold = 2
        const endDateTime = moment().add(1, "days").format()
        const mock = mockApplicationFactory({
            passwordCredentials: [
                {
                    endDateTime
                }
            ]
        })
        const expired = willPasswordCredentialExpire(mock, threshold)
        expect(expired).toBe(true)
    })

    it("should return false when password endDateTime above custom treshold", async () => {
        const threshold = 5
        const endDateTime = moment().add(10, "days").format()
        const mock = mockApplicationFactory({
            passwordCredentials: [
                {
                    endDateTime
                }
            ]
        })
        const expired = willPasswordCredentialExpire(mock, threshold)
        expect(expired).toBe(false)
    })
})