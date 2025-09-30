REM Account service
call cd ./binders-account-service-v1/app 
start npm run setup

REM Credential service
call cd ./binders-credential-service-v1/app 
start npm run setup

REM Editor service
call cd ./binders-editor-service-v1/service 
start npm run setup

call cd ./binders-editor-service-v1/client 
start npm run setup

REM Image service
call cd ./binders-image-service-v1/app
start npm run setup

REM Manage service
call cd ./binders-manage-service-v1/app 
start npm run setup

REM Repository service
call cd ./binders-repository-service-v3/app 
start npm run setup

REM Manualto
call cd ./manualto-service-v1/client 
start npm run setup

call cd ./manualto-service-v1/service 
start npm run setup