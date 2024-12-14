import path from 'path';
import express from 'express';
import https from 'https'
import { fileURLToPath } from 'url';
import * as JSONC from 'comment-json';
import fs from 'fs';
// import bodyParser from 'body-parser';
import sqlite3 from 'sqlite3'
import crypto  from 'crypto';

const app = express();
app.use(express.json());

console.log('Starting ICE Credentials Receiver');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let configFname = __dirname + '/config.json';
console.log(`Loading config from ${configFname}`);

if (!fs.existsSync(configFname)) {
    console.error(`Config file not found at ${configFname}`);
    process.exit(1);
}
const CONFIG = JSONC.parse(fs.readFileSync(configFname).toString());
if (!CONFIG.dbFile) {
  console.error('Missing dbFile in config');
  process.exit(1);
}
if (!CONFIG.realm) {
    console.error('Missing realm in config');
    process.exit(1);
  }
if (!CONFIG.port) {
    console.error('Missing port in config');
    process.exit(1);
}
if (!CONFIG.secret) {
    console.error('Missing secret in config');
    process.exit(1);
}
if (!CONFIG.ssl) {
    console.error('Missing ssl in config');
    process.exit(1);
}
if (!CONFIG.ssl.private) {
    console.error('Missing ssl/private in config');
    process.exit(1);
}
if (!CONFIG.ssl.public) {
    console.error('Missing ssl/public in config');
    process.exit(1);
}

const db = new sqlite3.Database(CONFIG.dbFile);

// HTTPS options
const httpsOptions = {
    key: fs.readFileSync(CONFIG.ssl.private),
    cert: fs.readFileSync(CONFIG.ssl.public)
};

console.log(`Using SQLite file ${CONFIG.dbFile}`);

app.get([ '/' ], (req, res) => {
    res.send('Ohi, Credentials Receiver here');
});

app.post([ '/' ], (req, res) => {
    if (!req.body) {
        console.error(`Missing request body from ${req.ip}`);
        return res.status(400).send();
    }
        
    if (!req.body.auth || req.body.auth != CONFIG.secret) {
        console.error(`Invalid request auth from ${req.ip}`);
        return res.status(401).send();
    }

    const input = `${req.body.ice_id}:${CONFIG.realm}:${req.body.ice_secret}`;
    const hmackey = crypto.createHash('md5').update(input).digest('hex');;

    console.log('Updating '+req.body.ice_id);
    
    const sql_delete = `DELETE FROM turnusers_lt WHERE realm = ? AND name = ?`;
    return db.run(sql_delete, [CONFIG.realm, req.body.ice_id], (delErr) => {
        if (delErr) {
            console.error('Error deleting existing record:', delErr.message);
            return res.status(500).send('Error updating credentials');
        }

        const sql_insert = `INSERT INTO turnusers_lt (realm, name, hmackey) VALUES (?, ?, ?)`;
        return db.run(sql_insert, [CONFIG.realm, req.body.ice_id, hmackey], (err) => {
            if (err) {
                console.error('Error adding credentials:', err.message);
                return res.status(500).send('Error adding credentials');
            }
            console.log(`Credentials added for ${req.body.ice_id}`);
            res.status(200).send();
        });

    });
});

app.use((req, res, next) => {
    res.status(404).send('404 - Not Found');
});

https.createServer(httpsOptions, app).listen(CONFIG.port, () => {
    console.log(`ICE received listening on port ${CONFIG.port}`);
});