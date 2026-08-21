
const { execSync } = require('child_process');
try {
    console.log("=== NGINX SITES ===");
    console.log(execSync('cat /etc/nginx/sites-enabled/* 2>/dev/null || cat /etc/nginx/conf.d/* 2>/dev/null', { encoding: 'utf8' }));
} catch (e) {
    console.error(e.message);
}
