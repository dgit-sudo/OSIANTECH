<?php
$f = '/var/www/html/chamilo/src/CoreBundle/Repository/ResourceRepository.php';
if (file_exists($f)) {
    echo "=== ResourceRepository.php ===\n";
    $lines = file($f);
    foreach ($lines as $num => $l) {
        if (strpos($l, 'function getResourcesByCourse') !== false) {
            echo implode('', array_slice($lines, $num, 75));
            break;
        }
    }
}
