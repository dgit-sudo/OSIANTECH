<?php
@session_start();
require_once '/var/www/html/chamilo/vendor/autoload.php';
require_once '/var/www/html/chamilo/public/main/inc/global.inc.php';
require_once '/var/www/html/chamilo/public/main/lp/learnpath.class.php';
require_once '/var/www/html/chamilo/public/main/lp/learnpathItem.class.php';

use Chamilo\CoreBundle\Framework\Container;

$lpRepo = Container::getLpRepository();

echo "=== SYSTEM-WIDE VERIFICATION ACROSS SAMPLE COURSES ===\n";

$sampleCourseIds = [6, 12, 45, 100, 180, 240];

foreach ($sampleCourseIds as $cid) {
    $courseInfo = api_get_course_info_by_id($cid);
    if (empty($courseInfo)) {
        continue;
    }
    
    $courseTitle = $courseInfo['title'];
    $lps = $lpRepo->findAllByCourse($cid);
    
    echo "--------------------------------------------------------\n";
    echo "Course $cid: $courseTitle\n";
    echo "  - LP Count: " . count($lps) . " (Expected: 1)\n";
    
    if (!empty($lps)) {
        $lpEntity = $lps[0];
        $oLP = new learnpath($lpEntity, $courseInfo, 1);
        $toc = $oLP->getListArrayToc();
        echo "  - Sidebar TOC Modules Count: " . count($toc) . " (Expected: 5)\n";
        foreach ($toc as $m) {
            echo "      • [{$m['iid']}] {$m['title']}\n";
        }
    }
}
