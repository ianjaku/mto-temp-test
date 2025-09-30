install:
	npm i

build: install
	npm run build

publish-dev: build
	func azure functionapp publish binder-dev-take-screenshot-v2

publish-stg: build
	func azure functionapp publish binder-stg-take-screenshot-v2

publish-prod: build
	func azure functionapp publish binder-prod-take-screenshot-v2

publish-sandbox: build
	func azure functionapp publish binder-sand-take-screenshot-v2