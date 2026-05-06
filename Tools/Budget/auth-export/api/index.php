<?php

declare(strict_types=1);

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/lib/http.php';
require_once __DIR__ . '/routes/auth.php';

handle_cors_and_json_headers();

try {
    $method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
    $segments = path_segments();

    if (empty($segments)) {
        success_response(['service' => 'auth-export-api', 'version' => 1]);
    }

    if ($segments[0] === 'auth') {
        handle_auth_route($method, $segments);
    }

    error_response('Not found.', 404);
} catch (Throwable $ex) {
    error_response('Server error.', 500, [
        'detail' => getenv('AUTH_EXPORT_DEBUG') === '1' ? $ex->getMessage() : null,
    ]);
}