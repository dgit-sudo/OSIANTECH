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

$pdo = new PDO("mysql:host=$host;port=$port;dbname=$db;charset=utf8mb4", $user, $pass, [
    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION
]);

echo "=== FIXING RESOURCE TYPE IDS ACROSS ALL 248 COURSES ===\n";

// 1. Fix all Course Descriptions -> type 13 (course_descriptions)
$pdo->exec("
    UPDATE resource_node rn
    JOIN c_course_description cd ON cd.resource_node_id = rn.id
    SET rn.resource_type_id = 13
");
echo "✅ Updated resource_type_id = 13 for all c_course_description nodes!\n";

// 2. Fix all Learning Paths -> type 39 (lps)
$pdo->exec("
    UPDATE resource_node rn
    JOIN c_lp lp ON lp.resource_node_id = rn.id
    SET rn.resource_type_id = 39
");
echo "✅ Updated resource_type_id = 39 for all c_lp nodes!\n";

// 3. Fix all Documents -> type 17 (files)
$pdo->exec("
    UPDATE resource_node rn
    JOIN c_document cd ON cd.resource_node_id = rn.id
    SET rn.resource_type_id = 17
");
echo "✅ Updated resource_type_id = 17 for all c_document nodes!\n";

// Now test with Doctrine
$kernelClass = class_exists('\App\Kernel') ? '\App\Kernel' : (class_exists('\Chamilo\Kernel') ? '\Chamilo\Kernel' : null);
$kernel = new $kernelClass('prod', false);
$kernel->boot();
$container = $kernel->getContainer();

$em = $container->get('doctrine.orm.entity_manager');
$courseRepo = $em->getRepository(\Chamilo\CoreBundle\Entity\Course::class);
$course = $courseRepo->find(6);

echo "\n=== RETESTING DOCTRINE QUERIES FOR COURSE 6 ===\n";

$cdRepo = $container->get(\Chamilo\CourseBundle\Repository\CCourseDescriptionRepository::class);
$cdResults = $cdRepo->getResourcesByCourse($course)->getQuery()->getResult();
echo "Found " . count($cdResults) . " Course Descriptions:\n";
foreach ($cdResults as $cd) {
    echo "  🎉 #" . $cd->getIid() . ": " . $cd->getTitle() . " (Content: " . substr(strip_tags($cd->getContent()), 0, 60) . "...)\n";
}

$lpRepo = $container->get(\Chamilo\CourseBundle\Repository\CLpRepository::class);
$lpResults = $lpRepo->findAllByCourse($course)->getQuery()->getResult();
echo "\nFound " . count($lpResults) . " Learning Paths:\n";
foreach ($lpResults as $lp) {
    echo "  🎉 #" . $lp->getIid() . ": " . $lp->getTitle() . " (Items: " . $lp->getItems()->count() . ")\n";
}

$docRepo = $container->get(\Chamilo\CourseBundle\Repository\CDocumentRepository::class);
$docResults = $docRepo->getResourcesByCourse($course)->getQuery()->getResult();
echo "\nFound " . count($docResults) . " Documents:\n";
foreach ($docResults as $doc) {
    echo "  🎉 #" . $doc->getIid() . ": " . $doc->getTitle() . " (Filetype: " . $doc->getFiletype() . ")\n";
}
