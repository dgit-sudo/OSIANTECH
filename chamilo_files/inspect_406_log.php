<?php
$logFiles = [
    '/var/www/html/chamilo/var/log/prod.log',
    '/var/www/html/chamilo/var/log/dev.log',
    '/var/log/nginx/error.log',
    '/var/log/php8.2-fpm.log'
];

foreach ($logFiles as $lf) {
    if (file_exists($lf)) {
        echo "=== LAST 40 LINES OF $lf ===\n";
        $lines = file($lf);
        echo implode('', array_slice($lines, -40));
        echo "\n\n";
    }
}
