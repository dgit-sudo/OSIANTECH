<?php
$f = '/var/www/html/chamilo/public/main/lp/learnpathItem.class.php';
if (file_exists($f)) {
    $lines = file($f);
    foreach ($lines as $n => $l) {
        if (preg_match('/function (get_src|get_url|get_view|get_file_path|get_description|get_type)/', $l)) {
            echo "Line $n: " . implode('', array_slice($lines, $n, 30)) . "
----------------
";
        }
    }
}
