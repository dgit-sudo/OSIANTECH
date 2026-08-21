<?php
$lines = file('/var/www/html/chamilo/src/CoreBundle/Entity/Course.php');
foreach ($lines as $i => $l) {
    if (strpos($l, 'tools') !== false || strpos($l, 'CTool') !== false) {
        echo ($i+1) . ": " . $l;
    }
}
