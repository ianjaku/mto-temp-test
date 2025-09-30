ACR_NAME=binders
TAG ?= node22
PW_TAG ?= 1.53.1-jammy-multi-browser
DEVOPS_TAG ?= node22-ts5.4

pull_base_images:
	docker pull node:22-alpine
	docker pull node:22-bookworm
	docker pull "mcr.microsoft.com/azure-cli"

login:
	az acr login --name $(ACR_NAME)

build_ubuntu-devops: login pull_base_images
	docker build -t $(ACR_NAME).azurecr.io/ubuntu-devops:$(DEVOPS_TAG) ./ubuntu-devops

push_ubuntu-devops: login
	docker push $(ACR_NAME).azurecr.io/ubuntu-devops:$(DEVOPS_TAG)

build_bitbucket-alpine: login pull_base_images
	docker build -t $(ACR_NAME).azurecr.io/bitbucket-alpine:$(TAG) ./bitbucket-alpine

push_bitbucket-alpine: login
	docker push $(ACR_NAME).azurecr.io/bitbucket-alpine:$(TAG)

build_bitbucket-after-build: login pull_base_images
	docker build -t $(ACR_NAME).azurecr.io/bitbucket-after-build:$(TAG) ./bitbucket-after-build

push_bitbucket-after-build: login
	docker push $(ACR_NAME).azurecr.io/bitbucket-after-build:$(TAG)

build_playwright-az: login pull_base_images
	docker build -t $(ACR_NAME).azurecr.io/playwright-az:$(PW_TAG) ./playwright-az

push_playwright-az: login
	docker push $(ACR_NAME).azurecr.io/playwright-az:$(PW_TAG)


build_all: build_ubuntu-devops build_bitbucket-alpine build_bitbucket-after-build build_playwright-az

push_all: push_ubuntu-devops push_bitbucket-alpine push_bitbucket-after-build push_playwright-az

all: build_all push_all
