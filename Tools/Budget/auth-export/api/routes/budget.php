<?php

declare(strict_types=1);

require_once __DIR__ . '/../lib/auth.php';

function handle_budget_route(string $method, array $segments): void
{
    if (count($segments) !== 2 || $segments[0] !== 'budget' || $segments[1] !== 'data') {
        error_response('Not found.', 404);
    }

    if ($method === 'GET') {
        budget_get_data();
        return;
    }

    if ($method === 'POST') {
        budget_save_data();
        return;
    }

    error_response('Method not allowed.', 405);
}

function require_authenticated_user(): array
{
    require_https_request();

    $user = current_user();
    if ($user === null) {
        error_response('Unauthorized.', 401, [
            'stage' => 'budget.current_user',
        ]);
    }

    return $user;
}

function budget_get_data(): void
{
    $user = require_authenticated_user();

    $stmt = db()->prepare(
        'SELECT budget_json, updated_at '
        . 'FROM user_budget_data WHERE user_id = :user_id LIMIT 1'
    );
    $stmt->execute(['user_id' => (int)$user['id']]);
    $row = $stmt->fetch();

    success_response([
        'budget' => $row ? json_decode((string)$row['budget_json'], true) : [],
        'updated_at' => $row ? (string)$row['updated_at'] : null,
        'user' => $user,
    ]);
}

function budget_save_data(): void
{
    $user = require_authenticated_user();
    $body = json_input();
    $budget = $body['budget'] ?? null;

    if (!is_array($budget)) {
        error_response('Budget payload must be an array.', 422, [
            'stage' => 'budget.save.payload',
        ]);
    }

    $encodedBudget = json_encode($budget);
    if (!is_string($encodedBudget)) {
        error_response('Budget payload could not be encoded.', 422, [
            'stage' => 'budget.save.encode',
        ]);
    }

    $stmt = db()->prepare(
        'INSERT INTO user_budget_data (user_id, budget_json) '
        . 'VALUES (:user_id, :budget_json) '
        . 'ON DUPLICATE KEY UPDATE budget_json = VALUES(budget_json), updated_at = CURRENT_TIMESTAMP'
    );
    $stmt->execute([
        'user_id' => (int)$user['id'],
        'budget_json' => $encodedBudget,
    ]);

    success_response([
        'message' => 'Budget saved.',
        'user' => $user,
    ]);
}