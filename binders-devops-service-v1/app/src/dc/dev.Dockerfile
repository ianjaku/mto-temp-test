FROM node:22-alpine3.20 AS base-rootless
ARG UID
ARG GID
RUN apk --no-cache add shadow
RUN groupmod --gid ${GID} node
RUN usermod --uid ${UID} --gid ${GID} node
RUN apk del shadow
RUN apk --no-cache add bash rsync inotify-tools

FROM base-rootless AS base
RUN mkdir -p /opt/binders
RUN mkdir -p /etc/binders
WORKDIR /opt/binders

# Packages

FROM base AS lib-client-v1
RUN npm i -g concurrently
USER node
ENTRYPOINT [ "yarn", "workspace", "@binders/client" ]

FROM base AS lib-common
RUN npm i -g concurrently
USER node
ENTRYPOINT [ "yarn", "workspace", "@binders/binders-service-common" ]

FROM base AS lib-uikit
RUN apk add --no-cache \
    bash \
    inotify-tools
RUN npm i -g concurrently
USER node
ENTRYPOINT [ "yarn", "workspace", "@binders/ui-kit" ]

# Web Apps

FROM base AS editor-v2-client
RUN npm i -g concurrently
USER node
ENTRYPOINT [ "yarn", "workspace", "@binders/editor-v2-client" ]

FROM base AS editor-v2
RUN npm i -g concurrently
EXPOSE 8006
USER node
ENTRYPOINT [ "yarn", "workspace", "@binders/editor-v2" ]

FROM base AS manage-v1-client
RUN npm i -g concurrently
USER node
ENTRYPOINT [ "yarn", "workspace", "@binders/manage-v1-client" ]

FROM base AS manage-v1
RUN npm i -g concurrently
EXPOSE 8008
USER node
ENTRYPOINT [ "yarn", "workspace", "@binders/manage-v1" ]

FROM base AS dashboard-v1-client
RUN npm i -g concurrently
USER node
ENTRYPOINT [ "yarn", "workspace", "@binders/dashboard-v1-client" ]

FROM base AS dashboard-v1
RUN npm i -g concurrently
EXPOSE 8008
USER node
ENTRYPOINT [ "yarn", "workspace", "@binders/dashboard-v1" ]

FROM base AS manualto-v1-client
RUN npm i -g concurrently
USER node
ENTRYPOINT [ "yarn", "workspace", "@binders/manualto-v1-client" ]

FROM base AS manualto-v1
RUN npm i -g concurrently
EXPOSE 8014
USER node
ENTRYPOINT [ "yarn", "workspace", "@binders/manualto-v1" ]

# API Services

FROM base AS account-v1
EXPOSE 8001
USER node
ENTRYPOINT [ "yarn", "workspace", "@binders/account-v1" ]

FROM base AS authorization-v1
EXPOSE 8002
USER node
ENTRYPOINT [ "yarn", "workspace", "@binders/authorization-v1" ]

FROM base AS binders-v3
RUN apk add --no-cache \
    rsync \
    inotify-tools \
    bash \
    gifsicle \
    ffmpeg \
    imagemagick \
    imagemagick-heic \
    xvfb \
    ttf-dejavu \
    ttf-droid \
    ttf-freefont \
    ttf-liberation \
    unifont
EXPOSE 8011
USER node
ENTRYPOINT [ "yarn", "workspace", "@binders/binders-v3" ]

FROM base AS credential-v1
EXPOSE 8014
USER node
ENTRYPOINT [ "yarn", "workspace", "@binders/credential-v1" ]

FROM base AS image-v1
RUN apk add --no-cache \
    rsync \
    inotify-tools \
    bash \
    gifsicle \
    ffmpeg \
    imagemagick \
    imagemagick-heic \
    xvfb \
    ttf-dejavu \
    ttf-droid \
    ttf-freefont \
    ttf-liberation \
    unifont
EXPOSE 8001
USER node
ENTRYPOINT [ "yarn", "workspace", "@binders/image-v1" ]

FROM image-v1 AS init-container
ENTRYPOINT [ "yarn" ]

FROM base AS notification-v1
EXPOSE 8010
USER node
ENTRYPOINT [ "yarn", "workspace", "@binders/notification-v1" ]

FROM base AS public-api-v1
EXPOSE 8017
USER node
ENTRYPOINT [ "yarn", "workspace", "@binders/public-api-v1" ]

FROM base AS screenshot-v1
RUN apk add --no-cache \
    rsync \
    inotify-tools \
    bash \
    gifsicle \
    ffmpeg \
    imagemagick \
    imagemagick-heic \
    xvfb \
    ttf-dejavu \
    ttf-droid \
    ttf-freefont \
    ttf-liberation \
    unifont
EXPOSE 8020
USER node
ENTRYPOINT [ "yarn", "workspace", "@binders/screenshot-v1" ]

FROM base AS tracking-v1
EXPOSE 8012
USER node
ENTRYPOINT [ "yarn", "workspace", "@binders/tracking-v1" ]

FROM base AS user-v1
EXPOSE 8013
USER node
ENTRYPOINT [ "yarn", "workspace", "@binders/user-v1" ]

