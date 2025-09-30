# Webdata


Try to use a WebData object when doing API calls
WebData is a wrapper for data that is fetched remotely and has one of 4 possible states

* NOT_ASKED: The request has not been initiated
* PENDING: The request was made, we are waiting for a response
* SUCCESS: The server returned data correctly
* FAILURE: The request failed

# Flux and WebData

## Store

* When adding new properties to a store, always define a key for it with prefix `KEY_`
* If the property is there to just store the result of a API call, make it a managed key
    * A key can be managed by adding it to the `ALL_MANAGED_KEYS` array (see `src/users/store.js`)
    * A managed key will be initiated with a WebData object in the NOT_ASKED state
    * Use actions to manage the transitions of the managed WebData store property (see below)


## Actions

Wrap API calls using `wrapAction`

```
const myAction = (p1, p2) =>
    wrapAction(
        () => APICall(p1, p2),
        KEY_STORE_PROP,
        "My API call failed"
    )
```


This will do a lot of things for you automatically


* It will wrap the API calls in a WebData object and transform the object as the request progresses
* It will dispatch WebData events to the store using `KEY_STORE_PROP` as a prefix (`KEY_STORE_PROP/PENDING`, `KEY_STORE_PROP/SUCCESS` or `KEY_STORE_PROP/ERROR`)
* It will display a `FlashMessage` if the API call fails

## Rendering
Now you have the tools to manage the data in our flux stores. To render it, create a class that subclasses `WebDataComponent`. In its `render` method invoke the `renderWebData` method (see `src/application/index.js` for an example). By default, the `renderWebData` will display the loader until the request completes. This behavior can be overridden using the `options` parameter or by overriding the `renderPending` method.
Once the request completes, either `renderSucces` or `renderFailure` is called.

## Compose
If you have multiple WebData objects you can combine them into one using `WebData.compose`. For an example see `src/application/index.js`. There we combine the user details and accounts into a single WebData object. The `renderSuccess` will get an object composed of the fetched data.

# Data loading
We need to make sure we don't start firing actions (and thus possibly API calls) all over the place. Place the action calls in the `componentDidMount` hook of the Containers. If you are using the WebDataComponent we can control the order in which API calls are made. E.g. in the `App` component we load the accounts and user details and select the active account. This active account is needed to proceed with the child components (e.g. `MyLibrary`). The way we can do this is by only rendering the child components in the `renderSuccess` method, since there we know the action to fetch the accounts actually worked.

| Component | Actions triggered| Blocks on action | Children |
|-----------|------------------|------------------|----------|
| App | myAccounts (+activateAccountId +myDocuments), myUserDetails | myAccounts, myUserDetails | Navigator, UsersRouter |
| Navigator | | myDocuments | MyLibrary, Composer |
| MyLibrary | loadBrowseContext | | |
| Composer | loadBrowseContext | | |
| UsersRouter | activateAccountId, accountUsers, accountUsergroups | | |

# Docker

* ```docker-compose build new_editor_service ui_kit```
* ```docker-compose up```
* The new service should be running on port 3010 (browsersync) and 8010
* If you make changes to styles files in ui-kit you need to run this command to make the changes available in the container: ```docker-compose exec ui_kit sh scripts/copyAssets.sh```.
