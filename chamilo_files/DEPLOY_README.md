# Chamilo LMS – Block Direct Password Login

## Files

| File | Deploy to (inside chamilo2_app container) |
|------|------------------------------------------|
| `BlockPasswordLoginListener.php` | `src/CoreBundle/EventListener/BlockPasswordLoginListener.php` |

## Registration

Add the following to `src/CoreBundle/Resources/config/listeners.yml` (see `listeners_yml_snippet.yml`):

```yaml
  Chamilo\CoreBundle\EventListener\BlockPasswordLoginListener:
    tags:
      - { name: kernel.event_subscriber }
```

## Deployment Steps

```bash
# 1. Copy the file into the container
docker cp chamilo_files/BlockPasswordLoginListener.php chamilo2_app:/var/www/chamilo/src/CoreBundle/EventListener/BlockPasswordLoginListener.php

# 2. Edit listeners.yml inside the container to add the registration
docker exec -it chamilo2_app nano /var/www/chamilo/src/CoreBundle/Resources/config/listeners.yml
# Add the snippet from listeners_yml_snippet.yml

# 3. Clear cache (MUST run as www-data)
docker exec -u www-data chamilo2_app php /var/www/chamilo/bin/console cache:clear --env=prod

# 4. If cache:clear fails with permission errors, fix ownership first:
docker exec chamilo2_app chown -R www-data:www-data /var/www/chamilo/var/cache
docker exec -u www-data chamilo2_app php /var/www/chamilo/bin/console cache:clear --env=prod
```

## Behavior

- **Admin (user ID 1)**: Can still log in with email/password ✅
- **All other users**: Blocked from direct login, shown message: *"Direct login is disabled. Please sign in through the OSIAN dashboard at osian.tech."* ❌➜ SSO
- **Firebase SSO**: Works for everyone as before ✅
