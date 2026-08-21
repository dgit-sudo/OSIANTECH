<?php
echo "=== 1. CONFIGURE APACHE FOR HTTPS PROXY HEADERS ===\n";

$apacheConf = <<<APACHE
# Enable HTTPS detection from reverse proxy
SetEnvIf X-Forwarded-Proto "^https$" HTTPS=on
SetEnvIf X-Forwarded-Proto "^https$" REQUEST_SCHEME=https
SetEnvIf X-Forwarded-Port "^443$" SERVER_PORT=443

# RemoteIP
RemoteIPHeader X-Forwarded-For
RemoteIPInternalProxy 127.0.0.1 172.16.0.0/12 172.17.0.0/16 172.18.0.0/16 172.19.0.0/16 172.20.0.0/16 10.0.0.0/8
APACHE;

file_put_contents('/etc/apache2/conf-available/reverse-proxy-https.conf', $apacheConf);
shell_exec('a2enmod remoteip setenvif headers');
shell_exec('a2enconf reverse-proxy-https');
shell_exec('service apache2 reload || service apache2 restart');
echo "Apache configured and reloaded with reverse-proxy-https conf!\n";

echo "\n=== 2. UPDATE .env AND .env.local WITH TRUSTED_PROXIES=0.0.0.0/0 ===\n";

$envFile = '/var/www/html/chamilo/.env';
$envContent = file_get_contents($envFile);
$envContent = preg_replace('/TRUSTED_PROXIES=.*/', 'TRUSTED_PROXIES=127.0.0.1,172.16.0.0/12,172.17.0.0/16,172.18.0.0/16,172.19.0.0/16,172.20.0.0/16,10.0.0.0/8,0.0.0.0/0', $envContent);
file_put_contents($envFile, $envContent);

$envLocalFile = '/var/www/html/chamilo/.env.local';
$envLocal = <<<ENV
APP_ENV=prod
APP_DEBUG=0
APP_SECRET=osian_secret_chamilo2_key_2026

DATABASE_URL="mysql://chamilouser:ChamiloUserPass2026!@chamilo2_db:3306/chamilo?serverVersion=mariadb-10.11.0&charset=utf8mb4"
DATABASE_HOST=chamilo2_db
DATABASE_PORT=3306
DATABASE_NAME=chamilo
DATABASE_USER=chamilouser
DATABASE_PASSWORD=ChamiloUserPass2026!

TRUSTED_PROXIES=127.0.0.1,172.16.0.0/12,172.17.0.0/16,172.18.0.0/16,172.19.0.0/16,172.20.0.0/16,10.0.0.0/8,0.0.0.0/0
TRUSTED_HOSTS=^(learn\.osian\.tech|localhost|127\.0\.0\.1)$

ROOT_WEB="https://learn.osian.tech/"
APP_API_PLATFORM_URL="https://learn.osian.tech/api/"
ENV;
file_put_contents($envLocalFile, $envLocal);

echo ".env and .env.local updated!\n";

echo "\n=== 3. UPDATE global.inc.php TO LOAD .env.local IF PRESENT ===\n";
$globalFile = '/var/www/html/chamilo/public/main/inc/global.inc.php';
$globalContent = file_get_contents($globalFile);
if (strpos($globalContent, 'loadEnv') === false) {
    $globalContent = str_replace(
        "(new Dotenv())->load($envFile);",
        "(new Dotenv())->loadEnv($envFile);",
        $globalContent
    );
    file_put_contents($globalFile, $globalContent);
    echo "global.inc.php updated to loadEnv!\n";
} else {
    echo "global.inc.php already uses loadEnv.\n";
}

echo "\n=== 4. TEST SIMULATED HTTPS REQUEST IN PHP ===\n";
$_SERVER['HTTP_HOST'] = 'learn.osian.tech';
$_SERVER['HTTP_X_FORWARDED_PROTO'] = 'https';
$_SERVER['HTTP_X_FORWARDED_PORT'] = '443';
$_SERVER['HTTPS'] = 'on';
$_SERVER['SERVER_PORT'] = '443';

require_once '/var/www/html/chamilo/public/main/inc/global.inc.php';
echo "api_get_path(WEB_PATH): " . api_get_path(WEB_PATH) . "\n";
echo "api_get_path(WEB_AJAX_PATH): " . api_get_path(WEB_AJAX_PATH) . "\n";
