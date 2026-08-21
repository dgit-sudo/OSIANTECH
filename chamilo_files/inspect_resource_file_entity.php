<?php
$f = '/var/www/html/chamilo/src/CoreBundle/Entity/ResourceFile.php';
if (file_exists($f)) {
    echo "=== ResourceFile.php ===\n";
    echo file_get_contents($f);
}
