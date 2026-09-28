const wsProtocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
let ws = null;  // Current WebSocket - replaced by connect()
let localUser = {};  // { name, id }
let current_chat = null;  // userid
let userlist = {};  // uid: { name: string, online: bool }
let unread_message_id = null;  // Newest unread message received in the open chat
let read_timer = null;  // Counts the 5 seconds before marking messages as read


// Payload { sender_id, receiver_id, content, message_id, sent_at, read_at }
function add_chat_message(payload, animate = false) {
    if (payload.content.trim() === '') return;  // Dont draw empty messages
    const user_near_bottom = is_near_bottom();

    // Message Logic
    let newElement = document.createElement('div');
    newElement.className = payload.sender_id !== localUser.id ? 'chat-message received' : 'chat-message sent';
    if (animate) newElement.classList.add('animate-in');  // Live messages only, not history
    newElement.textContent = payload.content;
    newElement.dataset.messageId = payload.message_id;

    // Ticks on our own messages - the server has it, so it's at least delivered
    if (payload.sender_id === localUser.id) {
        newElement.dataset.status = payload.read_at ? 'read' : 'delivered';
    }

    // Timestamp Logic
    const date = new Date(payload.sent_at);
    let messageTimestamp = document.createElement('time');
    messageTimestamp.className = 'message-time';
    messageTimestamp.dateTime = date.toISOString();
    messageTimestamp.textContent =  date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    // Add it all
    add_day_divider(date);
    document.getElementById('chat-box').appendChild(newElement);
    newElement.appendChild(messageTimestamp);

    // Received and not read yet - start counting towards marking it read
    if (payload.receiver_id === localUser.id && !payload.read_at) {
        unread_message_id = Math.max(unread_message_id ?? 0, payload.message_id);
        update_read_timer();
    }

    // Scroll
    if ((user_near_bottom || payload.sender_id === localUser.id) && animate) bottom_of_chat();
}

// "Today", "Yesterday", or a date like "Mon 21 Sep" (with the year if it isn't this year)
function day_label(date) {
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);

    if (date.toDateString() === today.toDateString()) return 'Today';
    if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';

    const options = { weekday: 'short', day: 'numeric', month: 'short' };
    if (date.getFullYear() !== today.getFullYear()) options.year = 'numeric';
    return date.toLocaleDateString([], options);
}

// Add a day divider unless the last one in the chat is already for this day
function add_day_divider(date) {
    const chatBoxEl = document.getElementById('chat-box');
    const dividers = chatBoxEl.querySelectorAll('.day-divider');
    const last_divider = dividers[dividers.length - 1];
    if (last_divider?.dataset.date === date.toDateString()) return;

    const divider = document.createElement('div');
    divider.className = 'day-divider';
    divider.dataset.date = date.toDateString();
    divider.textContent = day_label(date);
    chatBoxEl.appendChild(divider);
}

function add_unread_divider() {
    const divider = document.createElement('div');
    divider.className = 'unread-divider';
    divider.textContent = 'New messages';
    document.getElementById('chat-box').appendChild(divider);
    return divider;
}

// ---- Read tracking: the chat is open, the tab is focused, for 5 seconds ----

function is_user_watching() {
    return document.visibilityState === 'visible' && document.hasFocus();
}

// Start the timer if there's something unread and the user is looking, otherwise stop it
function update_read_timer() {
    const should_run = unread_message_id !== null && is_user_watching();

    if (should_run && read_timer === null) {
        read_timer = setTimeout(send_read_receipt, 1000);
    } else if (!should_run && read_timer !== null) {
        clearTimeout(read_timer);
        read_timer = null;
    }
}

function reset_read_tracking() {
    clearTimeout(read_timer);
    read_timer = null;
    unread_message_id = null;
}

function send_read_receipt() {
    read_timer = null;
    if (unread_message_id === null || ws.readyState !== WebSocket.OPEN) return;

    ws.send(JSON.stringify({type: 'message_read', message: null, payload: { user_id: current_chat, message_id: unread_message_id }}));
    unread_message_id = null;
}

