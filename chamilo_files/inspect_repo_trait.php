<?php
$f = '/var/www/html/chamilo/src/CoreBundle/Traits/Repository/RepositoryQueryBuilderTrait.php';
if (file_exists($f)) {
    echo "=== RepositoryQueryBuilderTrait.php ===\n";
    $lines = file($f);
    echo implode('', array_slice($lines, 0, 100));
}
