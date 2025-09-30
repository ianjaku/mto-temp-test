import { mockBinderSecretsFactory } from "../../testdata/mockBinderSecrets";
import { replacePasswordInBindersSecrets } from "../../../src/lib/bindersconfig";


describe("replacePasswordInBindersSecrets", () => {
    it("should return same object for empty path", async () => {
        const mockSecrets = mockBinderSecretsFactory({})
        const secret = "someSecret"
        const pathInBindersSecrets = []
        const replacedSecrets = replacePasswordInBindersSecrets(mockSecrets, secret, pathInBindersSecrets)
        expect(replacedSecrets).toEqual(mockSecrets)
    })

    it("should return same object for empty secret", async () => {
        const mockSecrets = mockBinderSecretsFactory({})
        const secret = ""
        const pathInBindersSecrets = []
        const replacedSecrets = replacePasswordInBindersSecrets(mockSecrets, secret, pathInBindersSecrets)
        expect(replacedSecrets).toEqual(mockSecrets)
    })

    it("should return replaced desired secret", async () => {
        const mockSecrets = mockBinderSecretsFactory({})
        const secret = "replaced"
        const pathInBindersSecrets = ["pipedrive", "apiKey"]
        expect(mockSecrets.pipedrive.apiKey).toEqual("somekey")
        const replacedSecrets = replacePasswordInBindersSecrets(mockSecrets, secret, pathInBindersSecrets)
        expect(replacedSecrets.pipedrive.apiKey).toBe(secret)
    })

})