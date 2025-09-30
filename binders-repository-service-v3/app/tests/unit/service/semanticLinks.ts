import { MockProxy, any, mock } from "jest-mock-extended";
import { Binder } from "@binders/client/lib/clients/repositoryservice/v3/contract";
import {
    BinderRepositoryServiceClient
} from "@binders/client/lib/clients/repositoryservice/v3/client";
import { DocumentType } from "@binders/client/lib/clients/model";
import { ISemanticLink } from "@binders/client/lib/clients/routingservice/v1/contract";
import { RoutingService } from "../../../src/routingservice/service";
import { SemanticLinkIdentifier } from "../../../src/routingservice/model";
import { SemanticLinkRepository } from "../../../src/routingservice/repositories/semanticlink";

const DOMAIN = "domain.manual.to";
const SEMANTIC_ID = "some-link";
const BINDER_ID = "bin";
const OTHER_BINDER_ID = "other-bin";

describe("setSemanticLink", () => {
    let routingService: RoutingService;
    let semanticLinkRepository: MockProxy<SemanticLinkRepository>;
    let repositoryClient: MockProxy<BinderRepositoryServiceClient>;

    beforeEach(() => {
        semanticLinkRepository = mockWithFailure<SemanticLinkRepository>();
        repositoryClient = mockWithFailure<BinderRepositoryServiceClient>();
        routingService = new RoutingService(
            null,
            null,
            null,
            null,
            semanticLinkRepository,
            repositoryClient,
            null,
            null,
            null,
        );
    });

    it("throws when semantic link binder id and binder id are different", async () => {
        const wrongBinderId = "aaa";
        await expect(() => routingService.setSemanticLink(requestSemanticLink(), wrongBinderId))
            .rejects.toThrow(`Unexpected ${wrongBinderId} and ${BINDER_ID} values`);
    })

    it("creates new semantic link when no other exists", async () => {
        semanticLinkRepository.findSemanticLinks
            .calledWith(expect.objectContaining( { domain: DOMAIN, semanticId: SEMANTIC_ID }))
            .mockReturnValueOnce(Promise.resolve([]));
        semanticLinkRepository.createSemanticLink
            .calledWith(any())
            .mockReturnValueOnce(Promise.resolve({
                id: SemanticLinkIdentifier.generate(),
                binderId: BINDER_ID,
                languageCode: "xx",
                documentType: DocumentType.DOCUMENT,
                domain: DOMAIN,
                semanticId: SEMANTIC_ID
            }));

        const result = await routingService.setSemanticLink(requestSemanticLink(), BINDER_ID);
        expect(result.semanticLink).toEqual(expect.objectContaining({
            binderId: BINDER_ID,
            languageCode: "xx",
            documentType: DocumentType.DOCUMENT,
            domain: DOMAIN,
            semanticId: SEMANTIC_ID
        }));
    });

    it("allows setting a semantic link as deleted", async () => {
        const existingSemanticLink = {
            id: SemanticLinkIdentifier.generate(),
            binderId: BINDER_ID,
            languageCode: "xx",
            documentType: DocumentType.DOCUMENT,
            domain: DOMAIN,
            semanticId: SEMANTIC_ID,
            deleted: false
        };
        const expectedSemanticLink = { ...existingSemanticLink, deleted: true };

        semanticLinkRepository.findSemanticLinks
            .calledWith(expect.objectContaining( { domain: DOMAIN, semanticId: SEMANTIC_ID }))
            .mockReturnValueOnce(Promise.resolve([ existingSemanticLink ]));
        semanticLinkRepository.updateSemanticLink
            .calledWith(expect.objectContaining(expectedSemanticLink))
            .mockReturnValueOnce(Promise.resolve(expectedSemanticLink));

        const result = await routingService.setSemanticLink(requestSemanticLink(true), BINDER_ID);
        expect(result.semanticLink).toEqual(expect.objectContaining({
            ...expectedSemanticLink,
            id: expectedSemanticLink.id.value()
        }));
    });

    it("allows setting a semantic link as restored (un-deleted)", async () => {
        const existingSemanticLink = {
            id: SemanticLinkIdentifier.generate(),
            binderId: BINDER_ID,
            languageCode: "xx",
            documentType: DocumentType.DOCUMENT,
            domain: DOMAIN,
            semanticId: SEMANTIC_ID,
            deleted: true
        };
        const expectedSemanticLink = { ...existingSemanticLink, deleted: false };

        semanticLinkRepository.findSemanticLinks
            .calledWith(expect.objectContaining( { domain: DOMAIN, semanticId: SEMANTIC_ID }))
            .mockReturnValueOnce(Promise.resolve([ existingSemanticLink ]));
        semanticLinkRepository.updateSemanticLink
            .calledWith(expect.objectContaining(expectedSemanticLink))
            .mockReturnValueOnce(Promise.resolve(expectedSemanticLink));


        const result = await routingService.setSemanticLink(requestSemanticLink(false), BINDER_ID);
        expect(result.semanticLink).toEqual(expect.objectContaining({
            ...expectedSemanticLink,
            id: expectedSemanticLink.id.value()
        }));
    });

    it("allows updating a semantic link when overrideInTrash is true and existing semantic link binder is in trash", async () => {
        const existingSemanticLink = {
            id: SemanticLinkIdentifier.generate(),
            binderId: OTHER_BINDER_ID,
            languageCode: "ro",
            documentType: DocumentType.COLLECTION,
            domain: DOMAIN,
            semanticId: SEMANTIC_ID,
            deleted: false
        };
        const expectedSemanticLink = {
            ...existingSemanticLink,
            binderId: BINDER_ID,
            languageCode: "xx",
            documentType: DocumentType.DOCUMENT,
        };

        semanticLinkRepository.findSemanticLinks
            .calledWith(expect.objectContaining( { domain: DOMAIN, semanticId: SEMANTIC_ID }))
            .mockReturnValueOnce(Promise.resolve([ existingSemanticLink ]));
        semanticLinkRepository.updateSemanticLink
            .calledWith(expect.objectContaining(expectedSemanticLink))
            .mockReturnValueOnce(Promise.resolve(expectedSemanticLink));
        repositoryClient.findItems
            .calledWith(expect.objectContaining({ ids: [OTHER_BINDER_ID], softDelete: { show: "show-deleted" } }), expect.objectContaining({ maxResults: 1 }))
            .mockReturnValueOnce(Promise.resolve([{ deletionTime: "2020" } as unknown as Binder]))

        const result = await routingService.setSemanticLink(requestSemanticLink(false), BINDER_ID, true);
        expect(result.semanticLink).toEqual(expect.objectContaining({
            ...expectedSemanticLink,
            id: expectedSemanticLink.id.value()
        }));
    });

    it("denies updating a semantic link when existing one has a binder in trash but overrideInTrash is false", async () => {
        const existingSemanticLink = {
            id: SemanticLinkIdentifier.generate(),
            binderId: OTHER_BINDER_ID,
            languageCode: "ro",
            documentType: DocumentType.COLLECTION,
            domain: DOMAIN,
            semanticId: SEMANTIC_ID,
            deleted: false
        };

        semanticLinkRepository.findSemanticLinks
            .calledWith(expect.objectContaining( { domain: DOMAIN, semanticId: SEMANTIC_ID }))
            .mockReturnValueOnce(Promise.resolve([ existingSemanticLink ]));
        repositoryClient.findItems
            .calledWith(expect.objectContaining({ ids: [OTHER_BINDER_ID], softDelete: { show: "show-deleted" } }), expect.objectContaining({ maxResults: 1 }))
            .mockReturnValueOnce(Promise.resolve([{ deletionTime: "2020" } as unknown as Binder]))

        const result = await routingService.setSemanticLink(requestSemanticLink(false), BINDER_ID);
        expect(result).toEqual(expect.objectContaining({
            conflict: {
                conflicted: true,
                conflictedWithDeletedItem: true
            }
        }));
    });

    it("denies updating a semantic link when existing one does not have a binder in trash", async () => {
        const existingSemanticLink = {
            id: SemanticLinkIdentifier.generate(),
            binderId: OTHER_BINDER_ID,
            languageCode: "ro",
            documentType: DocumentType.COLLECTION,
            domain: DOMAIN,
            semanticId: SEMANTIC_ID,
            deleted: false
        };

        semanticLinkRepository.findSemanticLinks
            .calledWith(expect.objectContaining( { domain: DOMAIN, semanticId: SEMANTIC_ID }))
            .mockReturnValueOnce(Promise.resolve([ existingSemanticLink ]));
        repositoryClient.findItems
            .calledWith(expect.objectContaining({ ids: [OTHER_BINDER_ID], softDelete: { show: "show-deleted" } }), expect.objectContaining({ maxResults: 1 }))
            .mockReturnValueOnce(Promise.resolve([{ deletionTime: undefined } as unknown as Binder]))

        const result = await routingService.setSemanticLink(requestSemanticLink(true), BINDER_ID);
        expect(result).toEqual(expect.objectContaining({
            conflict: {
                conflicted: true,
                conflictedWithDeletedItem: false
            }
        }));
    });
});

const requestSemanticLink = (deleted?: boolean): ISemanticLink => ({
    id: null,
    binderId: BINDER_ID,
    languageCode: "xx",
    documentType: DocumentType.DOCUMENT,
    semanticId: SEMANTIC_ID,
    domain: DOMAIN,
    deleted
});

const mockWithFailure = <T>() => mock<T>({} as never, { fallbackMockImplementation: () => {
    throw new Error("not mocked");
}});