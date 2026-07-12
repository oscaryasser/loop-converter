# Our Dogs 🐾 — Family Dog Tracker

A tiny private web app for keeping track of our dogs' care — medications,
grooming, vaccinations, vet visits, feeding, and reminders. Two people,
four dogs (Kahlua, Kohffee, Khona, and Khalev), one shared link, live sync
between phones.

**No build step, no server, no cost.** Plain HTML/CSS/JavaScript hosted free
on GitHub Pages, with data stored free in Firebase Firestore.

---

## How it works (30 seconds)

- The app is static files served by **GitHub Pages**.
- All data lives in **Firebase Firestore** under one hard-to-guess random
  path. Both phones subscribe to it live, so an edit on one phone appears
  on the other within a second — no refresh.
- Dog photos are resized to ~400px in the browser and stored *inside* the
  database record (no Firebase Storage, no billing, no card on file).
- There is **no login**: anyone with the link can view and edit. The random
  path is the lock. (There's a marked spot in `app.js` where a shared
  passphrase gate can be added later.)

## One-time setup

You only do this once. Total time: about 10 minutes.

### 1. Create a free Firebase project

1. Go to <https://console.firebase.google.com> and sign in with any Google
   account.
2. Click **Create a Firebase project**, name it anything (e.g. `our-dogs`),
   and click **Continue**.
3. When asked about **Google Analytics**, turn it **off** (not needed), then
   click **Create project** → wait → **Continue**.

### 2. Create the Firestore database

1. In the left sidebar, click **Build → Firestore Database**.
2. Click **Create database**.
3. Choose the location closest to home, click **Next**.
4. Choose **Start in production mode** (we'll paste our own rules next),
   click **Create**.

### 3. Paste the security rules

1. Still in Firestore, click the **Rules** tab.
2. Delete everything in the editor and paste the entire contents of
   [`firestore.rules`](firestore.rules) from this repo.
3. Click **Publish**.

> The tradeoff in one sentence: with no login, anyone who discovers the
> exact random data path could read and edit the data — the long random ID
> baked into the app is the only lock on the door.

### 4. Register a web app + get your config

1. Click the **gear icon → Project settings** (top of the left sidebar).
2. Scroll to **Your apps**, click the **`</>`** (web) icon.
3. Nickname: `dog-tracker`. Do **not** tick Firebase Hosting. Click
   **Register app**.
4. Firebase now shows a code block containing `const firebaseConfig = { ... }`.
   Copy the values.
5. Open [`firebase-config.js`](firebase-config.js) in this repo and replace
   the placeholder values with yours. Keep the `export const` line as-is.

> **Is it safe for these keys to be public? Yes.** Firebase web config
> values are identifiers, not secrets — they just tell the browser which
> project to talk to. Access control comes from the Firestore rules, not
> from hiding these values. Every Firebase-powered website ships them in
> plain sight.

### 5. Turn on GitHub Pages

1. In this GitHub repo, go to **Settings → Pages**.
2. Under **Build and deployment → Source**, choose **Deploy from a branch**.
3. Pick the branch this code lives on, folder **/ (root)**, click **Save**.
4. After a minute or two the page shows your live URL, like
   `https://YOURNAME.github.io/REPONAME/`.

### 6. Send the link

Text the URL to your wife. She opens it in her phone browser — that's it.
For an app-like feel, use the browser menu → **Add to Home Screen** on both
phones.

## Everyday use

- **Home** shows every dog; a red chip means something's overdue.
- Tap a dog to edit anything inline — changes save as you go and appear on
  the other phone live.
- **Due Soon** (bottom tab) gathers everything overdue or due in the next
  14 days across all dogs.
- **✓ Done** next to a medication, grooming, or care task stamps it done
  today. Recurring items (grooming, care tasks, and meds with a
  "repeats every … days" value) automatically schedule the next date.
- **Routine care** on each dog's page tracks the recurring extras —
  brushing, teeth, weigh-ins, buying food, baths, flea remedies — each with
  its own interval, due date, and reminder.
- **🗓 Add to calendar** next to any due item downloads a calendar event —
  open it and it lands in your phone's real calendar with a 9 AM alert on
  the day. This is the reliable reminder path.
- The 🔔 banner enables best-effort browser notifications on app open
  (phone browsers are flaky about these — the calendar route always works).

## Files

| File | What it is |
|---|---|
| `index.html` | The single page |
| `style.css` | All styling |
| `app.js` | All logic (Firestore sync, screens, reminders, .ics export) |
| `firebase-config.js` | **The only file you edit** — your Firebase config |
| `firestore.rules` | Security rules to paste into the Firebase console |
| `sw.js` | Tiny service worker so Android Chrome can show notifications |
| `.nojekyll` | Tells GitHub Pages to serve files as-is |

## Costs

Firestore's free tier allows 50,000 reads and 20,000 writes **per day**;
two people tracking four dogs uses a tiny fraction of a percent of that.
GitHub Pages is free for public repos. There is nothing to pay and no
card on file anywhere.
