import { Application } from "@microsoft/microsoft-graph-types"
import { BindersSecrets } from "../src/lib/bindersconfig"
import { mergeDeepRight } from "ramda"

// MT-3388 pain to be used with unbound type, needs more investigation 
export function createMockFactory<T extends Application | BindersSecrets>(data: T) {
    return (arg: Partial<T>): T => {
        return <T>mergeDeepRight(data, arg)
    }
}
