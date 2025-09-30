FROM node:22-bullseye-slim AS node

# Start with Ubuntu 22.04 as the base image
FROM ubuntu:22.04

# Ensure we're up-to-date with package versions
RUN apt-get update && apt-get upgrade -y

# Install Node.js, npm, and necessary build tools
RUN apt-get install -y \
    curl \
    sudo \
    gnupg \
    lsb-release \
    docker

ARG MONGO_TOOLS_VERSION=100.13.0
RUN curl -O https://fastdl.mongodb.org/tools/db/mongodb-database-tools-ubuntu2004-x86_64-${MONGO_TOOLS_VERSION}.tgz && \
    tar -zxvf mongodb-database-tools-ubuntu2004-x86_64-${MONGO_TOOLS_VERSION}.tgz && \
    mv mongodb-database-tools-ubuntu2004-x86_64-${MONGO_TOOLS_VERSION}/bin/* /usr/local/bin/ && \
    rm -rf mongodb-database-tools-ubuntu2004-x86_64-${MONGO_TOOLS_VERSION}.tgz mongodb-database-tools-ubuntu2004-x86_64-${MONGO_TOOLS_VERSION}

RUN curl -sL https://aka.ms/InstallAzureCLIDeb | sudo bash

# Copy Node.js and npm from the Node.js image
COPY --from=node /usr/local/bin/node /usr/local/bin/node
COPY --from=node /usr/local/lib/node_modules/npm/ /usr/local/lib/node_modules/npm/

# Create a symlink for npm
RUN ln -s /usr/local/lib/node_modules/npm/bin/npm-cli.js /usr/local/bin/npm

# Install Node.js global packages
RUN npm i -g yarn typescript@5.4.5 ts-node
RUN az aks install-cli
# Download and install kubectl-node_shell
RUN curl -LO https://github.com/kvaps/kubectl-node-shell/raw/master/kubectl-node_shell && \
    chmod +x ./kubectl-node_shell && \
    mv ./kubectl-node_shell /usr/local/bin/kubectl-node_shell

# Clean up apt cache to reduce image size
RUN apt-get clean && rm -rf /var/lib/apt/lists/*
