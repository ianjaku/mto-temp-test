#!/bin/bash

PACKAGES="passport-saml metrics"
CLIENT_PACKAGES="react-dev-utils"

docker-compose exec -u root manualto npm install $PACKAGE $CLIENT_PACKAGES--prefix ./client
docker-compose exec -u root manualto npm install $PACKAGES --prefix ./service
docker-compose exec -u root repository_service npm install $PACKAGES
docker-compose exec -u root credential_service npm install $PACKAGES
docker-compose exec -u root account_service npm install $PACKAGES
docker-compose exec -u root authorization_service npm install $PACKAGES
docker-compose exec -u root user_service npm install $PACKAGES
docker-compose exec -u root image_service npm install $PACKAGES
docker-compose exec -u root manage_service npm install $PACKAGES --prefix ./service
docker-compose exec -u root new_editor_service npm install $PACKAGES $CLIENT_PACKAGES --prefix ./client
docker-compose exec -u root new_editor_service npm install $PACKAGES --prefix ./service
docker-compose exec -u root tracking_service npm install $PACKAGES
docker-compose exec -u root notification_service npm install $PACKAGES
docker-compose exec -u root client npm install $PACKAGES
docker-compose exec -u root dashboard_service npm install $PACKAGES $CLIENT_PACKAGES --prefix ./client
docker-compose exec -u root dashboard_service npm install $PACKAGES --prefix ./service
docker-compose exec -u root monitoring_service npm install $PACKAGES
