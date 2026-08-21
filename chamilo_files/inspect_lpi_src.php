<?php
$f = '/var/www/html/chamilo/public/main/lp/learnpathItem.class.php';
if (file_exists($f)) {
    $lines = file($f);
    foreach ($lines as $n => $l) {
        if (strpos($l, 'function get_src') !== false) {
            echo implode('', array_slice($lines, $n, 60));
            break;
        }
    }
}
