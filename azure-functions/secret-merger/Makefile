install:
	npm i

build: install
	npm run build

publish: build
	func azure functionapp publish binder-stg-secret-merger

run: build
	func start