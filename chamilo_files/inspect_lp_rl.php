<?php
$f = '/var/www/html/chamilo/public/main/lp/learnpath.class.php';
if (file_exists($f)) {
    $lines = file($f);
    foreach ($lines as $n => $l) {
        if (strpos($l, 'function rl_get_resource_link_for_learnpath') !== false) {
            echo "Line $n: " . implode('', array_slice($lines, $n, 60)) . "\n----------------\n";
            break;
        }
    }
}
