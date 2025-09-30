# Integration testing

Our integration tests, test our backend services by sending http requests
using the service clients and checking what comes back.

They could also be described as E2E tests for our backend.

## Warning

It's rather easy to forget a single *await* somewhere.
In most cases, when you forget one, you'll get the following message in your test results:

```
Jest did not exit one second after the test run has completed.

This usually means that there are asynchronous operations that weren't stopped in your tests. Consider running Jest with `--detectOpenHandles` to troubleshoot this issue.
```

## Example test

```ts
const config = BindersConfig.get();
const globalFixtures = new TestFixtures(config);
const clientFactory = new ClientFactory(
    config,
    UserServiceClient,
    "v1"
);

describe("whoAmI", () => {
    it("returns the current user", async () => {
        await globalFixtures.withAnyAccount(async (fixtures) => {
            const user = await fixtures.users.create();
            const client = clientFactory.createForFrontend(user.id);

            const result = await userClient.whoAmI();

            expect(result.id).toBe(user.id);
            expect(result.firstName).toBe(user.firstName);
        });
    });
});
```

## Test fixtures

Test fixtures are the bread and butter of integration tests.
They allow you to easily create certain types of data that you might need in your tests.
They also automatically clean up all created data.

> :warning: If you add your own fixtures, make sure the data gets deleted in the TestFixtures#delete method

To see which fixtures are available, head over to the TestFixtures class.

### Creating accounts

There are two common ways to create an account.

1. *withAnyAccount* This will get an account that is global to the current test file. It is possible that his has already been used by other tests. It will only ever be used by one test at the same time.

2. *withFreshAccount* This will create a new account for the current test. No other test will have access to this account.

Both of these functions take a callback as the second parameter.
This callback contains an instance of the TestAccountFixtures which has most of the interesting fixtures.

## Client factory

The client factory makes it possible to easily impersonate a certain user
or create a backend client.

### createBackend

*ClientFactory#createBackend* is very similar to running BackendXClient.fromConfig(...).
The only difference being that you don't need to create a config or care about any of the other parameters.

### createForFrontend

*ClientFactory#createForFrontend* Will create a service client. Whenever a request is made using that client. It will impersonate the given user. The request will then be sent as if the given user sent the request.

This is useful to test endpoints that change depending on who sends the request. It's also useful to test authentication & authorization requirements.

## How to run tests

Integration tests have to be ran against a running environment. (On local, the dev environment has to be running).

The easiest way to run them, is to attach to the container and run the script.

```bash
# From your command line
containerid=$(docker ps -qf "name=notific")
docker exec $containerid -it bash

# Then inside of the container (replace notification-v1 with your preffered service)
yarn workspace @binders/notification-v1 integrationtest
```

Or shorter (but without the fancy colors)

```bash
containerid=$(docker ps -qf "name=notific")
docker exec $containerid yarn workspace @binders/notification-v1 integrationtest
```

## Add integration tests to a new service

1. Create a directory at app/tests/integration
2. Copy the jest.json from another service
3. Add a script in the package.json to run `jest --config=tests/integration/jest.json`
4. Start writing tests inside of the integration directory

## Testing errors

If you're expecting an error, a 401 respones for example. The the helper *expectStatusCode* might be helpful.

```ts
await expectStatusCode(
    401,
    () => client.findNotificationTargets(accountId)
);
```

> :warning: Make sure to await this function