function add_chat_user(user_id, username, status) {
    if (user_id == localUser?.id) return;
    const chatListEl = document.getElementById('chat-list');
    const user_status = status ? 'online' : 'offline';
    
    // Create LI
    const newChatItem = document.createElement('li');
    newChatItem.className = "chat-list-item";
    newChatItem.dataset.uid = user_id;
    chatListEl.appendChild(newChatItem);

    // Add Avatar
    const avatarSpan = document.createElement('span');
    avatarSpan.className = "avatar";
    avatarSpan.textContent = username[0];
    newChatItem.appendChild(avatarSpan);

    // Add Name
    const nameSpan = document.createElement('span');
    nameSpan.className = "chat-list-name";
    nameSpan.textContent = username;
    newChatItem.appendChild(nameSpan);

    // Add Name
    const statusSpan = document.createElement('span');
    statusSpan.className = `status-dot ${user_status}`;
    statusSpan.textContent = '';
    newChatItem.appendChild(statusSpan);
}

function set_chat_status(user_id) {
    if (user_id !== current_chat) return;

    const chatUser = userlist[user_id];
    const chatStatusEl = document.getElementById('chat-partner-status');
    const statusSpanEl = document.createElement('span');
    statusSpanEl.className = chatUser.online ? 'status-dot online' : 'status-dot offline';
    chatStatusEl.replaceChildren(statusSpanEl, chatUser.online ? 'Online' : 'Offline');
}

function open_chat(user_id) {
    if (user_id === current_chat) return;
    current_chat = user_id;
    const chatUser = userlist[user_id];
    reset_read_tracking();  // Don't mark the previous chat as read

    // Update Chat
    document.querySelector(".chat-empty-state").style.display = 'none';
    document.querySelector(".chat-active").style.display = 'flex';
    document.getElementById('chat-box').replaceChildren();  // Clear children

    // Update Chat Header
    const chatHeaderEl = document.getElementById("chat-header-info");
    chatHeaderEl.style.display = 'flex';
    chatHeaderEl.querySelector('.chat-header-name').textContent = chatUser.name;
    chatHeaderEl.querySelector('.avatar').textContent = chatUser.name[0];
    set_chat_status(user_id);
    
    // Request Chat History
    ws.send(JSON.stringify({type: 'chat_open', message: null, payload: { user_id }}))
}

function is_near_bottom() {
    const chatBoxEl = document.getElementById('chat-box');
    const user_scrolled_amount = chatBoxEl.scrollHeight - chatBoxEl.scrollTop - chatBoxEl.clientHeight;
    return user_scrolled_amount <= 200;
}

function bottom_of_chat() {  // Scroll to bottom
    const chatBoxEl = document.getElementById('chat-box');
    chatBoxEl.scrollTo(0, chatBoxEl.scrollHeight);
}

// ---- Server message handlers (one per message type) ----

function handle_auth_error() {  // If auth fails, go back to login
    window.location.href = '/';
}

function handle_auth_success(payload) {
    document.querySelector('#current-user .avatar').textContent = payload.user.name[0];
    document.getElementById('current-user-name').textContent = payload.user.name;
    localUser = payload.user;
}

function handle_userlist(payload) {
    document.getElementById('chat-list').replaceChildren();

    for (const { user_id, username, online } of payload.members) {
        add_chat_user(user_id, username, online);
        userlist[user_id] = { name: username, online: online};
        set_chat_status(user_id);  // Update chat status if current chat user
    }
}

function handle_chat_history(payload) {
    if (payload.user_id !== current_chat) return;
    document.getElementById('chat-box').replaceChildren();
    reset_read_tracking();
    const message_history = payload.messages.reverse();
    let unread_divider = null;

    message_history.forEach(message => {
        // "New messages" divider goes above the first message we haven't read
        if (!unread_divider && message.receiver_id === localUser.id && !message.read_at) {
            add_day_divider(new Date(message.sent_at));  // Keep the day divider above it
            unread_divider = add_unread_divider();
        }
        add_chat_message(message);
    });

    // Jump to the first unread message if there is one, otherwise the bottom
    if (unread_divider) unread_divider.scrollIntoView({ block: 'start' });
    else bottom_of_chat();
}

