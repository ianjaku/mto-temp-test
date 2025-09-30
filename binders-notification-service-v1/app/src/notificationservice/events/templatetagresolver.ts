import {
    BackendRoutingServiceClient,
    BackendUserServiceClient
} from  "@binders/binders-service-common/lib/apiclient/backendclient";
import {
    Binder,
    DocumentCollection
} from  "@binders/client/lib/clients/repositoryservice/v3/contract";
import {
    extractTitle,
    getBinderMasterLanguage
} from  "@binders/client/lib/clients/repositoryservice/v3/helpers";
import { getEditorLocation, getReaderLocation } from "@binders/client/lib/util/domains";
import { Config } from "@binders/client/lib/config/config";
import type { ISemanticLink } from "@binders/client/lib/clients/routingservice/v1/contract";
import { RoutingServiceClient } from "@binders/client/lib/clients/routingservice/v1/client";
import { User } from "@binders/client/lib/clients/userservice/v1/contract";
import { UserServiceClient } from "@binders/client/lib/clients/userservice/v1/client";
import { buildLink } from "@binders/client/lib/binders/readerPath";
import { buildUserName } from "@binders/client/lib/clients/userservice/v1/helpers";
import { isDocumentCollection } from "@binders/client/lib/clients/repositoryservice/v3/validation";

const SUPPORTED_TEMPLATE_VARIABLES = ["actor", "editor_link", "reader_link", "title", "name"];

export class TemplateTagResolver {

    private tagValueCache: Map<string, unknown> = new Map();

    private constructor(
        private readonly item: Binder | DocumentCollection,
        private readonly routingService: RoutingServiceClient,
        private readonly userServiceClient: UserServiceClient,
        private readonly manualToLocation: string,
        private readonly devEditorLocation: string,
        private readonly actorId?: string,
    ) {}

    /**
     * Returns a list of all supported template variables that are used in the given text.
     */
    async findTagsInText(text = ""): Promise<string[]> {
        const variables = new Set<string>();
        for (const variable of SUPPORTED_TEMPLATE_VARIABLES) {
            if (text.includes(`[[${variable}]]`)) {
                variables.add(variable);
            }
        }
        return Array.from(variables);
    }

    async parseTags(tags: string[], to: User): Promise<Record<string, string>> {
        const resolvers: Record<string, () => string | Promise<string>> = {
            title: () => this.getItemTitle(),
            actor: async () => this.cached("actor", () => this.getActorUserName()),
            name: () => this.getUserName(to),
            editor_link: async () => this.cached("editor_link", () => this.createEditorLink()),
            reader_link: async () => this.cached("reader_link", () => this.createReaderLink()),
        };

        const result: Record<string, string> = {};
        for (const tag of tags) {
            const resolve = resolvers[tag];
            if (resolve == null) throw new Error(`Unsupported template tag ${tag}`);
            result[tag] = await resolve();
        }
        return result;
    }

    private async createEditorLink(): Promise<string> {
        const domain = await this.getReaderDomain();
        const editorLocation = getEditorLocation(domain, this.devEditorLocation);
        let link: string;
        if (isDocumentCollection(this.item)) {
            link = `${editorLocation}/browse/${this.item.id}`;
        } else {
            link = `${editorLocation}/documents/${this.item.id}`;
        }
        if(editorLocation === this.devEditorLocation) {
            link += `?domain=${domain.replace(".manual.to", ".editor.manual.to")}`;
        }
        return link;
    }

    private async getReaderDomain(): Promise<string> {
        const filters = await this.routingService.getDomainFiltersForAccounts([this.item.accountId]);
        if (filters.length === 0) {
            throw new Error(
                "No domain filters found for account with id " + this.item.accountId
            );
        }
        const domainFilter = filters[0];
        return domainFilter.domain;
    }

    private async createReaderLink(): Promise<string> {
        const domain = await this.getReaderDomain();
        const readerLocation = getReaderLocation(domain, this.manualToLocation);

        let lang: string;
        let semanticLinks: ISemanticLink[] = [];
        if (isDocumentCollection(this.item)) {
            lang = this.item.titles[0].languageCode 
        } else {
            lang = getBinderMasterLanguage(this.item).iso639_1;
            semanticLinks = await this.routingService.findSemanticLinks(this.item.id)
        }

        return buildLink({
            domain,
            isCollection: isDocumentCollection(this.item),
            lang,
            itemId: this.item.id,
            semanticLinks,
            readerLocation,
            fullPath: false,
            isPublication: false
        });
    }

    private getItemTitle(): string {
        return extractTitle(this.item);
    }

    private async getActorUserName(): Promise<string | null> {
        const actor = await this.userServiceClient.getUser(this.actorId);
        return this.getUserName(actor);
    }

    private getUserName(user: User): string {
        return buildUserName(user);
    }

    private async cached<T>(key: string, func: () => Promise<T>): Promise<T> {
        if (this.tagValueCache.has(key)) {
            return this.tagValueCache.get(key) as T;
        }
        const result = await func();
        this.tagValueCache.set(key, result);
        return result;
    }

    static async fromConfig(
        config: Config,
        item: Binder | DocumentCollection,
        actorId?: string
    ): Promise<TemplateTagResolver> {
        const routingService = await BackendRoutingServiceClient.fromConfig(config, "notification-service");
        const userServiceClient = await BackendUserServiceClient.fromConfig(config, "notification-service");
        const manualToLocation = config.getString("services.manualto.externalLocation").get();
        const devEditorLocation = config.getString("services.editor.externalLocation").get();
        return new TemplateTagResolver(
            item,
            routingService,
            userServiceClient,
            manualToLocation,
            devEditorLocation,
            actorId,
        );
    }
}
