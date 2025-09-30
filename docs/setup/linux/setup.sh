#!/bin/bash
echo Setting up the project

# Build everything
docker-compose build

# launch services
docker-compose up -d

# --- SETUP ---
read -p "Please enter the NPM token that's logged in on binders media:" npm_token
read -p "Please enter your desired IP:" ip

echo "NPM_TOKEN=$npm_token" > .env
echo "IP=$ip" >> .env

# --- ELASTICSEARCH ---
echo setting up elasticsearch...
# Install elasticsearch plugins
docker exec bindersmedia_elasticsearch bin/plugin install lmenezes/elasticsearch-kopf/2.0
docker exec bindersmedia_elasticsearch bin/plugin install cloud-aws
docker-compose restart elasticsearch

# Setup the elasticsearch repository
docker exec -ti bindersmedia_elasticsearch bash -c "curl -XPUT localhost:9200/_snapshot/s3_repository -d '{ \"type\": \"s3\", \"settings\": { \"bucket\": \"manualto-backups\", \"region\": \"eu-west-1\", \"access_key\": \"AKIAIWLHJ5KNKUXOP2GQ\", \"secret_key\": \"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\", \"compress\": true } }'"

# Initialize elasticsearch data
docker exec -ti bindersmedia_elasticsearch bash -c "curl -XPOST http://localhost:9200/_snapshot/s3_repository/backup_2017.09.01/_restore"
# start "" http://localhost:9200/_plugin/kopf/#!/cluster
`
# --- MONGO ---
echo seting up mongo...
docker cp docs/setup/mongo_2017.09.01.tar bindersmedia_mongo:/tmp/mongo_2017.09.01.tar
docker exec bindersmedia_mongo bash -c "mkdir /tmp/mongo_2017.09.01 && tar -xvf /tmp/mongo_2017.09.01.tar -C /tmp"
docker exec bindersmedia_mongo bash -c "cd /tmp/mongo_2017.09.01 && mongorestore ."`

# --- NPM MODULES ---
echo setting up node modules...
npm install -g eslint eslint-config-react-app eslint-plugin-import eslint-plugin-react babel-eslint tslint-config-prettier

REM attach to services
docker-compose up
