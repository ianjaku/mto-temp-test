ssh -R 8017:localhost:8017 buildserver
ssh -R 8016:localhost:8006 buildserver
docker run --name binders-api-proxy -p 8017:80 -v C:\Users\Toms\Projects\binders\binders-service\manualto-service-v1\proxy\config\haproxy.cfg:/usr/local/etc/haproxy/haproxy.cfg:ro haproxy
