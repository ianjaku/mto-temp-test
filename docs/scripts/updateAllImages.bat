echo "Updating images..."
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