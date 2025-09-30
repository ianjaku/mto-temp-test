
# Dev machine setup

## Modify the docker configuration

Copy the saml-sso config file and restart docker

```
cp docs/dockerConfiguration/binders.json.saml-sso docs/dockerConfiguration/binders.json
docker-compose restart
```

## Start the local load balancer that will dispatch the API calls locally

Copy the haproxy config file from the reader folder to /tmp

`cp manualto-service-v1/proxy/config/haproxy.cfg /tmp`

Start the load balancer

`docker run --name binders-api-proxy -p 8018:80 -v /tmp/haproxy.cfg:/usr/local/etc/haproxy/haproxy.cfg:ro -d haproxy`

## Start the tunnels

```
ssh -R 8017:localhost:8006 buildserver
ssh -R 8018:localhost:8018 buildserver
```

# Build server setup

Make sure these snippets are part of the haproxy config on the buildserver

```
    # As part of the public frontend
    acl is_saml_sso_api hdr(host) -i saml-api.dev.binders.media
    use_backend saml_sso_api_backend if is_saml_sso_api
    acl is_saml_sso hdr(host) -i saml.dev.binders.media
    use_backend saml_sso_backend if is_saml_sso
```

```
backend saml_sso_backend
    server dev 127.0.0.1:8017

backend saml_sso_api_backend
    server dev 127.0.0.1:8018
```