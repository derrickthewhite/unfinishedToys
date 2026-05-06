<?php

declare(strict_types=1);

require_once __DIR__ . '/db.php';
require_once __DIR__ . '/http.php';

function start_session_if_needed(): void
{
    if (session_status() === PHP_SESSION_ACTIVE) {
        return;
    }

    $cfg = config()['session'];
    if (($cfg['save_path'] ?? '') !== '') {
        if (!is_dir($cfg['save_path'])) {
            mkdir($cfg['save_path'], 0777, true);
        }
        session_save_path($cfg['save_path']);
    }

    session_name($cfg['name']);
    session_set_cookie_params([
        'lifetime' => 0,
        'path' => '/',
        'secure' => $cfg['secure'],
        'httponly' => $cfg['httponly'],
        'samesite' => $cfg['samesite'],
    ]);
    session_start();
}

function current_user(): ?array
{
    start_session_if_needed();

    $userId = $_SESSION['user_id'] ?? null;
    if (!is_int($userId) && !ctype_digit((string)$userId)) {
        return null;
    }

    $stmt = db()->prepare(
        'SELECT id, username, is_active, created_at, last_login_at '
        . 'FROM users WHERE id = :id LIMIT 1'
    );
    $stmt->execute(['id' => (int)$userId]);
    $user = $stmt->fetch();

    if (!$user || (int)$user['is_active'] !== 1) {
        return null;
    }

    return [
        'id' => (int)$user['id'],
        'username' => (string)$user['username'],
        'created_at' => (string)$user['created_at'],
        'last_login_at' => $user['last_login_at'] !== null ? (string)$user['last_login_at'] : null,
    ];
}

function set_user_session(int $userId): void
{
    start_session_if_needed();
    session_regenerate_id(true);
    $_SESSION['user_id'] = $userId;
}

function clear_user_session(): void
{
    start_session_if_needed();

    $_SESSION = [];
    if (ini_get('session.use_cookies')) {
        $params = session_get_cookie_params();
        setcookie(
            session_name(),
            '',
            time() - 42000,
            $params['path'],
            $params['domain'],
            (bool)$params['secure'],
            (bool)$params['httponly']
        );
    }

    session_destroy();
}