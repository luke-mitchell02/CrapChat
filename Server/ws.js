import { WebSocketServer } from 'ws';
import { database } from './db.js'

const connections = new Map();
const userConnections = new Map();



function send_json(ws, type, message, payload) {
    ws.send(JSON.stringify( { type, message, payload }));
}


function validate_session(req) {
    if (!req.headers?.cookie) return null;
    const cookie_array = req.headers.cookie.split(';');

    for (const element of cookie_array) {
        if (element.trim().startsWith('session=')) {
            const session_token = element.trim().split('session=')[1];
            const stored_session = database.prepare("SELECT s.*, u.username FROM sessions s JOIN users u ON `s`.`userid` = `u`.`userid` WHERE `s`.`token` = ? AND `s`.`expires` > CURRENT_TIMESTAMP").get(session_token);
            if (stored_session) return stored_session;
        }
    }
    return null;
}

function get_members() {
    const onlineUserIds = new Set();
    connections.forEach((value) => {
        onlineUserIds.add(value.session.userid);
    });

    const rows = database.prepare("SELECT userid, username FROM users").all();
    return rows.map(row => ({
        userid: row.userid,
        username: row.username,
        online: onlineUserIds.has(row.userid)
    }));
}

function broadcast_message(payload) {
    connections.forEach((data, conn) => {
        if (conn.readyState === 1) {
            conn.send(JSON.stringify(payload));
        }
    });
}

function send_message(senderid, receiverid, content) {
    const sentAt = new Date().toISOString();
    database.prepare("INSERT INTO `messages` (sender_id, receiver_id, message, sent_at) VALUES (?, ?, ?, ?)").run(senderid, receiverid, content, sentAt);

    const ws = userConnections.get(receiverid);
    if (ws && ws.readyState === 1) {
        send_json(ws, 'message_send', null, {senderid, receiverid, content, timestamp: sentAt});
    }
}


export function setupWebSocketServer(httpserver) {
    const wss = new WebSocketServer({ server: httpserver });

    wss.on('connection', function connection(ws, req) {
        const session = validate_session(req);
        if (!session) {
            send_json(ws, 'auth_error', 'invalid session token', null)
            return ws.close();
        }
        connections.set(ws, {
            session: {
                token: session.token,
                username: session.username,
                userid: session.userid,
                expires: session.expires
            }
        });
        userConnections.set(session.userid, ws);
        console.log(`WSCONNECT: ${session.username} [${session.userid}] connected!`);

        // On Initial Connection
        send_json(ws, 'auth_success', 'connection successful', {user: {name: session.username, id: session.userid}})
        broadcast_message({type: 'userlist', message: null, payload: {members: get_members()}});

        // On Error
        ws.on('error', console.error);

        // On Message
        ws.on('message', function message(data) {
            const parsed = JSON.parse(data);

            if (parsed.type === "message_send") {
                send_message(parsed.payload.senderid, parsed.payload.receiverid, parsed.payload.content);
            }
        });

        // On Close
        ws.on('close', () => {
            broadcast_message({ type: 'userlist', message: null, payload: { members: get_members() } });
            
            const user = connections.get(ws);
            console.log(`WSDISCONNECT: ${user.session.username} [${user.session.userid}] disconnected!`)
            
            connections.delete(ws);
            userConnections.delete(user.session.userid);
        })
    });
}