import BinderClass from "@binders/client/lib/binders/custom/class";
import { Config } from "@binders/client/lib/config/config";
import { ContentServiceContract } from "@binders/client/lib/clients/contentservice/v1/contract";
import { ContentServiceFactory } from "../../../src/contentservice/service";
import { IFeatureFlagService } from "@binders/binders-service-common/lib/launchdarkly/server";
import { ILlmFileRepository } from "../../../src/contentservice/internal/llm-file-repository";
import type { ILlmService } from "../../../src/contentservice/internal/llm";
import { TestAccountFixtures } from "@binders/binders-service-common/lib/testutils/fixtures/testaccountfixtures";
import { TestFixtures } from "@binders/binders-service-common/lib/testutils/fixtures/testfixtures";
import { mock } from "jest-mock-extended";

export async function withBinder(
    fx: TestFixtures,
    cb: (values: { accountId: string, collectionId: string, binder: BinderClass, fixtures: TestAccountFixtures }) => Promise<void>,
    values: { collectionTitle?: string, languageCode: string, title: string, chunkTexts: string[] },
): Promise<void> {
    return fx.withFreshAccount(async fixtures => {
        const col = await fixtures.items.createCollection(
            { title: values?.collectionTitle ?? "Generated" },
            { addToRoot: true },
        );
        const accountId = fixtures.getAccountId();
        const collectionId = col.id
        if (!col.id) throw new Error("Did not create collection");
        const binder = await fixtures.items.createDocument(values, { addToCollId: collectionId });
        if (!binder?.id) throw new Error("Did not create a Binder");
        await cb({ accountId, collectionId, binder: new BinderClass(binder), fixtures });
    });
}

export async function buildContentService(
    config: Config,
    llm: ILlmService,
    llmFileRepo: ILlmFileRepository = mock(),
    featureFlagService: IFeatureFlagService = mock(),
): Promise<ContentServiceContract> {
    const factory = await ContentServiceFactory.fromDependencies({ llm,  llmFileRepo, featureFlagService }, config);
    return factory.build();
}
