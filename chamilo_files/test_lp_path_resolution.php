<?php
require_once '/var/www/html/chamilo/public/main/inc/global.inc.php';

echo "SYS_COURSE_PATH: " . api_get_path(SYS_COURSE_PATH) . "\n";
echo "WEB_COURSE_PATH: " . api_get_path(WEB_COURSE_PATH) . "\n";
echo "SYS_APP_PATH:    " . api_get_path(SYS_APP_PATH) . "\n";
echo "Course directory for Course 6: " . api_get_course_path(6) . "\n";

$courseDir = api_get_path(SYS_COURSE_PATH) . api_get_course_path(6);
echo "Full Course Dir: $courseDir\n";
echo "Exists? " . (is_dir($courseDir) ? 'YES' : 'NO') . "\n";
