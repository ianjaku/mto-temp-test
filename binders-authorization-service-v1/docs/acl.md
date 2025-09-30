# ACL
a Role can have Many *Resource groups*
a **Resource group** can contain many resources

## Roles

- Creator
- Administrator
- Reader

## Rights
- Super-admin rights (our rights)
    - Creating administrator users.
    - All other rights.
- Administrative rights
    - Creating users
    - Removing/disabling users
    - Allocating rights to users
    - Creating documents
    - Make purchases (purchasing software licenses for documents/creators…)
    - Managing user groups
    - Managing document groups
    - Creation rights:
    - Creating documents
    - Entering texts
    - Uploading images
    - Combining texts and images
    - Entering translations
    - Creating collections
    - Adding metadata
    - Determining image behaviour
- Publishing rights
    - Publishing to certain users
    - Publishing to certain user groups
    - Determining if a document is password protected
    - Determining if a document is login-protected (meaning we need to know WHO is reading it, but it could be anyone that has a verified profile).
    - Reading rights:
    - Reading specific documents
    - Reading document collections
    - Reading unpublished documents and languages (as well as published documents and languages)


Available permissions for a resource can be:

- EDIT
- CREATE
- VIEW
- DELETE
- PUBLISH


## Schema:

```typescript
/**
 * @attribute {string} name - the name of the role
 * @attribute {string?} description - the description of the role
 * @attribute {ResourceGroup[]} - the resource groups linked to this role
 */
interface Role {
    name: string;
    description?: string;
    resources?: ResourcePermission[] // can be both, resource or resource group
}

/**
 * @attribute {string} type - the type of the resource
 * @attribute {number} id - the id of the resource
 */
interface Resource {
    type: string;
    id: number
}

/**
 * @attribute {string} name - The name of the group (ex. blogs)
 * @attribute {Resource[]?} contains - the resources the group contains
 * @attribute {Permission[]} permissions - the permissions the resoruce group has access to
 */
interface ResourceGroup {
    name: string               // the name of the group, ex. blogs
    contains?: Resource[]      // (optional) the resources it contains, if empty: all
}

interface ResourcePermission {
    resource: ResourceGroup | Resource
    permissions?: Permission[]  // the permissions the resource group has access to
}

/**
 * @readonly
 * @enum {string}
 */
enum PermissionName {EDIT, VIEW, DELETE, CREATE, PUBLISH};

/**
 * Permissions
 * @attribute {PermissionName} name - defines the permission name
 * @attribute {string} description - the description of the permission
 */
interface Permission {
    name: PermissionName,
    description?: string
}
```

### Mongo schema
```json
{
    "_id" : ObjectId("58b6c953270d74c77383f51f"),
    "roleId" : "rid-0fb03b72-d6ed-4204-abbd-f64b8879b4a6",
    "name" : "ADMIN",
    "description" : "Administrator",
    "permissions" : [
        {
            "resource" : {"type": "publicationfind"},
            "permissions" : [
                0,
                1,
                2,
                3
            ]
        },
        {
            "resource" : {"type": "me"},
            "permissions" : [
                0,
                1,
                2,
                3
            ]
        }
    ]
}
```

### Example
Within a company there is a role **Manager**
The manager has following resources available

- users: all (CREATE, EDIT, VIEW, DELETE)
- documents: with id 1, 4, 7, 12 (VIEW, EDIT, PUBLISH)
