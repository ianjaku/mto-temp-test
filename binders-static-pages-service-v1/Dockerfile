FROM nginxinc/nginx-unprivileged

# Backend configurations
COPY conf.d/ /etc/nginx/conf.d/
COPY assets/ /usr/share/nginx/html/assets/

# Backend files
COPY maintenance/ /usr/share/nginx/html/maintenance/
COPY indebanvandetijd/ /usr/share/nginx/html/indebanvandetijd/
COPY telltree/ /usr/share/nginx/html/telltree/
COPY bindersmedia/ /usr/share/nginx/html/bindersmedia/
COPY testnewip/ /usr/share/nginx/html/testnewip