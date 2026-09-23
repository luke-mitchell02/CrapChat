// Connect to the websocket server and pass username
const wsProtocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
const ws = new WebSocket(`${wsProtocol}//${location.host}/ws`);
let localUser = {};
let current_chat = null;

function add_chat_user(userid, username, status) {
  if (userid == localUser?.id) return;
  const chatListEl = document.getElementById('chat-list');
  const user_status = status ? 'online' : 'offline';
  
  // Create LI
  const newChatItem = document.createElement('li');
  newChatItem.className = "chat-list-item";
  newChatItem.dataset.uid = userid;
  chatListEl.appendChild(newChatItem);

  // Add Avatar
  const avatarSpan = document.createElement('span');
  avatarSpan.className = "avatar";
  avatarSpan.textContent = username[0].toUpperCase();
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

function open_chat(userid) {
  document.querySelector(".chat-empty-state").style.display = 'none';
  document.querySelector(".chat-active").style.display = 'flex';
  document.getElementById('chat-box').replaceChildren();
  current_chat = userid;
}

ws.addEventListener('error', console.error);

ws.addEventListener('message', function message(event) {
  const message = JSON.parse(event.data);

  // If auth fails, close ws
  if (message.type === 'auth_error') {
    return window.location.href = '/';
    
  } else if (message.type === 'auth_success') {
    document.querySelector('#current-user .avatar').textContent = message.payload.user.name[0];
    document.getElementById('current-user-name').textContent = message.payload.user.name;
    return localUser = message.payload.user;

  } else if (message.type === "userlist") {
    document.getElementById('chat-list').replaceChildren();
    
    for (const { userid, username, online } of message.payload.members) {
      add_chat_user(userid, username, online);
    }
    return;
  } else if (message.type === 'message_send') {
    if (message.payload.senderid !== current_chat) return;

    let newElement = document.createElement('div');
    newElement.className = 'chat-message received';
    newElement.textContent = message.payload.content;
    document.getElementById('chat-box').appendChild(newElement)
  }
});

// Send the message from the Form
const form = document.getElementById('chat-box-form');

form.addEventListener('submit', function (event) {
  event.preventDefault();
  let message_input = document.getElementById('user-input');

  // Add message to clients own chat
  let newElement = document.createElement('div');
  newElement.className = 'chat-message sent';
  newElement.textContent = message_input.value;
  document.getElementById('chat-box').appendChild(newElement)

  // Send Message
  ws.send(JSON.stringify({type: 'message_send', message: null, payload: { senderid: localUser.id, receiverid: current_chat, content: message_input.value, timestamp: new Date().toISOString() } }))
  message_input.value = '';
});

// Click user in sidebar
const chat_list = document.getElementById('chat-list');
chat_list.addEventListener('click', function (event) {
    const clickedItem = event.target.closest('.chat-list-item');
    if (!clickedItem) return;
    
    open_chat(Number(clickedItem.dataset.uid));
});
