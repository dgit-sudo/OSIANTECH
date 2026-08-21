<?php
require_once '/var/www/html/chamilo/vendor/autoload.php';
require_once '/var/www/html/chamilo/public/main/inc/global.inc.php';
require_once '/var/www/html/chamilo/public/main/lp/learnpath.class.php';

echo "=== getListArrayToc() in learnpath.class.php ===\n";
$ref = new ReflectionMethod('learnpath', 'getListArrayToc');
echo "File: " . $ref->getFileName() . ":" . $ref->getStartLine() . "\n";
$lines = file($ref->getFileName());
echo implode('', array_slice($lines, $ref->getStartLine() - 1, 60));
