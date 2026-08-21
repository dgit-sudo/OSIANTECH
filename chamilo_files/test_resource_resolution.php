<?php
require_once '/var/www/html/chamilo/vendor/autoload.php';
if (file_exists('/var/www/html/chamilo/src/Kernel.php')) {
    require_once '/var/www/html/chamilo/src/Kernel.php';
}

use Symfony\Component\Dotenv\Dotenv;

$dotenv = new Dotenv();
if (file_exists('/var/www/html/chamilo/.env')) {
    $dotenv->load('/var/www/html/chamilo/.env');
}
if (file_exists('/var/www/html/chamilo/.env.local')) {
    $dotenv->load('/var/www/html/chamilo/.env.local');
}

$dbUrl = $_ENV['DATABASE_URL'] ?? getenv('DATABASE_URL') ?? '';
$parts = parse_url($dbUrl);
$host = $parts['host'] ?? '127.0.0.1';
$port = $parts['port'] ?? 3306;
$user = $parts['user'] ?? 'root';
$pass = $parts['pass'] ?? '';
$db   = ltrim($parts['path'] ?? '', '/');

try {
    $pdo = new PDO("mysql:host=$host;port=$port;dbname=$db;charset=utf8mb4", $user, $pass, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION
    ]);

    // 1. Update resource_file access_url_id to NULL
    $pdo->exec("UPDATE resource_file SET access_url_id = NULL");
    echo "✅ Updated all resource_file records: access_url_id = NULL\n";

    // 2. Check ResourceFile entity in Symfony
    $kernelClass = class_exists('\App\Kernel') ? '\App\Kernel' : (class_exists('\Chamilo\Kernel') ? '\Chamilo\Kernel' : null);
    
    if ($kernelClass) {
        $kernel = new $kernelClass('prod', false);
        $kernel->boot();
        $container = $kernel->getContainer();

        $em = $container->get('doctrine.orm.entity_manager');
        $resFileHelper = $container->get(\Chamilo\CoreBundle\Helpers\ResourceFileHelper::class);
        $nodeRepo = $container->get(\Chamilo\CoreBundle\Repository\ResourceNodeRepository::class);

        $node = $em->getRepository(\Chamilo\CoreBundle\Entity\ResourceNode::class)->find(7341);
        if (!$node) {
            $node = $em->getRepository(\Chamilo\CoreBundle\Entity\ResourceNode::class)->findOneBy(['resourceType' => 13]);
        }

        if ($node) {
            echo "Found ResourceNode #{$node->getId()} ('{$node->getTitle()}')\n";
            echo "hasResourceFile: " . ($node->hasResourceFile() ? 'YES' : 'NO') . "\n";
            echo "ResourceFiles count: " . $node->getResourceFiles()->count() . "\n";

            $resFile = $resFileHelper->resolveResourceFileByAccessUrl($node);
            if ($resFile) {
                echo "✅ resolveResourceFileByAccessUrl SUCCESS! Found ResourceFile #{$resFile->getId()} (Title: '{$resFile->getTitle()}', OriginalName: '{$resFile->getOriginalName()}')\n";
                try {
                    $fileName = $nodeRepo->getFilename($resFile);
                    echo "Resolved Flysystem FileName: '$fileName'\n";
                    $content = $nodeRepo->getResourceNodeFileContent($node, $resFile);
                    echo "✅ File Content Length: " . strlen($content) . " bytes\n";
                    echo "Preview: " . substr(strip_tags($content), 0, 100) . "...\n";
                } catch (\Throwable $e) {
                    echo "❌ File read error: " . $e->getMessage() . "\n";
                }
            } else {
                echo "❌ resolveResourceFileByAccessUrl returned NULL\n";
            }
        }
    } else {
        echo "Kernel class not found directly, checking DB state:\n";
        $stmt = $pdo->query("SELECT id, resource_node_id, title, original_name, access_url_id FROM resource_file LIMIT 5");
        print_r($stmt->fetchAll(PDO::FETCH_ASSOC));
    }

} catch (Exception $e) {
    echo "❌ Error: " . $e->getMessage() . "\n";
}
