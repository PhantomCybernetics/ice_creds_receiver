import https from "node:https";
import fs from "node:fs";
import crypto from "node:crypto";

import * as JSONC from "comment-json";
import express from "express";
import { Database } from "bun:sqlite";

const app = express();
app.use(express.json());

console.log("Starting ICE Credentials Receiver");

let configFname = process.env.CONFIG_FILE ?? `${__dirname}/config.jsonc`;
console.log(`Loading config from ${configFname}`);

if (!fs.existsSync(configFname)) {
  console.error(`Config file not found at ${configFname}`);
  process.exit(1);
}
const CONFIG: any = JSONC.parse(fs.readFileSync(configFname).toString());
if (!CONFIG.dbFile) {
  console.error("Missing dbFile in config");
  process.exit(1);
}
if (!CONFIG.realm) {
  console.error("Missing realm in config");
  process.exit(1);
}
if (!CONFIG.port) {
  console.error("Missing port in config");
  process.exit(1);
}
if (!CONFIG.secret) {
  console.error("Missing secret in config");
  process.exit(1);
}
if (!CONFIG.ssl) {
  console.error("Missing ssl in config");
  process.exit(1);
}
if (!CONFIG.ssl.private) {
  console.error("Missing ssl/private in config");
  process.exit(1);
}
if (!CONFIG.ssl.public) {
  console.error("Missing ssl/public in config");
  process.exit(1);
}

const db = new Database(CONFIG.dbFile, { strict: true });

// HTTPS options
const httpsOptions = {
  key: fs.readFileSync(CONFIG.ssl.private),
  cert: fs.readFileSync(CONFIG.ssl.public),
};

console.log(`Using SQLite file ${CONFIG.dbFile}`);

app.get("/", (req, res) => {
  res.send("Ohi, Credentials Receiver here");
});

app.post("/", (req, res) => {
  if (!req.body) {
    console.error(`Missing request body from ${req.ip}`);
    res.status(400).send();
    return;
  }

  if (!req.body.auth || req.body.auth != CONFIG.secret) {
    console.error(`Invalid request auth from ${req.ip}`);
    res.status(401).send();
    return;
  }

  const input = `${req.body.ice_id}:${CONFIG.realm}:${req.body.ice_secret}`;
  const hmackey = crypto.createHash("md5").update(input).digest("hex");

  console.log("Updating " + req.body.ice_id);
  try {
    db.run("DELETE FROM turnusers_lt WHERE realm = ? AND name = ?", [
      CONFIG.realm,
      req.body.ice_id,
    ]);

    db.run("INSERT INTO turnusers_lt (realm, name, hmackey) VALUES (?, ?, ?)", [
      CONFIG.realm,
      req.body.ice_id,
      hmackey,
    ]);

    console.log(`Credentials added for ${req.body.ice_id}`);
    res.status(200).send();
  } catch (error) {
    console.error("Error %s", error.message);
    console.log("full error", error);
    res.status(500).send("Error updating credentials");
  }
});

app.use((req, res) => {
  res.status(404).send("404 - Not Found");
});

https.createServer(httpsOptions, app).listen(CONFIG.port, () => {
  console.log(`ICE receiver listening on port ${CONFIG.port}`);
});
