<?php
$f1 = '/var/www/html/chamilo/src/CoreBundle/Controller/Api/DownloadAllDocumentsAction.php';
$f2 = '/var/www/html/chamilo/src/CoreBundle/Controller/Api/DownloadSelectedDocumentsAction.php';

if (file_exists($f1)) {
    echo "=== DownloadAllDocumentsAction.php ===\n";
    echo file_get_contents($f1);
} else {
    echo "DownloadAllDocumentsAction.php not found.\n";
}

if (file_exists($f2)) {
    echo "\n=== DownloadSelectedDocumentsAction.php ===\n";
    echo file_get_contents($f2);
}
