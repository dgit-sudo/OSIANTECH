<?php
require_once '/var/www/html/chamilo/vendor/autoload.php';
require_once '/var/www/html/chamilo/public/main/inc/global.inc.php';

echo "=== 1. WHERE IS api_get_path DEFINED? ===\n";
$ref = new ReflectionFunction('api_get_path');
echo "File: " . $ref->getFileName() . ":" . $ref->getStartLine() . "\n";
$lines = file($ref->getFileName());
echo implode('', array_slice($lines, $ref->getStartLine() - 1, 40));

echo "\n=== 2. HOW IS root_web INITIALIZED IN GLOBAL? ===\n";
$flines = file('/var/www/html/chamilo/public/main/inc/global.inc.php');
foreach ($flines as $i => $l) {
    if (strpos($l, 'root_web') !== false || strpos($l, 'HTTP_X_FORWARDED') !== false || strpos($l, 'isSecure') !== false || strpos($l, 'HTTPS') !== false) {
        echo ($i+1) . " -> " . trim($l) . "\n";
    }
}
