<?php
echo "=== 1. TAIL OF /var/www/html/chamilo/var/log/prod.log ===\n";
if (file_exists('/var/www/html/chamilo/var/log/prod.log')) {
    $lines = array_slice(file('/var/www/html/chamilo/var/log/prod.log'), -40);
    echo implode('', $lines);
} else {
    echo "No prod.log found.\n";
}

echo "\n=== 2. TAIL OF /var/log/apache2/error.log ===\n";
if (file_exists('/var/log/apache2/error.log')) {
    $lines = array_slice(file('/var/log/apache2/error.log'), -40);
    echo implode('', $lines);
}

echo "\n=== 3. CHECK PERMISSIONS OF var DIRECTORY ===\n";
echo shell_exec('ls -la /var/www/html/chamilo/var /var/www/html/chamilo/var/cache');
