# Microsoft transactable offers

MS transactable offers allows customers to buy software on the Microsoft Commercial store
(basically app store for business).

Microsoft will handle billing and invoicing and report changes in billing through a webhook.

## msAccountSetupRequests

When a new customer buys our product through Microsft
all data necessary to manually create an account will be stored here.

## msTransactableEvents

All events received on the webhook from microsoft according transactable offers will be logged here.
Creation of msAccountSetupRequest will also be logged as "init".

## msTransactableSubscriptions

Links a microsoft subscriptionId & purchaseIdToken to an account.
