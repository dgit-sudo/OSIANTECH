<?php
$f = '/var/www/html/chamilo/src/CoreBundle/Controller/ResourceController.php';
if (file_exists($f)) {
    $lines = file($f);
    echo "=== processFile in ResourceController.php ===\n";
    foreach ($lines as $num => $l) {
        if (strpos($l, 'function processFile') !== false) {
            echo implode('', array_slice($lines, $num, 60));
            break;
        }
    }
}

$f2 = '/var/www/html/chamilo/src/CoreBundle/Helpers/ResourceFileHelper.php';
if (file_exists($f2)) {
    echo "\n=== ResourceFileHelper.php ===\n";
    echo file_get_contents($f2);
}
