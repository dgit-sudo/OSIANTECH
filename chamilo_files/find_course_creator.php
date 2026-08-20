<?php
$dirs = ['/var/log/apache2', '/var/log/nginx', '/var/log', '/var/www/html/chamilo/var/logs'];
echo "=== LOG FILES FOUND ===\n";
foreach ($dirs as $d) {
    if (is_dir($d)) {
        $files = scandir($d);
        foreach ($files as $f) {
            if ($f !== '.' && $f !== '..') {
                echo "$d/$f (" . filesize("$d/$f") . " bytes)\n";
            }
        }
    }
}

echo "\n=== SEARCHING FOR COURSE CREATION SERVICES IN CHAMILO ===\n";
$cmd = 'grep -rn "function createCourse\|function create_course\|class CourseManager\|class CourseFactory" /var/www/html/chamilo/src/ /var/www/html/chamilo/main/ 2>/dev/null | head -n 25';
exec($cmd, $output);
foreach ($output as $line) {
    echo $line . "\n";
}
