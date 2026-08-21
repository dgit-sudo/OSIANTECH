<?php
require_once '/var/www/html/chamilo/vendor/autoload.php';

$cmd = 'grep -rn "chamilo_core_resource_view" /var/www/html/chamilo/src 2>/dev/null';
exec($cmd, $out);
foreach ($out as $line) {
    echo $line . "\n";
}

$cmd2 = 'grep -rn "chamilo_core_resource_download" /var/www/html/chamilo/src 2>/dev/null';
exec($cmd2, $out2);
foreach ($out2 as $line) {
    echo $line . "\n";
}
