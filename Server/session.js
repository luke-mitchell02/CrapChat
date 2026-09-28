import { database } from './db.js';

// Returns the session row (plus username) for the request's session cookie, or null if there isn't a valid one.
// Shared by the HTTP server (page redirects) and the WebSocket server (connection auth).
export function validate_session(req) {
    if (!req.headers?.cookie) return null;
    const cookie_array = req.headers.cookie.split(';');

    for (const element of cookie_array) {
        if (element.trim().startsWith('session=')) {
            const session_token = element.trim().split('session=')[1];
            const stored_session = database.prepare("SELECT s.*, u.username FROM sessions s JOIN users u ON `s`.`user_id` = `u`.`user_id` WHERE `s`.`token` = ? AND `s`.`expires` > CURRENT_TIMESTAMP").get(session_token);
            if (stored_session) return stored_session;
        }
    }
    return null;
}
