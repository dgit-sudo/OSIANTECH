<?php
$f = '/var/www/html/chamilo/src/CoreBundle/Repository/ResourceRepository.php';
if (file_exists($f)) {
    $lines = file($f);
    echo implode('', array_slice($lines, 240, 65));
}
