CREATE TABLE IF NOT EXISTS users (
    userid INTEGER PRIMARY KEY,
    username VARCHAR(64) NOT NULL,
    password VARCHAR(255) NOT NULL,
    salt VARCHAR(64) NOT NULL,
    profile_picture VARCHAR(255),
    registered DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS `sessions` (
    session_id INTEGER PRIMARY KEY,
    userid INT NOT NULL,
    `token` VARCHAR(255) NOT NULL,
    created DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires DATETIME
);

CREATE TABLE IF NOT EXISTS `messages` (
    message_id INTEGER PRIMARY KEY,
    sender_id INT NOT NULL,
    receiver_id INT NOT NULL,
    message TEXT NOT NULL,
    sent_at DATETIME DEFAULT CURRENT_TIMESTAMP
);