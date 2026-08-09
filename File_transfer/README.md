# Utilities — File Transfer

A local-network file transfer tool for the Utilities collection.

## What it does

- Transfer files between a PC/laptop and a phone on the same Wi-Fi/LAN.
- Upload from either device.
- Download files from the shared transfer queue.
- Drag and drop on desktop.
- Native mobile file picker on phones.
- QR code for quick phone connection.
- Shared light/dark theme using the Utilities `utils-theme` setting.
- No cloud service and no external file upload.
- Files are stored only in the local `transfers/` folder.

## How it works

The PC/laptop runs a small FastAPI server. The phone opens the server's local IP address.

1. Install Python 3.11+.
2. Open a terminal in this folder.
3. Install dependencies:

   `pip install -r requirements.txt`

4. Start it:

   `python app.py`

5. Open the displayed PC address.
6. On the phone, scan the QR code or open the displayed mobile address.

Both devices must be connected to the same local network.

## Firewall

On Windows, allow Python/uvicorn through the Private Network firewall prompt if Windows asks.

If the phone cannot connect, make sure:
- both devices are on the same Wi-Fi;
- the Wi-Fi network does not use client/AP isolation;
- Windows Firewall allows TCP port 8765 on Private networks.

## Security

The server is intended for a trusted local network. Each launch creates a random access token and the QR code contains that token.

It is **not** intended to be exposed directly to the public internet. For internet-wide transfers, use HTTPS plus proper authentication/storage controls.
