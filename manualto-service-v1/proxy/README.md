# Run nginx

```
docker run --name manualto-proxy -p 9998:80 -v /tmp/nginx.conf:/etc/nginx/nginx.conf:ro -v /tmp/proxy-nginx.conf:/etc/nginx/conf.d/default.conf:ro -d nginx
```


Point your browser to http://localhost:9998


# Run haproxy for dispatching api calls

```
docker run --name binders-api-proxy -p 8017:80 -v /tmp/haproxy.cfg:/usr/local/etc/haproxy/haproxy.cfg:ro -d haproxy
```
