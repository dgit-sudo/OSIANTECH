<?php
require_once '/var/www/html/chamilo/vendor/autoload.php';

use App\Kernel;
use Symfony\Component\Dotenv\Dotenv;
use Symfony\Component\HttpFoundation\Request;
use Chamilo\CoreBundle\Entity\Course;
use Chamilo\CoreBundle\Entity\User;
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

/** @var EntityManagerInterface $em */
$em = $container->get('doctrine.orm.entity_manager');
/** @var CourseRepository $courseRepo */
$courseRepo = $container->get(CourseRepository::class);
/** @var UserRepository $userRepo */
$userRepo = $container->get(UserRepository::class);

echo "✅ Booted Symfony Kernel and retrieved CourseRepository & EntityManager!\n";

// Let's inspect Course entity methods
$courseMethods = get_class_methods(Course::class);
echo "Course entity methods found: " . count($courseMethods) . "\n";

// Check course repository methods
$repoMethods = get_class_methods($courseRepo);
echo "CourseRepository methods: " . implode(', ', array_slice($repoMethods, 0, 15)) . "\n";

// Let's check existing courses
$courses = $courseRepo->findAll();
echo "Total courses in DB: " . count($courses) . "\n";

foreach ($courses as $c) {
    echo "Course ID: " . $c->getId() . " | Code: " . $c->getCode() . " | Title: " . $c->getTitle() . " | ResourceNode: " . ($c->getResourceNode() ? $c->getResourceNode()->getId() : 'NULL') . "\n";
}
