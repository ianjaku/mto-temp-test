# Persistent cache

The persistent keeps all data util it has been invalidated.

## Invalidating

Invalidating happens from the repositories. If a repository is used to change
anything in the database, then it will use the service-common/cache/invalidating
code to run an invalidate request.

A list of all places where this request will be sent is available in:
service-common/cache/invalidating/invalidators.ts

## Stores

Every directory in the "stores" directory is it's own store.
A store is completely standalone and may not use code from other stores.

Every store represents a specific thing that is being cached.

Example:

- The "acls" store caches acls per account.
- The "groups" store caches groups per user.

Stores should contain all logic necessary to fetch, invalidate and cache data.

## Caches

These are comparable to services.

The caches use the stores, and other caches to expose the end functionality
of our persistent cache.

It's possible that in the future a circular dependency could exist between caches.
In that case you could split the caches into two layers.

## Helpers

These contain standalone logic that is very similar to the logic of a service.
This logic could, in the future, potentially be shared between persistent cache and service.

## Proxies

The persistent cache implements some functions that have exactly the same working
as one of the service functions.
In this case we can wrap the service client in a wrapper (proxy) to make usage
of the cache very easy.

!! Make sure to only do this in backend services as to not avoid authorization.

!! Make sure you don't create a circular dependency by using the backend service
!! inside the caches and having a proxy that does the same thing.

## How to add an invalidator

1. Add an event type in "invalidateevents.ts" (only if a new event type is needed)
2. Make sure to add your new event type to "AnyInvalidateEvent"
3. Create an invalidator class extending Invalidator
4. Add your invalidator in invalidators.ts

Make sure the repository in question implements the invalidator
events you're using (onDelete, onUpdate, onCreate).
