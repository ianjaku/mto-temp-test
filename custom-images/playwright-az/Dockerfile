FROM mcr.microsoft.com/playwright:v1.53.1-jammy
RUN apt-get update && apt-get upgrade -y && apt-get clean -y
RUN PLAYWRIGHT_BROWSERS_PATH="/root/.cache/ms-playwright" npx playwright@1.53.1 install chrome firefox msedge --with-deps
RUN curl -sL https://aka.ms/InstallAzureCLIDeb | bash
RUN az aks install-cli

