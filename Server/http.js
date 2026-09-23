import http from 'http';
import { database } from './db.js';
import { promisify } from 'node:util';
import { scrypt, randomBytes } from 'node:crypto';

const scryptAsync = promisify(scrypt);
const REGISTER_QUERY = "INSERT INTO `users` (username, password, salt) VALUES (?, ?, ?)";


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

export const httpserver = http.createServer((req, res) => {
    if (req.method === 'POST') {
        // Body is sent as a 'stream' of bytes, so you need to accumulate them all before processing.
        let body = '';
        req.on('data', chunk => {
            body += chunk;  // Automatically turns to a string
        });

        // Once done accumulating, process it
        req.on('end', async () => {
            let parsedData = JSON.parse(body);

            // Precondition check that username and password are sent
            for (const property of ['username', 'password']) {
                if (!Object.hasOwn(parsedData, property)) {
                    return send_json_response(res, 400, 'error', 'required fields are missing', null);
                }
            }
            
            // Only respond once done receiving data
            if (req.url === '/login') {
                const stored_user = database.prepare("SELECT * FROM users WHERE username = ?").get(parsedData.username);
                if (!stored_user) return send_json_response(res, 401, 'error', 'invalid username or password', null);
                
                // Successful User found - compare password
                const sent_pwd_hashed = await hash_password(parsedData.password, stored_user.salt);
                if (sent_pwd_hashed !== stored_user.password) return send_json_response(res, 401, 'error', 'invalid username or password', null);
                
                // Successful match - create session
                const token =  randomBytes(64).toString('hex');
                const expiry = new Date(Date.now() + 30 * 86400000);  // 30 Day Expiry
                database.prepare("INSERT INTO sessions (userid, token, expires) VALUES (?, ?, ?)").run(stored_user.userid, token, expiry.toISOString());
                
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
            } else if (req.url === '/logout') {
                if (!req.headers?.cookie) return send_json_response(res, 200, 'success', 'logout successful', null);
                
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
        });
    } else {
        res.writeHead(404);
        res.end();
    }
})