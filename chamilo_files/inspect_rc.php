<?php
$f = '/var/www/html/chamilo/src/CoreBundle/Controller/ResourceController.php';
if (file_exists($f)) {
    $lines = file($f);
    echo implode('', array_slice($lines, 148, 90));
}
