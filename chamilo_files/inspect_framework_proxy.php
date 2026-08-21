<?php
echo "=== 1. config/packages/framework.yaml ===\n";
if (file_exists('/var/www/html/chamilo/config/packages/framework.yaml')) {
    echo file_get_contents('/var/www/html/chamilo/config/packages/framework.yaml') . "\n";
}

echo "\n=== 2. public/index.php ===\n";
if (file_exists('/var/www/html/chamilo/public/index.php')) {
    echo file_get_contents('/var/www/html/chamilo/public/index.php') . "\n";
}

echo "\n=== 3. Nginx inside chamilo2_app or Apache ===\n";
$isNginx = shell_exec('which nginx');
$isApache = shell_exec('which apache2 || which httpd');
echo "Web server in container: Nginx=" . trim($isNginx) . " | Apache=" . trim($isApache) . "\n";

echo "\n=== 4. Docker bridge gateway IP ===\n";
echo "Container REMOTE_ADDR from host: " . shell_exec("ip route | awk '/default/ { print $3 }'") . "\n";
