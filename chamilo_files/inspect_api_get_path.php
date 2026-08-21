<?php
echo "=== 1. WHERE IS api_get_path DEFINED? ===\n";
$ref = new ReflectionFunction('api_get_path');
echo "File: " . $ref->getFileName() . ":" . $ref->getStartLine() . "\n";
$lines = file($ref->getFileName());
echo implode('', array_slice($lines, $ref->getStartLine() - 1, 40));

echo "\n=== 2. HOW IS $_configuration['root_web'] INITIALIZED? ===\n";
$files = [
    '/var/www/html/chamilo/public/main/inc/global.inc.php',
    '/var/www/html/chamilo/src/CoreBundle/Framework/Container.php'
];
foreach ($files as $f) {
    if (file_exists($f)) {
        $flines = file($f);
        foreach ($flines as $i => $l) {
            if (strpos($l, 'root_web') !== false || strpos($l, 'HTTP_X_FORWARDED') !== false || strpos($l, 'isSecure') !== false) {
                echo "$f:" . ($i+1) . " -> " . trim($l) . "\n";
            }
        }
    }
}
