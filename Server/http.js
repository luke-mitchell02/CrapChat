import http from 'http';
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { database } from './db.js';
import { validate_session } from './session.js';
import { promisify } from 'node:util';
import { scrypt, randomBytes } from 'node:crypto';

const scryptAsync = promisify(scrypt);
const REGISTER_QUERY = "INSERT INTO `users` (username, password, salt) VALUES (?, ?, ?)";

// Static files are served from Client/, found relative to this file rather than where node was started from
const CLIENT_DIR = path.join(import.meta.dirname, '..', 'Client');
const CONTENT_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.json': 'application/json',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.ico': 'image/x-icon',
};


export async function hash_password(password, salt) {
    // 64 is a 'keylen' which is required and is the output length
    const result = await scryptAsync(password, salt, 64);
    return result.toString('hex');
} 

async function register_user(username, password) {
    // To string hex because the output is random bytes and by default utf8 will corrupt them
    const salt =  randomBytes(32).toString('hex');
    const hashed_password = await hash_password(password, salt);
    database.prepare(REGISTER_QUERY).run(username, hashed_password, salt);
}

function send_json_response(res, status, type, message, payload) {
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify( { type, message, payload }));
}

function redirect(res, location) {
    res.writeHead(302, { 'Location': location });
    res.end();
}

async function serve_static(req, res) {
    // new URL() strips the query string and resolves any /../ segments in the path
    let pathname;
    try {
        pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    } catch (error) {
        res.writeHead(400);  // Malformed URL, e.g. a stray % that isn't a valid escape
        return res.end();
    }
    if (pathname === '/') pathname = '/index.html';

    // Logged-in users skip the login page, logged-out users can't open the chat
    if (pathname === '/index.html' && validate_session(req)) return redirect(res, '/chat.html');
    if (pathname === '/chat.html' && !validate_session(req)) return redirect(res, '/');

    // Path traversal guard: after joining, the file must still be inside Client/
    // (decoding above means something like /%2e%2e/.env would otherwise escape)
    const file_path = path.join(CLIENT_DIR, pathname);
    if (!file_path.startsWith(CLIENT_DIR + path.sep)) {
        res.writeHead(404);
        return res.end();
    }

    try {
        const file = await readFile(file_path);
        res.writeHead(200, {
            'Content-Type': CONTENT_TYPES[path.extname(file_path)] ?? 'application/octet-stream',
            'Cache-Control': 'no-cache',  // Browsers keep a copy but check it's current, so updates show up straight away
        });
        res.end(file);
    } catch (error) {
        // Missing file, or a folder rather than a file
        if (error.code === 'ENOENT' || error.code === 'EISDIR') {
            res.writeHead(404);
            return res.end();
        }
        throw error;
    }
}

export const httpserver = http.createServer((req, res) => {
    if (req.method === 'POST') {
        // Body is sent as a 'stream' of bytes, so you need to accumulate them all before processing.
        let body = '';
        req.on('data', chunk => {
            body += chunk;  // Automatically turns to a string
        });

        // Once done accumulating, process it
        req.on('end', async () => {
            // The try/catch has to live inside this callback: it runs after the outer handler has returned
            try {
                let parsedData;
                try {
                    parsedData = body !== '' ? (JSON.parse(body) ?? { }) : { };
                } catch (error) {
                    return send_json_response(res, 400, 'error', 'request body is malformed', null);
                }
                
                // Precondition check that username and password are sent
                if (['/login', '/register'].includes(req.url)) {
                    for (const property of ['username', 'password']) {
                        if (!Object.hasOwn(parsedData, property)) {
                            return send_json_response(res, 400, 'error', 'required fields are missing', null);
                        }
                    }

                    if (req.url === '/login') {
                        const stored_user = database.prepare("SELECT * FROM users WHERE username = ?").get(parsedData.username);
                        if (!stored_user) return send_json_response(res, 401, 'error', 'invalid username or password', null);
                        
                        // Successful User found - compare password
                        const sent_pwd_hashed = await hash_password(parsedData.password, stored_user.salt);
                        if (sent_pwd_hashed !== stored_user.password) return send_json_response(res, 401, 'error', 'invalid username or password', null);
                        
                        // Successful match - create session
                        const token =  randomBytes(64).toString('hex');
                        const expiry = new Date(Date.now() + 30 * 86400000);  // 30 Day Expiry
                        database.prepare("INSERT INTO sessions (user_id, token, expires) VALUES (?, ?, ?)").run(stored_user.user_id, token, expiry.toISOString());
                        
                        // Respond
                        res.setHeader('Set-Cookie', `session=${token}; HttpOnly; Path=/; Max-Age=${30*86400}`);
                        return send_json_response(res, 200, 'success', 'login successful', null);
                    } else if (req.url === '/register') {
                        if (parsedData?.authkey === process.env.ADMIN_AUTHKEY) {
                            await register_user(parsedData.username, parsedData.password);
                            return send_json_response(res, 200, 'success', 'User registered successfully', null);
                        } else {
                            return send_json_response(res, 401, 'error', 'A valid authkey is required', null);
                        }
                    }
                }
                
                // Only respond once done receiving data
                if (req.url === '/logout') {
                    if (!req.headers.cookie) return send_json_response(res, 200, 'success', 'logout successful', null);
                    const cookie_array = req.headers.cookie.split(';');
                    
                    for (const element of cookie_array) {
                        if (element.trim().startsWith('session=')) {
                            const session_token = element.trim().split('session=')[1];
                            database.prepare("DELETE FROM sessions WHERE `token` = ?").run(session_token);
                            res.setHeader('Set-Cookie', `session=${session_token}; HttpOnly; Path=/; Max-Age=0`);
                        }
                    }
                    return send_json_response(res, 200, 'success', 'logout successful', null);
                }

                res.writeHead(404);
                res.end()
            } catch (error) {
                console.error(error);
                return send_json_response(res, 500, 'error', 'an unexpected error occurred', null);
            }
        });
    } else if (req.method === 'GET') {
        serve_static(req, res).catch(error => {
            console.error(error);
            if (!res.headersSent) send_json_response(res, 500, 'error', 'an unexpected error occurred', null);
            else res.end();
        });
    } else {
        return send_json_response(res, 400, 'error', 'invalid endpoint', null);
    }
})