<?php
$f = '/var/www/html/chamilo/src/CoreBundle/Repository/ResourceRepository.php';
if (file_exists($f)) {
    echo "=== ResourceRepository.php (lines 1 to 140) ===\n";
    $lines = file($f);
    echo implode('', array_slice($lines, 0, 140));
}
