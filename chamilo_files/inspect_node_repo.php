<?php
require_once '/var/www/html/chamilo/vendor/autoload.php';

$file = '/var/www/html/chamilo/src/CoreBundle/Repository/Node/ResourceNodeRepository.php';
if (!file_exists($file)) {
    $cmd = 'find /var/www/html/chamilo/src -name "ResourceNodeRepository.php" 2>/dev/null';
    exec($cmd, $out);
    $file = $out[0] ?? '';
}

if ($file && file_exists($file)) {
    echo "=== ResourceNodeRepository.php ===\n";
    $lines = file($file);
    foreach ($lines as $num => $l) {
        if (strpos($l, 'getResourceNodeFileStream') !== false || strpos($l, 'getFilename') !== false || strpos($l, 'getFilePath') !== false) {
            echo implode('', array_slice($lines, max(0, $num - 5), 45));
            echo "\n-------------------\n";
        }
    }
}
