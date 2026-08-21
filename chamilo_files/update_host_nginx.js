
const { execSync } = require('child_process');
try {
    const nginxConf = `server {
    server_name learn.osian.tech;

    client_max_body_size 500M;

    location / {
        proxy_pass http://127.0.0.1:8085;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
        proxy_set_header X-Forwarded-Port 443;
        proxy_set_header X-Forwarded-Ssl on;
    }

    listen [::]:443 ssl ipv6only=on; # managed by Certbot
    listen 443 ssl; # managed by Certbot
    ssl_certificate /etc/letsencrypt/live/learn.osian.tech/fullchain.pem; # managed by Certbot
    ssl_certificate_key /etc/letsencrypt/live/learn.osian.tech/privkey.pem; # managed by Certbot
    include /etc/letsencrypt/options-ssl-nginx.conf; # managed by Certbot
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem; # managed by Certbot
}

server {
    if (\$host = learn.osian.tech) {
        return 301 https://\$host\$request_uri;
    }

    listen 80;
    listen [::]:80;
    server_name learn.osian.tech;
    return 404;
}
`;

    const confPath = execSync('grep -l "learn.osian.tech" /etc/nginx/sites-enabled/* /etc/nginx/conf.d/* 2>/dev/null | head -n 1', { encoding: 'utf8' }).trim();
    if (confPath) {
        require('fs').writeFileSync(confPath, nginxConf, 'utf8');
        console.log("Updated host Nginx config at " + confPath);
        console.log(execSync('nginx -t && systemctl reload nginx', { encoding: 'utf8' }));
    }
} catch (e) {
    console.error(e.message);
}
