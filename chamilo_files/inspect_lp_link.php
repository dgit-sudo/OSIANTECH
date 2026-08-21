<?php
$f = '/var/www/html/chamilo/public/main/lp/learnpath.class.php';
if (file_exists($f)) {
    $lines = file($f);
    foreach ($lines as $n => $l) {
        if (strpos($l, 'function get_link') !== false) {
            echo "Line $n: " . implode('', array_slice($lines, $n, 80)) . "\n----------------\n";
            break;
        }
    }
}
