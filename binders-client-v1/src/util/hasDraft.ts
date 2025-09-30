import {
    BindersModuleMeta,
    Publication,
    PublicationsSummaryItem
} from "../clients/repositoryservice/v3/contract";
import { isBefore } from "date-fns";

const hasDraft = (
    meta: BindersModuleMeta[],
    languageCode: string,
    publications: Publication[],
): boolean => {
    const languageMetaModule = meta.find(
        meta => meta.iso639_1 === languageCode
    );
    if (languageMetaModule === undefined || languageMetaModule.lastModifiedDate === undefined) {
        return false;
    }
    const publication = publications.find(
        pub => pub.isActive && pub.language.iso639_1 === languageCode
    );

    if (publication === undefined) {
        return true;
    }
    return isBefore(
        new Date(publication.publicationDate),
        new Date(languageMetaModule.lastModifiedDate),
    );
}

export const hasDraftInSummaries = (
    binderId: string,
    languageMetaModule: BindersModuleMeta,
    languageCode: string,
    publicationSummaries: PublicationsSummaryItem[],
): boolean => {
    if (languageMetaModule === undefined || languageMetaModule.lastModifiedDate === undefined) {
        return false;
    }
    const publicationSummary = publicationSummaries.find(
        sum => sum.Language === languageCode && sum.DocumentId === binderId,
    );
    if (publicationSummary === undefined) {
        return true;
    }
    return isBefore(
        new Date(publicationSummary.PublicationDate),
        new Date(languageMetaModule.lastModifiedDate),
    );
}

export default hasDraft;