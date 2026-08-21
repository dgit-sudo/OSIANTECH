<?php
$cmd = 'grep -rn "function addVisibilityQueryBuilder" /var/www/html/chamilo/src 2>/dev/null';
exec($cmd, $out);
foreach ($out as $line) {
    echo $line . "\n";
}

$cmd2 = 'grep -rn "function addCourseSessionGroupQueryBuilder" /var/www/html/chamilo/src 2>/dev/null';
exec($cmd2, $out2);
foreach ($out2 as $line) {
    echo $line . "\n";
}