function handle_message_send(payload) {
    if (payload.sender_id !== current_chat && payload.receiver_id !== current_chat) return;
    if (payload.sender_id === localUser.id) reset_read_tracking();  // Our reply marked everything read on the server
    add_chat_message(payload, true);
}

// The other person has read our messages up to message_id - turn those ticks blue
function handle_message_read(payload) {
    if (payload.user_id !== current_chat) return;  // History will have it when that chat is opened

    document.querySelectorAll('#chat-box .chat-message.sent').forEach(messageEl => {
        if (Number(messageEl.dataset.messageId) <= payload.message_id) {
            messageEl.dataset.status = 'read';
        }
    });
}

function handle_heartbeat(payload) {
    ws.send(JSON.stringify({type: 'heartbeat', message: 'yes i am alive and well!', payload: { sent_at: payload.sent_at } }))
}

// ---- WebSocket handlers ----

function handle_ws_message(event) {
    const message = JSON.parse(event.data);
    const payload = message.payload;

    if (message.type === 'auth_error') handle_auth_error();
    else if (message.type === 'auth_success') handle_auth_success(payload);
    else if (message.type === 'userlist') handle_userlist(payload);
    else if (message.type === 'chat_history') handle_chat_history(payload);
    else if (message.type === 'message_send') handle_message_send(payload);
    else if (message.type === 'heartbeat') handle_heartbeat(payload);
    else if (message.type === 'message_read') handle_message_read(payload);
}

// Create a new WebSocket and attach all its listeners
function connect() {
    ws = new WebSocket(`${wsProtocol}//${location.host}/ws`);
    ws.addEventListener('error', console.error);
    ws.addEventListener('message', handle_ws_message);
}

connect();

// Pause or resume the read timer when the user switches tabs or windows
document.addEventListener('visibilitychange', update_read_timer);
window.addEventListener('focus', update_read_timer);
window.addEventListener('blur', update_read_timer);

// Send the message from the Form
const form = document.getElementById('chat-box-form');
form.addEventListener('submit', function (event) {
    event.preventDefault();
	let message_input = document.getElementById('user-input');
    if (message_input.value.trim() === '') return;

	// Send Message
	ws.send(JSON.stringify({type: 'message_send', message: null, payload: { receiver_id: current_chat, content: message_input.value } }))
	message_input.value = '';
});

// Show the jump-to-latest button once the user scrolls up away from the newest messages
const chat_box = document.getElementById('chat-box');
const scroll_bottom_button = document.getElementById('scroll-bottom-button');
chat_box.addEventListener('scroll', function () {
    scroll_bottom_button.classList.toggle('visible', !is_near_bottom());
});

// Smooth scroll down, unless the user's OS asks for reduced motion
scroll_bottom_button.addEventListener('click', function () {
    const reduce_motion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    chat_box.scrollTo({ top: chat_box.scrollHeight, behavior: reduce_motion ? 'auto' : 'smooth' });
});

// Click user in sidebar
const chat_list = document.getElementById('chat-list');
chat_list.addEventListener('click', function (event) {
	const clickedItem = event.target.closest('.chat-list-item');
    if (!clickedItem) return;
    
    open_chat(Number(clickedItem.dataset.uid));
});

// Logout Button
const logout_button = document.getElementById('logout-button');
logout_button.addEventListener('click', async function (event) {
    try {
        const response = await fetch("/logout", {method: "POST", headers: {"Content-Type": "application/json"}});
    
        if (!response.ok)  throw new Error(`Response status: ${response.status}`);
        
        const result = await response.json();
        if (result.message === "logout successful") {
            window.location.href = '/';
        }
    } catch (error) {
        console.error(`An error occurred: ${error}`);
    }
});