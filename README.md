# Wessy Sensitivity — Final Firebase Edition

## Included
- Existing Wessy public UI preserved.
- Firebase project already connected: `wessy-sensitivity`.
- Google owner login.
- Firestore real-time live configuration.
- Two allowed owner accounts locked by Firestore Rules:
  - `bhaskar843120@gmail.com`
  - `bhaskarthakur480@gmail.com`
- Owner password as a second gate.
- Admin management for base sensitivity, RAM, brands, exact phone models, tips and Wessy AI replies.
- Public site updates in real time after Firestore saves.
- SEO files: `robots.txt` and `sitemap.xml`.

## Important: owner password
`admin/admin-auth-config.js` intentionally still contains placeholders because no owner password was provided to the project.

1. Open `tools/set-password.html` locally in a browser.
2. Enter the password you personally choose.
3. Copy the two generated `export const ...` lines.
4. Replace both placeholder lines in `admin/admin-auth-config.js`.
5. Upload the edited project.

The password is not the main Firebase permission layer. The allowed Google account is checked in the app and the two emails are also enforced by `firestore.rules`.

## Firestore Rules
Firebase Console → Firestore Database → Rules:

Copy the complete contents of `firestore.rules` and click Publish.

## Google Authentication
Firebase Console → Authentication → Sign-in method:
- Google: Enabled

Authentication → Settings → Authorized domains:
- Add every domain where this site is hosted.
- If testing locally, use a supported local development domain.
- For Firebase Hosting, the Firebase domains are normally handled automatically.

## First live admin save
Go to:

`https://YOUR-DOMAIN/admin/`

Then:
1. Sign in with one of the two allowed Google accounts.
2. Enter the owner password.
3. Dashboard opens.
4. Edit data.
5. Press **Save All Changes to Live Site**.

The first save creates `config/site` in Firestore. After that the public website listens to this document in real time.

## Hosting
The project is plain HTML/CSS/JavaScript. Upload the folder contents without nesting them inside an extra folder.

The important paths are:

- `/index.html`
- `/style.css`
- `/app.js`
- `/defaults.js`
- `/firebase-config.js`
- `/admin/index.html`
- `/admin/admin.js`
- `/admin/admin.css`

## SEO
Before final production, update these if the final domain is different:
- `index.html` canonical URL
- `sitemap.xml`
- `robots.txt`
