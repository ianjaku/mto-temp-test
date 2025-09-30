set positional-arguments

[private]
default:
    just --list

help:
    just --list

# Generate docker-compose.yml & start web & dependent services. Accepts the same arguments as `dc`
boot *args='':
    just dc {{args}}
    just up-web

# Stops all containers, re-generate docker-compose.yml & start web & dependent services. Accepts the same arguments as `dc`
reboot *args='':
    just down
    just dc {{args}}
    just up-web

# Stops all containers
weekend:
    docker compose down

# Proxy for yarn workspace @binders/devops-v1 dc. Run just dc --help
dc *args='':
    @if [ ! -s binders-devops-service-v1/app/dist/src/dc/main.js ] || \
       [ "$(grep -oP 'DC_VERSION\s*=\s*"\K[^"]+' binders-devops-service-v1/app/src/dc/main.ts)" != "$(grep -oP 'DC_VERSION\s*=\s*"\K[^"]+' binders-devops-service-v1/app/dist/src/dc/main.js 2>/dev/null)" ]; then \
        echo "dc is not built or version mismatch, building..."; \
        yarn && yarn workspace @binders/devops-v1 dc:build; \
    fi
    node binders-devops-service-v1/app/dist/src/dc/main.js {{args}}

# Stop all containers except elastic, mongo & redis
down: down-web down-api down-libs

# Stop all web containers (does not stop dependent containers)
down-web:
    @if docker compose ps -q editor-v2-client  >/dev/null 2>&1; then \
        docker compose stop editor-v2-client; \
    fi
    docker compose stop editor-v2 manualto-v1 manualto-v1-client manage-v1

# Stop all lib containers
down-libs:
    docker compose stop lib-client-v1 lib-common lib-uikit

# Stop all API containers (does not stop dependent containers)
down-api:
    docker compose stop \
        account-v1 \
        authorization-v1 \
        binders-v3 \
        credential-v1 \
        image-v1 \
        notification-v1 \
        screenshot-v1 \
        tracking-v1 \
        user-v1 \
        public-api-v1


# Restart all lib containers
restart-libs:
    just down-libs
    just up-libs

# Restart all web containers
restart-web:
    just down-web
    just up-web

# Restart all API containers
restart-api:
    just down-api
    just up-api

# Restart all containers (eg. after switching branch)
restart: restart-libs restart-api restart-web

# Stops the stack, pulls & switches the branch & starts the stack in build-and-run mode
review BRANCH='develop':
    @if [ -s docker-compose.yml ]; then \
        just down; \
    fi
    git fetch origin {{BRANCH}}
    git switch {{BRANCH}}
    git pull origin {{BRANCH}}
    just dc -Bs
    just up-web

# Stops the stack, switches the branch & starts the stack
switch BRANCH='develop':
    just down
    git switch {{BRANCH}}
    yarn workspaces foreach --worktree --parallel run cleanup
    just up-web

# Start any service and wait for it to be healthy. Running it with no arguments will start all services.
up *services='':
    docker compose up --build --wait -d {{services}}

# Start all API services and wait for them to be healthy
up-api:
    docker compose up --build --wait -d \
        account-v1 \
        authorization-v1 \
        binders-v3 \
        credential-v1 \
        image-v1 \
        notification-v1 \
        screenshot-v1 \
        tracking-v1 \
        user-v1 \
        public-api-v1

# Start all web services and wait for them to be healthy
up-web:
    docker compose up --build --wait -d \
        editor-v2 \
        manage-v1 \
        manualto-v1

# Start all library builders and wait for them to be healthy
up-libs:
    docker compose up --build --wait -d \
        lib-client-v1 \
        lib-common \
        lib-uikit

nuke-containers:
    @echo "WARNING: This will remove ALL containers on the system!"
    @read -p "Press Ctrl+C to cancel, or Enter to continue..." xxx
    docker rm -f $(docker ps -aq)
