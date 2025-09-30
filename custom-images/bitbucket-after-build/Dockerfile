FROM node:22-bookworm

RUN apt update && apt-get upgrade -y
RUN apt install -y apt-transport-https xvfb git curl ssh wget
RUN apt install -y libgtk-3-0 libdbus-glib-1-2
RUN apt install -y libnss3 libnspr4 libgbm-dev libasound-dev

RUN echo "deb [arch=amd64] https://packages.microsoft.com/repos/azure-cli/ bookworm main" | \
    tee /etc/apt/sources.list.d/azure-cli.list
RUN curl -L https://packages.microsoft.com/keys/microsoft.asc | apt-key add -
RUN apt-get update && apt-get install azure-cli
RUN az aks install-cli
#From script option https://helm.sh/docs/intro/install/
RUN curl -fsSL -o get_helm.sh https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3
RUN chmod 700 get_helm.sh
RUN ./get_helm.sh
RUN rm -f get_helm.sh

RUN wget -O firefox-esr.tar.bz2 https://ftp.mozilla.org/pub/firefox/releases/102.11.0esr/linux-x86_64/en-US/firefox-102.11.0esr.tar.bz2
RUN tar xjf firefox-esr.tar.bz2 -C /opt
RUN rm firefox-esr.tar.bz2
RUN ln -s /opt/firefox/firefox /usr/local/bin/

RUN wget -O geckodriver.tgz https://github.com/mozilla/geckodriver/releases/download/v0.33.0/geckodriver-v0.33.0-linux64.tar.gz
RUN tar xvf geckodriver.tgz
RUN mv geckodriver /usr/local/bin/geckodriver


