# MediaShare — Images & Videos with Messages (Client-side demo)

This is a simple client-only single-page application that lets you:

- Log in locally using your Date of Birth (DOB).
- Upload images or videos and attach a message (caption) underneath each item.
- Create a share code that you can send to a friend so they can view the items you chose to share by entering the code in the site.
- All data is stored in the browser's IndexedDB (files are stored as blobs). This is a demo that runs entirely on the client — no server required.

## Files

- `index.html` — the single page that contains the UI.
- `styles.css` — styling for a clean, responsive interface.
- `app.js` — main application logic (IndexedDB wrapper, upload, share, view).
- `README.md` — this file.

## How to use

1. Open `index.html` in a modern browser (Chrome, Firefox, Edge, Safari).
2. On first use: enter your Date of Birth (DOB) and click Enter. This creates a local "owner" record in your browser.
3. Use the Upload form to pick an image or video and add a message (caption). Click Upload to save it.
4. Your uploads show in "My uploads". You can edit captions or delete items.
5. Click "Create share code" to generate a short code (e.g. `AB12CD`) that maps to your current uploads. The code is stored locally in your browser's IndexedDB.
6. Send the code and the website link to a friend. When they open the site, they should choose "View shared", enter the code, and they'll see the items you included in that share (read-only).

## Important notes & limitations

- This is a local demo. All data is stored in your browser's IndexedDB. It does not sync to a server.
- If you clear your browser data or use a different device/browser, the stored content and share codes will not be available.
- Sharing works by storing a mapping (code → file IDs) in the browser IndexedDB. That mapping is only available in the same browser profile where the code was created.
- IndexedDB can handle reasonably large files, but browsers limit storage quotas. Large videos may be restricted depending on the user's device and browser.
- For a production implementation you should:
  - Use a server (with authentication) to store files and metadata.
  - Use secure login and proper access control.
  - Protect data privacy and add encryption if required.

## Security & Privacy

- The site asks for DOB only to identify a local session; it's not sent anywhere.
- Because everything is stored locally, privacy is high on that device — unless you share the code and someone uses it on the same (or a compatible) browser to access the shared items.

## Extending to a real server-backed app

If you later want to make this a real multi-user site:
- Add a backend (Node/Express, Django, etc.) with authenticated accounts.
- Store files (images/videos) in object storage (S3 or similar) and metadata in a database.
- Generate share links (secure, expirable) on the server so share codes can be verified anywhere and revoked.

## Troubleshooting

- If uploaded items do not appear:
  - Make sure the browser supports IndexedDB.
  - Check the browser console for errors.
- If share codes don't work:
  - Codes are stored locally; confirm the code was created in that browser.
  - Codes are case-sensitive; enter exactly as shown.

---

This repository is a starting point — if you want I can:
- Convert the local storage logic to a server + database implementation,
- Add passwordless or more secure login instead of DOB,
- Add thumbnails, pagination, or album support,
- Or build an export/import mechanism for moving data between browsers.

Tell me which direction you prefer next and I'll modify the code or provide server examples.