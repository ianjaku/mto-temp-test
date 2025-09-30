# Binders media onboarding

## Pre-requisites
- Docker ([https://www.docker.com/]()) (with docker-compose enabled) (if you download Docker for Windows - make sure you give Hyper-V enough memory: Docker->Settings->Advanced)
- Nodejs (v6+)
- Git

## Setup
1. clone the repository: `git clone git@gitlab.com:BindersMedia/binders-service.git`
2. ``` npm set registry https://npm.dev.binders.media
npm login ```
3. Create a `.env` file in the main folder, copy `.env.example` and edit out your details
    - [.env](../../.env)
4. in the **binders-service** folder run `docker-compose build`

5. Start the services using `docker-compose up`
- if it is not working - check the [detailed setup manual](./setup-manual.md)
6. After services are running, run the according setup
    - linux: `./docs/setup/linux/setup.sh`
    - windows: `call docs/setup/windows/setup.bat`
7. visit one of the pages
    - [ManualTo Editor](http://localhost:3005)
    - [ManualTo Reader](http://localhost:3006)

    if above pages are not working check: http://localhost:8005 and http://localhost:8006


## Detailed & manual guide
a more detailed guide can be found at [Here](./setup-manual.md) but should not be necessary if everything above worked

## FAQ
### Socket hang up
Make sure the **elasticsearch** and **redis** services are running, check output console

## Elasticsearch: ECONNREFUSED ... in repository service
Elasticsearch most likely didn't complete start before the repository service, restart the repository service
`docker-compose restart repository_service`

## Questions
ask your team

