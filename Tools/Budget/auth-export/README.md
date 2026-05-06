# Auth Export

This folder contains a standalone export of the SRP-based account creation and login system from this repository.

Included pieces:
- `sql/001_auth_schema.mysql.sql`: minimal MySQL schema for authentication only.
- `api/`: auth-only PHP API with SRP signup, signin, signout, and current-user endpoints.
- `js/`: browser-side SRP client, auth API wrapper, and a small demo UI controller.
- `index.html`: minimal page for account creation and login.

What is included:
- Users table
- App settings table for the signup invite key
- Session-backed login
- SRP password flow so plain passwords are never stored

What is intentionally not included:
- Games
- Messages
- Actions
- Icons
- Any gameplay data

## Setup

1. Create a new database and run `sql/001_auth_schema.mysql.sql` against it.
2. Copy `api/config.local.php.example` to `api/config.local.php`.
3. Set the DB host, DB name, DB user, and DB password in `api/config.local.php`.
4. Set a real invite key in the SQL seed row or update `app_settings.setting_value` for `signup_invite_key` after import.
5. Serve `api/` with PHP and `index.html` from the same site.
6. Make sure the PHP `gmp` extension is enabled.

## Keys And Secrets

The exported auth system uses these configurable values:
- DB user and DB password: set in `api/config.local.php`
- Session cookie name: set in `api/config.local.php`
- Signup invite key: stored in `app_settings` under `signup_invite_key`

There is no separate long-lived SRP server secret to configure. The SRP server secret is generated per signin challenge and stored in the server session until the login finishes.

## Endpoints

- `POST /auth/signup`
- `POST /auth/signin/start`
- `POST /auth/signin/finish`
- `POST /auth/signout`
- `GET /auth/me`
- `GET /auth/test`

## Notes

- If you are testing over plain HTTP locally, set `auth.enforce_https` to `false` in `api/config.local.php`.
- The frontend JS expects the API to be available at `./api` relative to `index.html`.