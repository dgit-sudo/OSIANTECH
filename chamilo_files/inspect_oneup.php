<?php
$f = '/var/www/html/chamilo/config/packages/oneup_flysystem.yaml';
if (file_exists($f)) {
    echo file_get_contents($f);
} else {
    $cmd = 'find /var/www/html/chamilo/config -name "*flysystem*" 2>/dev/null';
    exec($cmd, $out);
    foreach ($out as $line) {
        echo $line . ":\n" . file_get_contents($line) . "\n---\n";
    }
}
