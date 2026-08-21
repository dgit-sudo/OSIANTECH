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

    $resourceBase = '/var/www/html/chamilo/var/upload/resource';
    if (!is_dir($resourceBase)) {
        @mkdir($resourceBase, 0777, true);
    }

    // Set sample doc 7341
    $docNodeId = 7341;
    $fn = md5('res-' . $docNodeId) . '.html';
    $d1 = substr($fn, 0, 1);
    $d2 = substr($fn, 1, 1);
    $d3 = substr($fn, 2, 1);

    $subDir = "{$resourceBase}/{$d1}/{$d2}/{$d3}";
    if (!is_dir($subDir)) {
        @mkdir($subDir, 0777, true);
    }

    $sampleHtml = "<h1>Oracle Admin I - Official Learning Guide</h1><p>Welcome to Oracle Admin I! This is your live curriculum.</p>";
    file_put_contents("{$subDir}/{$fn}", $sampleHtml);
    file_put_contents("{$resourceBase}/{$fn}", $sampleHtml);
    @chmod("{$subDir}/{$fn}", 0777);
    @chmod("{$resourceBase}/{$fn}", 0777);

    // Update resource_file: title = filename, original_name = display name, access_url_id = NULL
    $pdo->prepare("
        UPDATE resource_file 
        SET title = ?, original_name = 'Oracle Admin I - Learning Guide.html', access_url_id = NULL, size = ?
        WHERE resource_node_id = ?
    ")->execute([$fn, strlen($sampleHtml), $docNodeId]);

    echo "✅ Updated DB record for node #{$docNodeId} with title = '{$fn}'\n";

    // Test with Symfony
    $kernelClass = class_exists('\App\Kernel') ? '\App\Kernel' : (class_exists('\Chamilo\Kernel') ? '\Chamilo\Kernel' : null);
    
    if ($kernelClass) {
        $kernel = new $kernelClass('prod', false);
        $kernel->boot();
        $container = $kernel->getContainer();

        $em = $container->get('doctrine.orm.entity_manager');
        $resFileHelper = $container->get(\Chamilo\CoreBundle\Helpers\ResourceFileHelper::class);
        $nodeRepo = $container->get(\Chamilo\CoreBundle\Repository\ResourceNodeRepository::class);

        $node = $em->getRepository(\Chamilo\CoreBundle\Entity\ResourceNode::class)->find($docNodeId);

        if ($node) {
            $resFile = $resFileHelper->resolveResourceFileByAccessUrl($node);
            if ($resFile) {
                $fileName = $nodeRepo->getFilename($resFile);
                echo "Resolved Flysystem FileName: '$fileName'\n";
                $content = $nodeRepo->getResourceNodeFileContent($node, $resFile);
                echo "🎉 SUCCESS: File Content Read Successfully! (" . strlen($content) . " bytes)\n";
                echo "Content preview: " . substr(strip_tags($content), 0, 100) . "...\n";
            }
        }
    }

} catch (Exception $e) {
    echo "❌ Error: " . $e->getMessage() . "\n";
}
