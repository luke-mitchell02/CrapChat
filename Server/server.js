import { httpserver } from './http.js'
import { setupWebSocketServer } from './ws.js'
import { database } from './db.js';

const PORT = 8090;

httpserver.listen(PORT);
const wss = setupWebSocketServer(httpserver);