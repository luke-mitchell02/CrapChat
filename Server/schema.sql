CREATE TABLE IF NOT EXISTS users (
    user_id INTEGER PRIMARY KEY,
    username VARCHAR(64) NOT NULL,
    password VARCHAR(255) NOT NULL,
    salt VARCHAR(64) NOT NULL,
    profile_picture VARCHAR(255),
    registered DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS `sessions` (
    session_id INTEGER PRIMARY KEY,
    user_id INT NOT NULL,
    `token` VARCHAR(255) NOT NULL,
    created DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires DATETIME,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS `messages` (
    message_id INTEGER PRIMARY KEY,
    sender_id INT NOT NULL,
    receiver_id INT NOT NULL,
    content TEXT NOT NULL,
    sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    read_at DATETIME,
    FOREIGN KEY (sender_id) REFERENCES users(user_id),
    FOREIGN KEY (receiver_id) REFERENCES users(user_id)
);