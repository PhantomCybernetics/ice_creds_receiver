# TURN/STUN Credentials Receiver

Receives and stores credentials sent from the Cloud Bridge used by the Coturn server 

## Install

### Install node & npm

```bash
sudo apt install nodejs npm
```

### Install this repo
```bash
git clone git@github.com:PhantomCybernetics/ice_creds_receiver.git 
cd ice_creds_receiver
npm install
```

### Create config
Create ice_creds_receiver/config.json and paste:
```jsonc
{
    "dbFile": "/var/lib/turn/turndb", // must match coturn's config
    "realm": "phntm.io", // must match coturn's config
    "port": 1234, // must match ICE_SYNC.port in Cloud Bridge's config
    "secret": "SYNC_PASS", // must match ICE_SYNC.secret in Cloud Bridge's config
    "ssl": {
        "private": "/your_ssl_dir/private.pem",
        "public": "/your_ssl_dir/fullchain.crt"
    }
}
```
Note that the port specified here must be open to inboud TCP traffic, on top of all the ports required by the coturn server.

### Add system service to your systemd
```bash
sudo vim /etc/systemd/system/ice_creds_receiver.service
```
... and paste:
```
[Unit]
Description=phntm ice_creds_receiver service
After=network.target

[Service]
ExecStart=/usr/bin/node /home/ubuntu/ice_creds_receiver/credentials-receiver.js
Restart=always
User=root
Environment=NODE_ENV=production
WorkingDirectory=/home/ubuntu/ice_creds_receiver/
StandardOutput=append:/var/log/ice_creds_receiver.log
StandardError=append:/var/log/ice_creds_receiver.err.log

[Install]
WantedBy=multi-user.target
```
Reload systemctl daemon
```bash
sudo systemctl daemon-reload
```

### Launch:
```bash
sudo systemctl start ice_creds_receiver.service
sudo systemctl enable ice_creds_receiver.service # will launch on boot
```