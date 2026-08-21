<?php
$f = '/var/www/html/chamilo/public/main/lp/learnpath.class.php';
if (file_exists($f)) {
    $lines = file($f);
    echo implode('', array_slice($lines, 2870, 70));
}
