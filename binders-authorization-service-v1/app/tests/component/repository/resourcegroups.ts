import { AccountIdentifier, AclIdentifier } from "@binders/binders-service-common/lib/authentication/identity";
import {
    AssigneeGroup,
    AssigneeType,
    PermissionName,
    ResourceGroup,
    ResourceType
} from "@binders/client/lib/clients/authorizationservice/v1/contract";
import { Acl } from "../../../src/authorization/models/acl";
import { setup } from "./setup";

// User 1 has read on doc 1
// User 3 has no read acls
// doc2 is part of account 1
// doc3 is public


const ACCOUNT_ID = AccountIdentifier.generate();
const ACL1_ID = AclIdentifier.generate();
const ACL3_ID = AclIdentifier.generate();
const ACL4_ID = AclIdentifier.generate();
const DOC_1 = "doc-1";
const DOC_2 = "doc-2";
const DOC_3 = "doc-3";
const USER_1 = "uid-1";
const USER_1_ASSIGNEES = getAssignees(USER_1);
const USER_3 = "uid-3";
const USER_3_ASSIGNEES = getAssignees(USER_3);

const DOCUMENT_RESOURCE_TYPES: ResourceType[] = [ResourceType.DOCUMENT];


function getAssignees(userId: string): AssigneeGroup[] {
    return [
        { type: AssigneeType.USER, ids: [userId] },
        { type: AssigneeType.ACCOUNT, ids: [ACCOUNT_ID.value()] },
        { type: AssigneeType.PUBLIC, ids: [] }
    ];
}

const acl1: Acl = new Acl(
    ACL1_ID,
    "user-1-read-doc-1",
    "",
    ACCOUNT_ID,
    [{ type: AssigneeType.USER, ids: [USER_1] }],
    [
        {
            resource: {
                type: ResourceType.DOCUMENT,
                ids: [DOC_1]
            },
            permissions: [{name: PermissionName.VIEW}]
        }
    ],
    "rol-123"
);

const acl3: Acl = new Acl(ACL3_ID, "public-read-doc-3", "", ACCOUNT_ID,
    [{type: AssigneeType.PUBLIC, ids: []}],
    [
        {
            resource: {
                type: ResourceType.DOCUMENT,
                ids: [DOC_3]
            },
            permissions: [{name: PermissionName.VIEW}]
        }
    ],
    "rol-123"
);
const acl4: Acl = new Acl(ACL4_ID, "user3-edit-doc-2", "", ACCOUNT_ID,
    [{type: AssigneeType.USER, ids: [USER_3]}],
    [
        {
            resource: {
                type: ResourceType.DOCUMENT,
                ids: [DOC_2]
            },
            permissions: [{ name: PermissionName.EDIT }]
        }
    ],
    "rol-123"
);

describe("Repo find resourcegroups", () => {
    test("it should fetch the right resourcegroups", () => {
        return setup()
            .then( env => {
                const repo = env.repo;
                return Promise.all([
                    repo.createAcl(acl1),
                    repo.createAcl(acl3),
                    repo.createAcl(acl4)
                ])
                    .then( () => repo.findResourceGroups(USER_1_ASSIGNEES, DOCUMENT_RESOURCE_TYPES, PermissionName.VIEW))
                    .then(resourceGroups => {
                        expect(resourceGroups).toHaveLength(1);
                        const resourceGroup = resourceGroups[0];
                        expect(resourceGroup.type).toEqual(ResourceType.DOCUMENT);
                        expect(resourceGroup.ids).toHaveLength(2);
                        expect(resourceGroup.ids).toContain(DOC_1);
                        expect(resourceGroup.ids).toContain(DOC_3);
                    })
                    .then( () => repo.findResourceGroups(USER_3_ASSIGNEES, DOCUMENT_RESOURCE_TYPES, PermissionName.VIEW))
                    .then(resourceGroups => {
                        expect(resourceGroups).toHaveLength(1);
                        const documentResourceGroup = <ResourceGroup> resourceGroups.find(rg => rg.type === ResourceType.DOCUMENT);
                        expect(documentResourceGroup).toBeDefined();
                        expect(documentResourceGroup.ids).toHaveLength(1);
                        expect(documentResourceGroup.ids).toContain(DOC_3);
                    })
                    .then( () => env.cleanup() )
                    .catch(error => {
                        return env.cleanup().then( () => { throw error; } );
                    });
            });

    });
});
