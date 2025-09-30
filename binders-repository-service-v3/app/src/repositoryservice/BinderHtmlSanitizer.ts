import {
    BINDER_COUNTER_LABEL
} from "@binders/binders-service-common/lib/monitoring/prometheus/htmlSanitizing";
import { Binder } from "@binders/client/lib/clients/repositoryservice/v3/contract";
import HtmlSanitizer from "@binders/binders-service-common/lib/html/sanitizer";
import { Logger } from "@binders/binders-service-common/lib/util/logging";



export default class BinderHtmlSanitizer extends HtmlSanitizer {
    constructor(protected logger: Logger) {
        super(logger, BINDER_COUNTER_LABEL)
        this.sanitize = this.sanitize.bind(this);
    }

    public sanitize(binder: Binder): Binder {
        binder.languages = binder.languages.map(language => ({
            ...language,
            storyTitle: this.sanitizeHtml(language.storyTitle),
            storyTitleRaw: this.sanitizeHtml(language.storyTitleRaw),
        }));
        binder.modules.text.chunked = binder.modules.text.chunked.map(chunkedEntry => ({
            ...chunkedEntry,
            chunks: chunkedEntry.chunks.map(chunkArr => chunkArr.map((chunkHtml: string) => this.sanitizeHtml(chunkHtml)))
        }));
        return binder;
    }

}


