<?php
require_once '/var/www/html/chamilo/vendor/autoload.php';
require_once '/var/www/html/chamilo/public/main/inc/global.inc.php';

use Chamilo\CoreBundle\Framework\Container;

$em = \Database::getManager();
$course = $em->getRepository(\Chamilo\CoreBundle\Entity\Course::class)->find(6);

echo "Course 6 tools count: " . $course->getTools()->count() . "\n";

foreach ($course->getTools() as $tool) {
    $title = $tool->getTitle();
    $node = $tool->getResourceNode();
    $link = $node ? $node->getResourceLinks()->first() : null;
    $vis = $link ? $link->getVisibility() : 'NO LINK';
    echo "  - Tool: {$title} | Node ID: " . ($node ? $node->getId() : "NULL") . " | Visibility: {$vis}\n";
}
