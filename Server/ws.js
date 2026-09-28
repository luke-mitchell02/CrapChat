import { WebSocketServer } from 'ws';
import { database } from './db.js'
import { validate_session } from './session.js'

const connections = new Map();
const userConnections = new Map();


function send_json(ws, type, message, payload) {
    ws.send(JSON.stringify( { type, message, payload }));
}

function get_members() {
    const onlineUserIds = new Set();
    connections.forEach((value) => {
        onlineUserIds.add(value.session.user_id);
    });

    const rows = database.prepare("SELECT user_id, username FROM users").all();
    return rows.map(row => ({
        user_id: row.user_id,
        username: row.username,
        online: onlineUserIds.has(row.user_id)
    }));
}

function broadcast_message(payload) {
    connections.forEach((data, conn) => {
        if (conn.readyState === 1) {
            conn.send(JSON.stringify(payload));
        }
    });
}

function send_message(ws, receiver_id, content) {
    // Ignore anything that isn't a non-blank string
    if (typeof content !== 'string' || content.trim() === '') return;

    // Receiver must be a real user
    if (!Number.isInteger(receiver_id)) return;
    if (!database.prepare("SELECT 1 FROM users WHERE user_id = ?").get(receiver_id)) return;

    const conn = connections.get(ws);
    const sender_id = conn.session.user_id;
    const ws_rec = userConnections.get(receiver_id);
    const sent_at = new Date().toISOString();

    // Send Message
    const query_results = database.prepare("INSERT INTO `messages` (sender_id, receiver_id, content, sent_at) VALUES (?, ?, ?, ?)").run(sender_id, receiver_id, content, sent_at);
    const message_id = query_results.lastInsertRowid;

    // Replying means you've seen the chat, so everything they sent before this is now read
    mark_messages_read(ws, receiver_id, message_id);

    // Send the message on the users side
    send_json(ws, 'message_send', null, {sender_id, receiver_id, content, message_id, sent_at});
    if (ws_rec && ws_rec.readyState === 1) {
        send_json(ws_rec, 'message_send', null, {sender_id, receiver_id, content, message_id, sent_at});
    }
}

function get_chat_history(ws, user_id) {
    // Receiver must be a real user
    if (!Number.isInteger(user_id)) return;
    if (!database.prepare("SELECT 1 FROM users WHERE user_id = ?").get(user_id)) return;

    const conn = connections.get(ws);
    const sender_id = conn.session.user_id;
    
    // Get Sent Messages
    const messageHistory = database.prepare("SELECT * FROM `messages` WHERE (sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?) ORDER BY sent_at DESC LIMIT 100").all(sender_id, user_id, user_id, sender_id);
    if (ws.readyState === 1) {
        send_json(ws, 'chat_history', null, {user_id, messages: messageHistory});
    }
}

function mark_messages_read(ws, user_id, message_id) {
    // user_id is the chat partner who sent the messages, message_id is the newest one read
    if (!Number.isInteger(user_id) || !Number.isInteger(message_id)) return;

    const conn = connections.get(ws);
    const reader_id = conn.session.user_id;
    const read_at = new Date().toISOString();

    // Only messages sent TO the reader FROM that partner, up to message_id, that aren't read yet
    const query_results = database.prepare("UPDATE `messages` SET read_at = ? WHERE sender_id = ? AND receiver_id = ? AND message_id <= ? AND read_at IS NULL").run(read_at, user_id, reader_id, message_id);
    if (query_results.changes === 0) return;  // Nothing new was read, so no need to tell anyone

    // Tell the sender so their ticks go blue - user_id is the reader from their side
    const ws_sender = userConnections.get(user_id);
    if (ws_sender && ws_sender.readyState === 1) {
        send_json(ws_sender, 'message_read', null, {user_id: reader_id, message_id});
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
                user_id: session.user_id,
                expires: session.expires
            },
            heartbeat: {
                sent: null,
                response: null
            }
        });
        userConnections.set(session.user_id, ws);
        console.log(`WSCONNECT: ${session.username} [${session.user_id}] connected!`);

        // On Initial Connection
        send_json(ws, 'auth_success', 'connection successful', {user: {name: session.username, id: session.user_id}})
        broadcast_message({type: 'userlist', message: null, payload: {members: get_members()}});

        // On Error
        ws.on('error', console.error);

        // On Message
        ws.on('message', function message(data) {
            // One bad message must not take down the server
            try {
                const parsed = JSON.parse(data);

                if (parsed?.type === 'message_send') {
                    send_message(ws, parsed.payload?.receiver_id, parsed.payload?.content);
                } else if (parsed?.type === 'chat_open') {
                    get_chat_history(ws, parsed.payload?.user_id);
                } else if (parsed?.type === 'message_read') {
                    mark_messages_read(ws, parsed.payload?.user_id, parsed.payload?.message_id);
                } else if (parsed?.type === 'heartbeat') {
                    const user = connections.get(ws);

                    if (user.heartbeat.sent === parsed.payload.sent_at) {
                        user.heartbeat.response = parsed.payload.sent_at;
                    }
                }
            } catch (error) {
                console.error(error);
                send_json(ws, 'error', 'invalid message', null);
            }
        });

        // On Close
        ws.on('close', () => {
            const user = connections.get(ws);
            console.log(`WSDISCONNECT: ${user.session.username} [${user.session.user_id}] disconnected!`)
            connections.delete(ws);
            userConnections.delete(user.session.user_id);

            broadcast_message({ type: 'userlist', message: null, payload: { members: get_members() } });
        })
    });
}


// Heartbeat for connection persistence
setInterval(function () {
    // Clear connections which didnt respond
    connections.forEach((data, conn) => {
        if (data.heartbeat.sent && data.heartbeat.response !== data.heartbeat.sent) {
            conn.terminate();
        }
    });

    const sent_at = new Date().toISOString();
    broadcast_message({ type: 'heartbeat', message: 'are you still there?', payload: { sent_at: sent_at }})
    
    connections.forEach((data) => {
        data.heartbeat.sent = sent_at;
    });
}, 30000);