<?php
$f = '/var/www/html/chamilo/public/main/lp/learnpathItem.class.php';
if (file_exists($f)) {
    $lines = file($f);
    echo implode('', array_slice($lines, 480, 90));
}
