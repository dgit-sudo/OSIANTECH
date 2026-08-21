<?php
$f = '/var/www/html/chamilo/public/main/lp/lp_view.php';
if (file_exists($f)) {
    $lines = file($f);
    echo implode('', array_slice($lines, 350, 90));
}
