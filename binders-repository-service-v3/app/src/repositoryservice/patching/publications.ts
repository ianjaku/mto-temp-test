import * as Immutable from "immutable";
import { Publication } from "@binders/client/lib/clients/repositoryservice/v3/contract";
import { update } from "tcomb";

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export const setMasterLanguage = (publication: Publication, isMaster: boolean) => {
    return Immutable.fromJS(publication).set("isMaster", isMaster).toJS();
};

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export const setPriorityForPublication = (publication: Publication, priority: number) => {
    return Immutable.fromJS(publication).setIn(["language", "priority"], priority).toJS();
}

export function relabelPublicationLanguage(
    publication: Publication,
    toLanguageCode: string
): Publication {
    const indexOfTextModule = publication.modules.meta.findIndex(m => m.type === "text");
    const patch = {
        language: {
            $merge: {
                iso639_1: toLanguageCode,
            }
        },
        modules: { meta: {} },
    };
    patch.modules.meta[indexOfTextModule] = {
        $merge: {
            iso639_1: toLanguageCode,
        }
    };
    return <Publication>update(publication, patch);
}
