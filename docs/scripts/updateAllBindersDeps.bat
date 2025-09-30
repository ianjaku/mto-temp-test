@echo off
SETLOCAL

echo "Updating all binders dependencies..."
cd ../../binders-account-service-v1/app
CALL npm run update-binders-deps
cd ../../binders-credential-service-v1/app
CALL npm run update-binders-deps
cd ../../binders-editor-service-v1/client
CALL npm run update-binders-deps
cd ../../binders-editor-service-v1/service
CALL npm run update-binders-deps
cd ../../binders-image-service-v1/app
CALL npm run update-binders-deps
cd ../../binders-manage-service-v1/app
CALL npm run update-binders-deps
cd ../../binders-repository-service-v2/app
CALL npm run update-binders-deps
cd ../../binders-user-service-v1/app
CALL npm run update-binders-deps
cd ../../manualto-service-v1/client
CALL npm run update-binders-deps
cd ../../manualto-service-v1/service
CALL npm run update-binders-deps 
cd ../../docs/scripts

echo "Updated all dependencies, updating images..."
CALL :pull_docker binders-account-service
CALL :pull_docker binders-credential-service
CALL :pull_docker binders-image-service
CALL :pull_docker binders-repository-service
CALL :pull_docker binders-user-service
CALL :pull_docker binders-editor-service
CALL :pull_docker manualto-service
CALL :pull_docker binders-manage-service

echo "Updated docker images"


:: PULL DOCKER IMAGES
:pull_docker
	docker pull docker.dev.binders.media/binders/%~1
EXIT /B %ERRORLEVEL%

pause