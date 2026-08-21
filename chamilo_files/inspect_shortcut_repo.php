<?php
require_once '/var/www/html/chamilo/vendor/autoload.php';

use Symfony\Component\Dotenv\Dotenv;

$dotenv = new Dotenv();
if (file_exists('/var/www/html/chamilo/.env')) {
    $dotenv->load('/var/www/html/chamilo/.env');
}
if (file_exists('/var/www/html/chamilo/.env.local')) {
    $dotenv->load('/var/www/html/chamilo/.env.local');
}

echo "=== LOCATING CShortcutRepository ===\n";
$cmd = 'find /var/www/html/chamilo/src -name "*Shortcut*" 2>/dev/null';
exec($cmd, $output);
foreach ($output as $line) {
    echo $line . "\n";
}

$repoFile = '/var/www/html/chamilo/src/CoreBundle/Repository/Node/CShortcutRepository.php';
if (!file_exists($repoFile)) {
    $cmd2 = 'find /var/www/html/chamilo/src -name "CShortcutRepository.php" 2>/dev/null';
    exec($cmd2, $out2);
    $repoFile = $out2[0] ?? '';
}

if ($repoFile && file_exists($repoFile)) {
    echo "\n=== CShortcutRepository.php ===\n";
    echo file_get_contents($repoFile);
}
