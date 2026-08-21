<?php
require_once '/var/www/html/chamilo/vendor/autoload.php';

echo "=== INSPECTING CDocument.php ===\n";
$docEntity = '/var/www/html/chamilo/src/CourseBundle/Entity/CDocument.php';
if (file_exists($docEntity)) {
    echo file_get_contents($docEntity);
} else {
    echo "CDocument.php not found.\n";
}

echo "\n=== INSPECTING document.php ===\n";
$docScript = '/var/www/html/chamilo/public/main/document/document.php';
if (file_exists($docScript)) {
    $lines = file($docScript);
    echo implode('', array_slice($lines, 0, 100));
}
