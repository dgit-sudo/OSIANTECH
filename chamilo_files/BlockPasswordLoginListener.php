<?php

declare(strict_types=1);

/*
 * BlockPasswordLoginListener.php
 *
 * Prevents learners from logging in directly via email/password on the
 * Chamilo login page.  Only the platform administrator (user-id 1) is
 * allowed through the standard json_login / form_login authenticator.
 *
 * All other users must authenticate via the Firebase SSO flow
 * (/firebase/sso/check).
 *
 * Deploy to:
 *   src/CoreBundle/EventListener/BlockPasswordLoginListener.php
 *
 * Register in:
 *   src/CoreBundle/Resources/config/listeners.yml
 */

namespace Chamilo\CoreBundle\EventListener;

use Chamilo\CoreBundle\Entity\User;
use Symfony\Component\EventDispatcher\EventSubscriberInterface;
use Symfony\Component\Security\Core\Exception\CustomUserMessageAuthenticationException;
use Symfony\Component\Security\Http\Event\CheckPassportEvent;

class BlockPasswordLoginListener implements EventSubscriberInterface
{
    /**
     * Run with a low priority so the passport credentials have already
     * been verified by Symfony's core listeners (priority 256/128).
     * We only need to gate *after* the password check succeeds.
     */
    public static function getSubscribedEvents(): array
    {
        return [
            CheckPassportEvent::class => ['onCheckPassport', -64],
        ];
    }

    public function onCheckPassport(CheckPassportEvent $event): void
    {
        $passport = $event->getPassport();
        $user     = $passport->getUser();

        // Safety: only act on Chamilo User entities.
        if (!$user instanceof User) {
            return;
        }

        // Allow the platform admin (id = 1) to use password login.
        if ($user->getId() === 1) {
            return;
        }

        /*
         * At this point a non-admin user has successfully provided valid
         * credentials via the standard login form.  We need to determine
         * whether this request came through the Firebase SSO authenticator
         * or the regular json_login / form_login authenticator.
         *
         * The FirebaseSsoAuthenticator sets a request attribute
         * '_firebase_sso' => true so that downstream listeners can
         * distinguish SSO logins from direct logins.
         *
         * If that attribute is missing, this is a direct password login
         * and we must block it.
         */
        $authenticator = $event->getAuthenticator();

        // If the authenticator is our FirebaseSsoAuthenticator, allow it.
        if ($authenticator instanceof \Chamilo\CoreBundle\Security\Authenticator\FirebaseSsoAuthenticator) {
            return;
        }

        // Block: non-admin user attempting direct password login.
        throw new CustomUserMessageAuthenticationException(
            'Direct login is disabled. Please sign in through the OSIAN dashboard at osian.tech.'
        );
    }
}
