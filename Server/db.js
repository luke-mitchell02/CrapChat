// https://nodejs.org/api/sqlite.html

import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';

export const database = new DatabaseSync('./Server/crapchat.db');
database.exec(readFileSync('./Server/schema.sql', 'utf8'))