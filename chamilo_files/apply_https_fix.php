<?php
require_once '/var/www/html/chamilo/vendor/autoload.php';

use Symfony\Component\Dotenv\Dotenv;

$dotenv = new Dotenv();
if (file_exists('/var/www/html/chamilo/.env')) {
    $dotenv->load('/var/www/html/chamilo/.env');
}
if (file_exists('/var/www/html/chamilo/.env.local')) {
    $dotenv->load('/var/www/html/chamilo/.env.local');
}

$dbUrl = $_ENV['DATABASE_URL'] ?? getenv('DATABASE_URL') ?? '';
$parts = parse_url($dbUrl);
$host = $parts['host'] ?? '127.0.0.1';
$port = $parts['port'] ?? 3306;
$user = $parts['user'] ?? 'root';
$pass = $parts['pass'] ?? '';
$db   = ltrim($parts['path'] ?? '', '/');

$pdo = new PDO("mysql:host=$host;port=$port;dbname=$db;charset=utf8mb4", $user, $pass, [
    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION
]);

echo "=== 1. UPDATE access_url TO HTTPS ===\n";
$pdo->exec("UPDATE access_url SET url = 'https://learn.osian.tech/' WHERE id = 1");
echo "access_url updated to https://learn.osian.tech/\n";

echo "\n=== 2. UPDATE .env.local WITH TRUSTED_PROXIES AND ROOT_WEB ===\n";
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

TRUSTED_PROXIES=127.0.0.1,172.16.0.0/12,172.17.0.0/16,172.18.0.0/16,172.19.0.0/16,172.20.0.0/16,10.0.0.0/8
TRUSTED_HOSTS=^(learn\.osian\.tech|localhost|127\.0\.0\.1)$

ROOT_WEB="https://learn.osian.tech/"
APP_API_PLATFORM_URL="https://learn.osian.tech/api/"
ENV;

file_put_contents('/var/www/html/chamilo/.env.local', $envLocal);
echo ".env.local updated with TRUSTED_PROXIES and HTTPS URLs.\n";

echo "\n=== 3. VERIFY GLOBAL PATHS ===\n";
require_once '/var/www/html/chamilo/public/main/inc/global.inc.php';
echo "api_get_path(WEB_PATH): " . api_get_path(WEB_PATH) . "\n";
echo "api_get_path(WEB_AJAX_PATH): " . api_get_path(WEB_AJAX_PATH) . "\n";
