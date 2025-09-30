winpty docker-compose exec -u root manualto npm install passport-saml --prefix ./service &&
winpty docker-compose exec -u root repository_service npm install passport-saml &&
winpty docker-compose exec -u root credential_service npm install passport-saml &&
winpty docker-compose exec -u root account_service npm install passport-saml &&
winpty docker-compose exec -u root authorization_service npm install passport-saml &&
winpty docker-compose exec -u root user_service npm install passport-saml &&
winpty docker-compose exec -u root image_service npm install passport-saml &&
winpty docker-compose exec -u root manage_service npm install passport-saml --prefix ./service &&
winpty docker-compose exec -u root new_editor_service npm install passport-saml --prefix ./service &&

$SHELL