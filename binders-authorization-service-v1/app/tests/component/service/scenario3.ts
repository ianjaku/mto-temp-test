import {
    AssigneeType,
    PermissionName,
    ResourceType
} from "@binders/client/lib/clients/authorizationservice/v1/contract";
import { EntityMapperFactory, InMemoryEntityMapper } from "../../../src/authorization/entitymapper";
import { constants, setup } from "./setup";

class FakeEntityMapper extends InMemoryEntityMapper {
    constructor() {
        super();
        this.addUser(constants.USER_1, constants.ACCOUNT_1, constants.GROUP_1);
        this.addUser(constants.USER_2, constants.ACCOUNT_1);
        this.addUser(constants.USER_3, constants.ACCOUNT_2);
        this.addDocument(constants.DOCUMENT_1, constants.COLLECTION_1);
        this.addDocument(constants.DOCUMENT_2, constants.COLLECTION_2);
    }
}

const mapperFactory: EntityMapperFactory = {
    forRequest: () => Promise.resolve(new FakeEntityMapper())
};

describe("authorization service scenario 3", () => {
    test("fetch resource permissions 1 document", () => {
        return setup(mapperFactory).then(testSetup => {
            const service = testSetup.service;
            return service
                .createAcl(
                    "doc1-read",
                    "doc1-read",
                    constants.ACCOUNT_1,
                    [{ type: AssigneeType.USER, ids: [constants.USER_2, constants.USER_1] }],
                    [
                        {
                            resource: {
                                type: ResourceType.DOCUMENT,
                                ids: [constants.DOCUMENT_1]
                            },
                            permissions: [{ name: PermissionName.VIEW }]
                        }
                    ],
                    "rol-123"
                )
                .then(() =>
                    service.createAcl(
                        "doc1-admin",
                        "doc1-admin",
                        constants.ACCOUNT_1,
                        [{ type: AssigneeType.USER, ids: [constants.USER_1] }],
                        [
                            {
                                resource: {
                                    type: ResourceType.DOCUMENT,
                                    ids: [constants.DOCUMENT_1]
                                },
                                permissions: [{ name: PermissionName.ADMIN }]
                            }
                        ],
                        "rol-123"
                    )
                )
                .then(() =>
                    service.resourceAcls({ type: ResourceType.DOCUMENT, ids: [constants.DOCUMENT_1] }, constants.ACCOUNT_1, constants.USER_1)
                )
                .then(acls => {
                    return expect(acls.length).toEqual(2);
                })
                .then(() =>
                    service.resourceAcls({ type: ResourceType.DOCUMENT, ids: [constants.DOCUMENT_1] }, constants.ACCOUNT_1, constants.USER_2)
                )
                .then(
                    () => expect("should").toEqual("not happen"),
                    error => expect(error.message).toContain("Not enough permissions")
                )
                .then(() => testSetup.cleanup())
                .catch(error => {
                    testSetup.cleanup();
                    throw error;
                });
        });
    });

    test("fetch resource permissions document in collection", () => {
        return setup(mapperFactory).then(testSetup => {
            const service = testSetup.service;
            return service
                .createAcl(
                    "doc1-read",
                    "doc1-read",
                    constants.ACCOUNT_1,
                    [{ type: AssigneeType.USER, ids: [constants.USER_2, constants.USER_1] }],
                    [
                        {
                            resource: {
                                type: ResourceType.DOCUMENT,
                                ids: [constants.DOCUMENT_1]
                            },
                            permissions: [{ name: PermissionName.VIEW }]
                        }
                    ],
                    "rol-123"
                )
                .then(() =>
                    service.createAcl(
                        "col1-admin",
                        "doc1-admin",
                        constants.ACCOUNT_1,
                        [{ type: AssigneeType.USERGROUP, ids: [constants.GROUP_1] }],
                        [
                            {
                                resource: {
                                    type: ResourceType.DOCUMENT,
                                    ids: [constants.COLLECTION_1]
                                },
                                permissions: [{ name: PermissionName.ADMIN }]
                            }
                        ],
                        "rol-123"
                    )
                )
                .then(() =>
                    service.resourceAcls({ type: ResourceType.DOCUMENT, ids: [constants.DOCUMENT_1] }, constants.ACCOUNT_1, constants.USER_1)
                )
                .then(acls => {
                    return expect(acls.length).toEqual(2);
                })
                .then(() =>
                    service.resourceAcls({ type: ResourceType.DOCUMENT, ids: [constants.DOCUMENT_1] }, constants.ACCOUNT_1, constants.USER_2)
                )
                .then(
                    () => expect("should").toEqual("not happen"),
                    error => expect(error.message).toContain("Not enough permissions")
                )
                .then(() => testSetup.cleanup())
                .catch(error => {
                    testSetup.cleanup();
                    throw error;
                });
        });
    });
});
