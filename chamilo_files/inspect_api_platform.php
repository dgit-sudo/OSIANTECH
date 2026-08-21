<?php
$file = '/var/www/html/chamilo/config/packages/api_platform.yaml';
if (file_exists($file)) {
    echo file_get_contents($file);
} else {
    echo "api_platform.yaml not found.\n";
}
