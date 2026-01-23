You are generating the file: settings.js

Context:
- Static web app (no frameworks)
- Settings tab UI only
- Uses store.js for all data operations (settings, holidays, backup, debug)
- Must be iPhone Safari friendly
- No prompt()/alert()/confirm()
- No long-press menus

Locked Settings requirements:

1) Accent color selection
- Default accent is red
- Accent options:
  - Red
  - Blue
  - Green
  - Purple
  - Pink
  - SeaBelly Pink (#F5E2E3)
- UI:
  - Show current accent
  - Tap opens popup/modal listing options
  - Selecting updates accent immediately
  - Accent only affects highlights (handled via CSS variables)

2) Custom holidays manager
- Stored as MM-DD + name (no year)
- CRUD:
  - add
  - edit (optional if simple)
  - delete
- Custom holiday indicators use SeaBelly Pink in calendar (calendar.js handles visuals)

3) Backup
- Export backup JSON (download file)
- Import backup JSON (upload file)
- Import behavior: Replace All
- Must validate and handle errors inside the UI (non-blocking)

4) Debug
- Debug OFF by default
- Toggle debug on/off
- Copy debug log
- Clear debug log
- Debug UI must never block the app

5) Reminders
- Text-only section reminding user to use Apple Reminders (no notifications inside the app)

Assets (use exact paths if you include icons in Settings):
/v3/images/icon/icon-backup-cloud.png.png
/v3/images/icon/icon-import-export.png.png
/v3/images/icon/icon-overflow-more.png.png
/v3/images/icon/icon-close-cancel.png.png
/v3/images/icon/icon-confirm-check.png.png

Exports:
- export function renderSettings(rootEl)

Imports:
- import needed functions/constants from ./store.js only
- Do not invent imports

Output rules:
- Output ONLY the full contents of settings.js in one code block
- No markdown, no explanations
