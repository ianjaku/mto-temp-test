
# Get the wild card certificates

certbot-auto certonly --server https://acme-v02.api.letsencrypt.org/directory --manual \
    --preferred-challenges dns -d '*.manual.to,*.editor.manual.to,*.telltree.com,*.be.manual.to'

