<?php
require_once '/var/www/html/chamilo/vendor/autoload.php';

// Check public/index.php to find Kernel class
$indexPath = '/var/www/html/chamilo/public/index.php';
if (file_exists($indexPath)) {
    echo "=== public/index.php ===\n";
    echo file_get_contents($indexPath);
    echo "\n=======================\n";
}

// Check src/Kernel.php
$kernelPath = '/var/www/html/chamilo/src/Kernel.php';
if (file_exists($kernelPath)) {
    echo "=== src/Kernel.php found ===\n";
    $lines = file($kernelPath);
    echo implode('', array_slice($lines, 0, 30));
}
