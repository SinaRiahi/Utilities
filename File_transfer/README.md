# Utilities — File Transfer

A local-network PC ↔ phone file transfer utility.

## Quick start

For development:

1. Install Python 3.11+.
2. Run `install.bat`.
3. Run `python launcher.py`.

For a standalone Windows executable:

1. Run `install.bat`.
2. Find `dist\Utilities File Transfer.exe`.
3. Double-click it.
4. Your default browser opens automatically.

Python is not required on the machine where the finished EXE is used.

## Features

- PC ↔ phone transfer over the same Wi-Fi/LAN.
- Random access token for every launch.
- QR code for phone connection.
- Drag and drop.
- Multiple-file upload.
- 4 GB maximum per uploaded file.
- Download and delete individual files.
- One-click Clean Transfer.
- Transfer-folder selection.
- Persistent transfer-folder setting.
- Light/dark theme.
- Automatic browser launch.
- No cloud service.
- Files remain on the selected local folder.

## Important

The EXE starts a local FastAPI server on port 8765 and opens:

`http://127.0.0.1:8765/?token=...`

The QR code uses the computer's LAN address so a phone on the same network can connect.

Windows Firewall may ask for permission. Allow it on Private networks if you want phone access.

Do not expose this server directly to the public internet.

## Clean Transfer

The Clean Transfer button deletes every file currently in the selected transfer folder. It asks for confirmation first.

## Folder setting

The transfer folder can be changed from the Settings section in the web UI. The selected path is stored locally in `settings.txt`.

## Packaging

`install.bat` installs dependencies and uses PyInstaller to create:

`dist\Utilities File Transfer.exe`
