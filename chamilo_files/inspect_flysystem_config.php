<?php
$f1 = '/var/www/html/chamilo/config/packages/flysystem.yaml';
$f2 = '/var/www/html/chamilo/config/packages/vich_uploader.yaml';

if (file_exists($f1)) {
    echo "=== flysystem.yaml ===\n";
    echo file_get_contents($f1);
} else {
    echo "flysystem.yaml not found.\n";
}

if (file_exists($f2)) {
    echo "\n=== vich_uploader.yaml ===\n";
    echo file_get_contents($f2);
}
