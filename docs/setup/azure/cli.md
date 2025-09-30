

## Get the latest azure command line version from github

*  Install virtualenv and create a virtual python environment
```
apt-get install virtualenv
virtual env
```
*  Activate the virtual env
```
. env/bin/activate
```
*  Install the required build dependencies
```
apt-get install python-dev
```
*  Install the cli using pip
```
pip install --pre azure-cli --extra-index-url https://azurecliprod.blob.core.windows.net/edge
```


## Upgrade a previously installed version
*  Activate the virtual env (should be run from the directory where you created it)
```
. env/bin/activate
```
*  Run the upgrade command using pip
```
pip install --upgrade --pre azure-cli --extra-index-url https://azurecliprod.blob.core.windows.net/edge --no-cache-dir
```