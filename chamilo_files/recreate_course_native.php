<?php
require_once '/var/www/html/chamilo/vendor/autoload.php';

use Chamilo\Kernel;
use Symfony\Component\Dotenv\Dotenv;
use Chamilo\CoreBundle\Helpers\CourseHelper;
use Chamilo\CoreBundle\Repository\Node\CourseRepository;
use Chamilo\CoreBundle\Repository\Node\UserRepository;
use Doctrine\ORM\EntityManagerInterface;

$dotenv = new Dotenv();
if (file_exists('/var/www/html/chamilo/.env')) {
    $dotenv->load('/var/www/html/chamilo/.env');
}
if (file_exists('/var/www/html/chamilo/.env.local')) {
    $dotenv->load('/var/www/html/chamilo/.env.local');
}

$kernel = new Kernel('prod', false);
$kernel->boot();
$container = $kernel->getContainer();

/** @var CourseHelper $courseHelper */
$courseHelper = $container->get(CourseHelper::class);
/** @var CourseRepository $courseRepo */
$courseRepo = $container->get(CourseRepository::class);
/** @var UserRepository $userRepo */
$userRepo = $container->get(UserRepository::class);
/** @var EntityManagerInterface $em */
$em = $container->get('doctrine.orm.entity_manager');

echo "✅ Booted Chamilo Kernel and retrieved CourseHelper service!\n";

// Let's delete any broken legacy course record for OSIAN_1 first
$conn = $em->getConnection();
$existing = $conn->fetchAssociative("SELECT id FROM course WHERE code = 'OSIAN_1'");
if ($existing && !empty($existing['id'])) {
    $oldId = (int) $existing['id'];
    echo "Cleaning up old course #$oldId...\n";
    $conn->executeStatement("DELETE FROM course_rel_user WHERE c_id = ?", [$oldId]);
    $conn->executeStatement("DELETE FROM access_url_rel_course WHERE c_id = ?", [$oldId]);
    $conn->executeStatement("DELETE FROM c_tool WHERE c_id = ?", [$oldId]);
    $conn->executeStatement("DELETE FROM course WHERE id = ?", [$oldId]);
    echo "Old course record cleaned.\n";
}

// Now create course natively using CourseHelper
echo "Creating course 'Oracle Admin I' (OSIAN_1) natively via CourseHelper...\n";
try {
    $course = $courseHelper->createCourse([
        'title' => 'Oracle Admin I',
        'wanted_code' => 'OSIAN_1',
        'exemplary_content' => true,
        'visibility' => 3,
        'course_language' => 'english',
    ]);

    if ($course) {
        $cId = $course->getId();
        echo "🎉 Native Course Created Successfully! ID: $cId | Title: " . $course->getTitle() . "\n";

        // Enroll all recent active users
        $users = $userRepo->findAll();
        foreach ($users as $u) {
            if ($u->getEmail() !== 'admin@osian.tech') {
                $uId = $u->getId();
                $conn->executeStatement(
                    "INSERT INTO course_rel_user (c_id, user_id, relation_type, status, progress)
                     VALUES (?, ?, 0, 5, 0)
                     ON DUPLICATE KEY UPDATE status = 5",
                    [$cId, $uId]
                );
                echo "✅ Enrolled user #" . $uId . " (" . $u->getEmail() . ") into course #$cId as Student!\n";
            }
        }
    } else {
        echo "❌ CourseHelper returned null.\n";
    }
} catch (Exception $e) {
    echo "❌ Exception creating course: " . $e->getMessage() . "\n" . $e->getTraceAsString() . "\n";
}
