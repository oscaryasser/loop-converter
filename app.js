// ================================================================
//  Our Dogs — a tiny family dog-care tracker
//  Plain JavaScript + Firebase Firestore (loaded from the CDN).
//  No build step: this file runs as-is on GitHub Pages.
// ================================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import {
  getFirestore, collection, doc, onSnapshot, getDoc,
  setDoc, updateDoc, deleteDoc, connectFirestoreEmulator
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

// ----------------------------------------------------------------
//  WHERE THE DATA LIVES
// ----------------------------------------------------------------
// All data sits under one hard-to-guess document path. Anyone who
// has the app link can read and write — the random FAMILY_ID below
// is the only thing keeping strangers out, so don't post the link
// publicly.
//
// >>> WANT A SHARED PASSPHRASE LATER? ADD IT RIGHT HERE. <<<
// Replace the constant below with something like:
//
//   let pass = localStorage.getItem("family-pass");
//   while (!pass) {
//     pass = prompt("Family passphrase?");
//     if (pass) localStorage.setItem("family-pass", pass);
//   }
//   const FAMILY_ID = "pack-" + pass;
//
// Then the data path itself depends on the passphrase: anyone
// without it lands on an empty, separate path and sees nothing.
// (Each of you would enter the passphrase once per phone.)
// ----------------------------------------------------------------
const FAMILY_ID = "pack-7a3e0c53762c53311c4e7e3e";

const DUE_SOON_DAYS = 14;

// The four pups, pre-loaded on first run.
const STARTER_DOGS = ["Kahlua", "Kohffee", "Kohna", "Kahlev"];

const PLACEHOLDER_COLORS = ["#E07A5F", "#7A9E7E", "#C98A2D", "#8E7CC3", "#5F8FB4", "#B4635F"];

// ---------------- Firebase setup ----------------

// Local-testing hook only: `?emulator` on localhost talks to the
// Firestore emulator instead of the real project. Harmless in
// production — it can never trigger on your live GitHub Pages URL.
const USE_EMULATOR =
  new URLSearchParams(location.search).has("emulator") &&
  ["localhost", "127.0.0.1"].includes(location.hostname);

const configReady =
  USE_EMULATOR ||
  (firebaseConfig.apiKey && !firebaseConfig.apiKey.startsWith("PASTE_"));

let db = null;
let dogsCol = null;

if (configReady) {
  const app = initializeApp(
    USE_EMULATOR
      ? { apiKey: "demo", projectId: "demo-dogtracker", appId: "demo" }
      : firebaseConfig
  );
  db = getFirestore(app);
  if (USE_EMULATOR) connectFirestoreEmulator(db, "localhost", 8080);
  dogsCol = collection(db, "families", FAMILY_ID, "dogs");
}

const dogRef = (id) => doc(dogsCol, id);

// ---------------- state ----------------

const state = {
  dogs: [],        // sorted array of dog objects (each has .id)
  loaded: false,
  error: null,
  seeding: false,
};

// ---------------- small helpers ----------------

const $ = (sel, el = document) => el.querySelector(sel);
const appEl = $("#app");
const modalRoot = $("#modal-root");
const tabbar = $("#tabbar");

const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

function parseDate(str) {
  // "YYYY-MM-DD" -> local-midnight Date, or null
  if (!str || !/^\d{4}-\d{2}-\d{2}$/.test(str)) return null;
  const [y, m, d] = str.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function today() {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), n.getDate());
}

function daysUntil(str) {
  const d = parseDate(str);
  if (!d) return null;
  return Math.round((d - today()) / 86400000);
}

function dateToStr(d) {
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

const todayStr = () => dateToStr(today());

function addDaysStr(str, days) {
  const d = parseDate(str);
  if (!d) return "";
  d.setDate(d.getDate() + days);
  return dateToStr(d);
}

function addMonthsStr(str, months) {
  const d = parseDate(str);
  if (!d) return "";
  const day = d.getDate();
  d.setMonth(d.getMonth() + months);
  if (d.getDate() !== day) d.setDate(0); // Jan 31 + 1mo -> Feb 28, not Mar 3
  return dateToStr(d);
}

function fmtDate(str) {
  const d = parseDate(str);
  if (!d) return "";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function fmtDateShort(str) {
  const d = parseDate(str);
  if (!d) return "";
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

function ageText(birthday) {
  const b = parseDate(birthday);
  if (!b) return "";
  const t = today();
  let months = (t.getFullYear() - b.getFullYear()) * 12 + (t.getMonth() - b.getMonth());
  if (t.getDate() < b.getDate()) months--;
  if (months < 0) return "";
  const y = Math.floor(months / 12), m = months % 12;
  if (y === 0) return `${m} month${m === 1 ? "" : "s"} old`;
  if (m === 0) return `${y} year${y === 1 ? "" : "s"} old`;
  return `${y} yr ${m} mo old`;
}

function placeholderColor(dog) {
  let h = 0;
  for (const c of dog.name || "?") h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return PLACEHOLDER_COLORS[h % PLACEHOLDER_COLORS.length];
}

function photoHtml(dog, cls) {
  if (dog.photo) {
    return `<img class="${cls}" src="${dog.photo}" alt="${esc(dog.name)}">`;
  }
  const initial = esc((dog.name || "?").slice(0, 1).toUpperCase());
  return `<div class="${cls} placeholder" style="background:${placeholderColor(dog)}">${initial}</div>`;
}

// ---------------- due-date logic ----------------

function groomingNextDue(dog) {
  const g = dog.grooming || {};
  if (!g.last || !g.intervalWeeks) return "";
  return addDaysStr(g.last, Number(g.intervalWeeks) * 7);
}

// Routine care tasks (brushing, weigh-ins, food runs, remedies…)
function taskNextDue(t) {
  if (!t.last || !t.interval) return "";
  const n = Number(t.interval);
  if (t.unit === "months") return addMonthsStr(t.last, n);
  if (t.unit === "weeks") return addDaysStr(t.last, n * 7);
  return addDaysStr(t.last, n); // days
}

function taskIcon(name = "") {
  const n = name.toLowerCase();
  if (/teeth|tooth|dental/.test(n)) return "🪥";
  if (/brush|comb/.test(n)) return "🪮";
  if (/weig|scale/.test(n)) return "⚖️";
  if (/food|feed|kibble/.test(n)) return "🍖";
  if (/bath|wash|shampoo/.test(n)) return "🛁";
  if (/flea|tick|worm|remed|drop/.test(n)) return "💧";
  if (/nail|claw/.test(n)) return "💅";
  if (/walk|exercise/.test(n)) return "🚶";
  return "📌";
}

function taskIntervalText(t) {
  if (!t.interval) return "no schedule";
  const n = Number(t.interval);
  const unit = (t.unit || "days").replace(/s$/, "");
  return `every ${n} ${unit}${n === 1 ? "" : "s"}`;
}

// Everything with a due date for one dog:
// [{ kind, icon, label, due, dogId, dogName }]
function dueItems(dog) {
  const items = [];
  for (const m of dog.medications || []) {
    if (m.nextDue) items.push({
      kind: "med", icon: "💊",
      label: `${m.name}${m.dose ? " — " + m.dose : ""}`,
      due: m.nextDue, dogId: dog.id, dogName: dog.name, itemId: m.id,
    });
  }
  for (const v of dog.vaccinations || []) {
    if (v.nextDue) items.push({
      kind: "vax", icon: "💉",
      label: `${v.name} vaccine`,
      due: v.nextDue, dogId: dog.id, dogName: dog.name,
    });
  }
  const g = groomingNextDue(dog);
  if (g) items.push({
    kind: "groom", icon: "✂️",
    label: "Grooming",
    due: g, dogId: dog.id, dogName: dog.name,
  });
  for (const t of dog.careTasks || []) {
    const due = taskNextDue(t);
    if (due) items.push({
      kind: "task", icon: taskIcon(t.name),
      label: t.name, itemId: t.id,
      due, dogId: dog.id, dogName: dog.name,
    });
  }
  return items;
}

function dueStatus(dateStr) {
  const d = daysUntil(dateStr);
  if (d === null) return "";
  if (d < 0) return "overdue";
  if (d <= DUE_SOON_DAYS) return "soon";
  return "ok";
}

function dueLabel(dateStr) {
  const d = daysUntil(dateStr);
  if (d === null) return "";
  if (d < 0) return `Overdue — was ${fmtDateShort(dateStr)}`;
  if (d === 0) return "Due today";
  if (d === 1) return "Due tomorrow";
  if (d <= DUE_SOON_DAYS) return `Due ${fmtDateShort(dateStr)}`;
  return `Next: ${fmtDate(dateStr)}`;
}

function dueChip(dateStr) {
  const s = dueStatus(dateStr);
  if (!s) return "";
  return `<span class="chip ${s}">${esc(dueLabel(dateStr))}</span>`;
}

function allDueSoon() {
  const all = [];
  for (const dog of state.dogs) {
    for (const it of dueItems(dog)) {
      const s = dueStatus(it.due);
      if (s === "overdue" || s === "soon") all.push(it);
    }
  }
  all.sort((a, b) => a.due.localeCompare(b.due));
  return all;
}

// ---------------- blank dog / seeding ----------------

function blankDog(name, order) {
  return {
    name,
    order,
    photo: "",
    breed: "",
    birthday: "",
    weight: "",
    allergies: [],
    medications: [],
    careTasks: [],
    grooming: { last: "", intervalWeeks: "" },
    vaccinations: [],
    vetVisits: [],
    feeding: [],
    contacts: { vetName: "", vetPhone: "", groomerName: "", groomerPhone: "" },
    notes: "",
    createdAt: Date.now(),
  };
}

async function seedStarterDogs() {
  if (state.seeding) return;
  state.seeding = true;
  // Only seed once ever — if you deliberately delete every dog later,
  // they shouldn't come back from the dead.
  const famRef = doc(db, "families", FAMILY_ID);
  const fam = await getDoc(famRef);
  if (fam.exists() && fam.data().seeded) return;
  // Fixed doc IDs make this safe even if both phones seed at once.
  await Promise.all(
    STARTER_DOGS.map((name, i) =>
      setDoc(dogRef(name.toLowerCase()), blankDog(name, i), { merge: true })
    )
  );
  await setDoc(famRef, { seeded: true }, { merge: true });
}

// ---------------- live data ----------------

function startListening() {
  onSnapshot(
    dogsCol,
    (snap) => {
      state.loaded = true;
      state.error = null;
      state.dogs = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (a.order ?? 99) - (b.order ?? 99) || a.name.localeCompare(b.name));
      if (snap.empty) seedStarterDogs();
      render();
      maybeNotify();
    },
    (err) => {
      console.error("Firestore listener error:", err);
      state.error = err;
      render();
    }
  );
}

// ---------------- rendering ----------------

let pendingRender = false;
let lastRenderedHash = null;

function isTypingInApp() {
  const ae = document.activeElement;
  return !!ae && appEl.contains(ae) &&
    ["INPUT", "TEXTAREA", "SELECT"].includes(ae.tagName);
}

function render() {
  // Don't repaint under someone's thumbs — wait until the field blurs.
  if (isTypingInApp()) { pendingRender = true; return; }
  pendingRender = false;

  const hash = location.hash || "#/";
  // Keep scroll position on live updates; jump to top only when navigating.
  const keepScroll = hash === lastRenderedHash ? window.scrollY : 0;
  let screen;
  if (state.error) {
    screen = renderError();
  } else if (!state.loaded) {
    screen = `<div class="loading">🐾 Loading the pack…</div>`;
  } else if (hash.startsWith("#/dog/")) {
    screen = renderDog(decodeURIComponent(hash.slice(6)));
  } else if (hash === "#/due") {
    screen = renderDueSoon();
  } else {
    screen = renderHome();
  }
  appEl.innerHTML = screen;

  // tab bar state
  tabbar.hidden = !state.loaded && !state.error;
  $("#tab-home").classList.toggle("active", !hash.startsWith("#/due"));
  $("#tab-due").classList.toggle("active", hash === "#/due");
  const badge = $("#due-badge");
  const n = state.loaded ? allDueSoon().length : 0;
  badge.hidden = n === 0;
  badge.textContent = n;

  window.scrollTo(0, keepScroll);
  lastRenderedHash = hash;
}

function renderError() {
  return `<div class="setup-card">
    <h1>😿 Can't reach the database</h1>
    <p>The app connected to Firebase but was turned away. Usually this means the
    <b>Firestore security rules</b> haven't been published yet (see the README),
    or the device is offline.</p>
    <p style="color:var(--muted);font-size:13.5px">${esc(state.error?.message || "")}</p>
  </div>`;
}

function renderSetup() {
  return `<div class="setup-card">
    <h1>🐾 Almost there!</h1>
    <p>This app needs its Firebase config before it can store anything.</p>
    <p>Open <code>firebase-config.js</code> and replace the placeholder values
    with the config block from your Firebase project — the README walks
    through it click by click.</p>
  </div>`;
}

// ----- home -----

function renderHome() {
  const banner =
    "Notification" in window && Notification.permission === "default"
      ? `<div class="notif-banner">🔔 Get a heads-up when something's due
           <button data-action="enable-notifs">Turn on</button></div>`
      : "";

  const cards = state.dogs.map((dog) => {
    const items = dueItems(dog);
    const overdue = items.filter((i) => dueStatus(i.due) === "overdue").length;
    const soon = items.filter((i) => dueStatus(i.due) === "soon").length;
    let chip = `<span class="chip ok">All good</span>`;
    if (overdue) chip = `<span class="chip overdue">❗ ${overdue} overdue</span>`;
    else if (soon) chip = `<span class="chip soon">${soon} due soon</span>`;
    return `<button class="dog-card" data-action="open-dog" data-id="${esc(dog.id)}">
      ${photoHtml(dog, "dog-photo")}
      <div class="dog-card-body">
        <div class="dog-card-name">${esc(dog.name)}</div>
        ${chip}
      </div>
    </button>`;
  }).join("");

  return `
    <header class="screen-head"><div>
      <h1>Our Pack 🐾</h1>
      <div class="sub">${state.dogs.length} dog${state.dogs.length === 1 ? "" : "s"} · tap one to see everything</div>
    </div></header>
    ${banner}
    <div class="dog-grid">
      ${cards}
      <button class="add-dog-card" data-action="add-dog"><span class="plus">＋</span>Add a dog</button>
    </div>`;
}

// ----- dog detail -----

function renderDog(id) {
  const dog = state.dogs.find((d) => d.id === id);
  if (!dog) return `<div class="empty-note">This pup wasn't found. <a href="#/">Back home</a></div>`;

  const g = dog.grooming || {};
  const groomNext = groomingNextDue(dog);
  const c = dog.contacts || {};

  const medRows = (dog.medications || []).map((m) => `
    <div class="item-row">
      <button class="item-main" data-action="edit-med" data-id="${esc(m.id)}">
        <div class="item-title">💊 ${esc(m.name)}</div>
        <div class="item-sub">${esc([m.dose, m.schedule, m.lastDone ? "✓ given " + fmtDate(m.lastDone) : ""].filter(Boolean).join(" · "))}</div>
        ${m.nextDue ? dueChip(m.nextDue) : ""}
      </button>
      <div class="row-actions">
        ${doneBtn(dog.id, "med", m.id)}
        ${m.nextDue ? calBtn(dog, `💊 ${m.name}`, m.nextDue, `Give ${dog.name} ${m.name}${m.dose ? " (" + m.dose + ")" : ""}`) : ""}
      </div>
    </div>`).join("");

  const taskRows = (dog.careTasks || []).map((t) => {
    const due = taskNextDue(t);
    return `
    <div class="item-row">
      <button class="item-main" data-action="edit-task" data-id="${esc(t.id)}">
        <div class="item-title">${taskIcon(t.name)} ${esc(t.name)}</div>
        <div class="item-sub">${esc([taskIntervalText(t), t.last ? "✓ done " + fmtDate(t.last) : "not done yet"].join(" · "))}</div>
        ${due ? dueChip(due) : ""}
      </button>
      <div class="row-actions">
        ${doneBtn(dog.id, "task", t.id)}
        ${due ? calBtn(dog, `${taskIcon(t.name)} ${t.name}`, due, `${dog.name}: ${t.name}`) : ""}
      </div>
    </div>`;
  }).join("");

  const vaxRows = (dog.vaccinations || []).map((v) => `
    <div class="item-row">
      <button class="item-main" data-action="edit-vax" data-id="${esc(v.id)}">
        <div class="item-title">💉 ${esc(v.name)}</div>
        <div class="item-sub">${v.given ? "Given " + fmtDate(v.given) : "Not given yet"}</div>
        ${v.nextDue ? dueChip(v.nextDue) : ""}
      </button>
      ${v.nextDue ? calBtn(dog, `💉 ${v.name} vaccine`, v.nextDue, `${dog.name}'s ${v.name} vaccine is due`) : ""}
    </div>`).join("");

  const visitRows = (dog.vetVisits || [])
    .slice()
    .sort((a, b) => (b.date || "").localeCompare(a.date || ""))
    .map((v) => `
    <div class="item-row">
      <button class="item-main" data-action="edit-visit" data-id="${esc(v.id)}">
        <div class="item-title">${esc(v.reason || "Vet visit")}</div>
        <div class="item-sub">${fmtDate(v.date) || "No date"}</div>
        ${v.notes ? `<div class="item-notes">${esc(v.notes)}</div>` : ""}
      </button>
    </div>`).join("");

  const feedRows = (dog.feeding || [])
    .slice()
    .sort((a, b) => (a.time || "").localeCompare(b.time || ""))
    .map((f) => `
    <div class="item-row">
      <button class="item-main" data-action="edit-feed" data-id="${esc(f.id)}">
        <div class="item-title">🍽 ${esc(f.time ? fmtTime(f.time) : "Anytime")}</div>
        <div class="item-sub">${esc(f.amount)}</div>
      </button>
    </div>`).join("");

  const allergyChips = (dog.allergies || []).map((a, i) => `
    <span class="allergy-chip">${esc(a)}
      <button data-action="del-allergy" data-i="${i}" aria-label="Remove ${esc(a)}">✕</button>
    </span>`).join("");

  return `
    <header class="screen-head">
      <button class="back-btn" data-action="back">‹ Back</button>
    </header>

    <div class="hero">
      ${photoHtml(dog, "dog-photo")}
      <button class="photo-btn" data-action="change-photo">📷 ${dog.photo ? "Change" : "Add"} photo</button>
    </div>

    <div class="dog-name-row">
      <input data-field="name" value="${esc(dog.name)}" aria-label="Name">
      <span class="dog-age">${ageText(dog.birthday)}</span>
    </div>

    <div class="card">
      <h3>🐶 Basics</h3>
      <div class="field-row"><label>Breed</label><input data-field="breed" value="${esc(dog.breed)}" placeholder="e.g. Golden Retriever"></div>
      <div class="field-row"><label>Birthday</label><input type="date" data-field="birthday" value="${esc(dog.birthday)}"></div>
      <div class="field-row"><label>Weight</label><input data-field="weight" value="${esc(dog.weight)}" placeholder="e.g. 52 lb"></div>
    </div>

    <div class="card">
      <h3>⚠️ Allergies</h3>
      <div class="chip-list">${allergyChips || `<span class="item-sub">None known 🎉</span>`}</div>
      <div class="allergy-add">
        <input id="allergy-input" placeholder="Add an allergy…" enterkeyhint="done">
        <button data-action="add-allergy">Add</button>
      </div>
    </div>

    <div class="card">
      <h3>💊 Medications</h3>
      <div class="item-list">${medRows || `<span class="item-sub">No medications</span>`}</div>
      <button class="add-item-btn" data-action="add-med">＋ Add medication</button>
    </div>

    <div class="card">
      <h3>🪮 Routine care</h3>
      <div class="item-list">${taskRows || `<span class="item-sub">Brushing, weigh-ins, food runs, remedies… add one below.</span>`}</div>
      <button class="add-item-btn" data-action="add-task">＋ Add care task</button>
    </div>

    <div class="card">
      <h3>✂️ Grooming</h3>
      <div class="field-row"><label>Last done</label><input type="date" data-field="grooming.last" value="${esc(g.last)}"></div>
      <div class="field-row"><label>Every</label>
        <input type="number" min="1" max="52" inputmode="numeric" data-field="grooming.intervalWeeks" data-type="number" value="${esc(g.intervalWeeks)}" style="max-width:90px">
        <span class="hint">weeks</span>
      </div>
      ${groomNext ? `<div class="field-row"><label>Next due</label>
        <div>${dueChip(groomNext)}</div>
        <div class="row-actions">
          ${doneBtn(dog.id, "groom")}
          ${calBtn(dog, "✂️ Grooming", groomNext, `${dog.name} is due for grooming`)}
        </div>
      </div>` : `<div class="item-sub">Set a date + interval and I'll work out the next one.</div>`}
    </div>

    <div class="card">
      <h3>💉 Vaccinations</h3>
      <div class="item-list">${vaxRows || `<span class="item-sub">Nothing recorded yet</span>`}</div>
      <button class="add-item-btn" data-action="add-vax">＋ Add vaccination</button>
    </div>

    <div class="card">
      <h3>🩺 Vet visits</h3>
      <div class="item-list">${visitRows || `<span class="item-sub">No visits recorded</span>`}</div>
      <button class="add-item-btn" data-action="add-visit">＋ Add vet visit</button>
    </div>

    <div class="card">
      <h3>🍽 Feeding</h3>
      <div class="item-list">${feedRows || `<span class="item-sub">No feeding times yet</span>`}</div>
      <button class="add-item-btn" data-action="add-feed">＋ Add feeding time</button>
    </div>

    <div class="card">
      <h3>📇 Contacts</h3>
      <div class="field-row"><label>Vet</label><input data-field="contacts.vetName" value="${esc(c.vetName)}" placeholder="Vet's name"></div>
      <div class="field-row"><label>Phone</label><input type="tel" data-field="contacts.vetPhone" value="${esc(c.vetPhone)}" placeholder="Vet's phone">${telLink(c.vetPhone)}</div>
      <div class="field-row"><label>Groomer</label><input data-field="contacts.groomerName" value="${esc(c.groomerName)}" placeholder="Groomer's name"></div>
      <div class="field-row"><label>Phone</label><input type="tel" data-field="contacts.groomerPhone" value="${esc(c.groomerPhone)}" placeholder="Groomer's phone">${telLink(c.groomerPhone)}</div>
    </div>

    <div class="card">
      <h3>📝 Notes</h3>
      <textarea data-field="notes" placeholder="Anything worth remembering…">${esc(dog.notes)}</textarea>
    </div>

    <button class="danger-btn" data-action="delete-dog">Remove ${esc(dog.name)} from the app</button>`;
}

function telLink(phone) {
  if (!phone) return "";
  return `<a href="tel:${esc(phone.replace(/[^+\d]/g, ""))}" aria-label="Call">📞</a>`;
}

function fmtTime(t) {
  const [h, m] = (t || "").split(":").map(Number);
  if (isNaN(h)) return t;
  const am = h < 12;
  const hr = h % 12 === 0 ? 12 : h % 12;
  return `${hr}:${String(m).padStart(2, "0")} ${am ? "AM" : "PM"}`;
}

function calBtn(dog, title, dateStr, description) {
  return `<button class="cal-btn" data-action="ics"
    data-title="${esc(title)}" data-date="${esc(dateStr)}"
    data-dog="${esc(dog.name)}" data-desc="${esc(description)}">🗓 Add to<br>calendar</button>`;
}

function doneBtn(dogId, kind, itemId = "") {
  return `<button class="done-btn" data-action="done" data-dog-id="${esc(dogId)}"
    data-kind="${kind}" data-id="${esc(itemId)}">✓ Done</button>`;
}

// ----- due soon -----

function renderDueSoon() {
  const items = allDueSoon();
  const rows = items.map((it) => {
    const dog = state.dogs.find((d) => d.id === it.dogId) || { name: it.dogName };
    const s = dueStatus(it.due);
    return `<div class="due-item">
      ${photoHtml(dog, "due-thumb")}
      <div class="due-info">
        <div class="dog">${esc(it.dogName)}</div>
        <div class="what">${it.icon} ${esc(it.label)}</div>
        <div class="when ${s}">${esc(dueLabel(it.due))}</div>
      </div>
      <div class="row-actions">
        ${it.kind !== "vax" ? doneBtn(it.dogId, it.kind, it.itemId || "") : ""}
        ${calBtn(dog, `${it.icon} ${it.label}`, it.due, `${it.dogName}: ${it.label}`)}
      </div>
    </div>`;
  }).join("");

  return `
    <header class="screen-head"><div>
      <h1>Due Soon 📅</h1>
      <div class="sub">Overdue + the next ${DUE_SOON_DAYS} days, all dogs</div>
    </div></header>
    ${rows || `<div class="empty-note">Nothing due in the next two weeks.<br>Good humans! 🎉</div>`}`;
}

// ---------------- writes ----------------

function currentDogId() {
  const hash = location.hash;
  return hash.startsWith("#/dog/") ? decodeURIComponent(hash.slice(6)) : null;
}

function currentDog() {
  return state.dogs.find((d) => d.id === currentDogId());
}

async function saveFieldFor(dogId, path, value) {
  if (!dogId) return;
  try {
    await updateDoc(dogRef(dogId), { [path]: value });
  } catch (e) {
    console.error("Save failed:", e);
    alert("Couldn't save — are you online?");
  }
}

async function saveField(path, value) {
  await saveFieldFor(currentDogId(), path, value);
}

async function saveList(listName, newList) {
  await saveField(listName, newList);
}

// "✓ Done" — stamp today and roll the next due date forward.
async function markDone(dogId, kind, itemId) {
  const dog = state.dogs.find((d) => d.id === dogId);
  if (!dog) return;
  const t = todayStr();
  if (kind === "groom") {
    await saveFieldFor(dogId, "grooming.last", t);
  } else if (kind === "task") {
    const next = (dog.careTasks || []).map((x) => (x.id === itemId ? { ...x, last: t } : x));
    await saveFieldFor(dogId, "careTasks", next);
  } else if (kind === "med") {
    const next = (dog.medications || []).map((m) =>
      m.id === itemId
        ? {
            ...m,
            lastDone: t,
            // With a repeat interval the next dose schedules itself;
            // without one, the reminder clears until you set a new date.
            nextDue: m.repeatDays ? addDaysStr(t, Number(m.repeatDays)) : "",
          }
        : m
    );
    await saveFieldFor(dogId, "medications", next);
  }
}

// ---------------- photo handling ----------------

// Photos are stored right inside the Firestore document as a small
// data URL. We resize to ~400px wide first so it stays far below
// Firestore's 1 MB document limit (no Firebase Storage / billing).
const photoInput = document.createElement("input");
photoInput.type = "file";
photoInput.accept = "image/*";
photoInput.style.display = "none";
document.body.appendChild(photoInput);

photoInput.addEventListener("change", async () => {
  const file = photoInput.files[0];
  photoInput.value = "";
  if (!file) return;
  try {
    const dataUrl = await resizeImage(file, 400, 0.72);
    if (dataUrl.length > 900_000) {
      alert("That photo is too large even after resizing — please try a different one.");
      return;
    }
    await saveField("photo", dataUrl);
  } catch (e) {
    console.error(e);
    alert("Couldn't read that image, sorry. Try another photo?");
  }
});

function resizeImage(file, maxW, quality) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, maxW / img.width);
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      canvas.getContext("2d").drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("bad image")); };
    img.src = url;
  });
}

// ---------------- calendar (.ics) hand-off ----------------

function downloadIcs({ title, date, dog, desc }) {
  const d = date.replace(/-/g, "");
  const dEnd = addDaysStr(date, 1).replace(/-/g, "");
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const summary = `${dog}: ${title}`.replace(/<br>/g, " ");
  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Our Dogs//Family Dog Tracker//EN",
    "BEGIN:VEVENT",
    `UID:${uid()}@ourdogs`,
    `DTSTAMP:${stamp}`,
    `DTSTART;VALUE=DATE:${d}`,
    `DTEND;VALUE=DATE:${dEnd}`,
    `SUMMARY:${icsEscape(summary)}`,
    `DESCRIPTION:${icsEscape(desc || "")}`,
    "BEGIN:VALARM",
    "ACTION:DISPLAY",
    `DESCRIPTION:${icsEscape(summary)}`,
    "TRIGGER:PT9H",           // pops at 9:00 AM on the day
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");

  const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = summary.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40) + ".ics";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

const icsEscape = (s) => String(s).replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");

// ---------------- browser notifications (best-effort) ----------------

let notifiedThisOpen = false;

async function maybeNotify() {
  if (notifiedThisOpen || !state.loaded) return;
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  const items = allDueSoon();
  if (!items.length) return;
  notifiedThisOpen = true;
  const overdue = items.filter((i) => dueStatus(i.due) === "overdue").length;
  const title = overdue
    ? `🐾 ${overdue} thing${overdue === 1 ? " is" : "s are"} overdue!`
    : `🐾 ${items.length} thing${items.length === 1 ? "" : "s"} due soon`;
  const body = items.slice(0, 3).map((i) => `${i.dogName}: ${i.label} (${dueLabel(i.due)})`).join("\n");
  try {
    // Android Chrome only allows notifications via a service worker.
    // (.ready never settles if registration failed, hence the timeout.)
    const reg = await Promise.race([
      navigator.serviceWorker?.ready,
      new Promise((r) => setTimeout(() => r(null), 1500)),
    ]);
    if (reg) { reg.showNotification(title, { body }); return; }
  } catch { /* fall through */ }
  try { new Notification(title, { body }); } catch { /* best-effort only */ }
}

// ---------------- modals ----------------

function openModal(html) {
  modalRoot.innerHTML = `<div class="modal-backdrop"><div class="modal">${html}</div></div>`;
  modalRoot.querySelector(".modal-backdrop").addEventListener("click", (e) => {
    if (e.target === e.currentTarget) closeModal();
  });
}
function closeModal() { modalRoot.innerHTML = ""; }

function field(label, inner) {
  return `<div class="field"><label>${label}</label>${inner}</div>`;
}

function modalActions(canDelete) {
  return `<div class="modal-actions">
      <button class="btn-secondary" data-m="cancel">Cancel</button>
      <button class="btn-primary" data-m="save">Save</button>
    </div>
    ${canDelete ? `<button class="btn-delete" data-m="delete">Delete</button>` : ""}`;
}

// Generic list-item editor: meds, vaccinations, visits, feeding.
function listItemModal({ title, item, fieldsHtml, readForm, listName, list }) {
  openModal(`<h2>${title}</h2>${fieldsHtml}${modalActions(!!item)}`);
  const modal = modalRoot.querySelector(".modal");
  modal.querySelector('[data-m="cancel"]').onclick = closeModal;
  modal.querySelector('[data-m="save"]').onclick = async () => {
    const values = readForm(modal);
    if (values === null) return; // validation failed
    let next;
    if (item) {
      next = list.map((x) => (x.id === item.id ? { ...x, ...values } : x));
    } else {
      next = [...list, { id: uid(), ...values }];
    }
    closeModal();
    await saveList(listName, next);
  };
  const del = modal.querySelector('[data-m="delete"]');
  if (del) del.onclick = async () => {
    if (!confirm("Delete this entry?")) return;
    closeModal();
    await saveList(listName, list.filter((x) => x.id !== item.id));
  };
  const first = modal.querySelector("input, textarea");
  if (first && !item) first.focus();
}

function medModal(dog, med) {
  listItemModal({
    title: med ? "Edit medication" : "Add medication",
    item: med,
    list: dog.medications || [],
    listName: "medications",
    fieldsHtml:
      field("Name", `<input id="m-name" value="${esc(med?.name)}" placeholder="e.g. Heartworm chew">`) +
      field("Dose", `<input id="m-dose" value="${esc(med?.dose)}" placeholder="e.g. 1 tablet">`) +
      field("Schedule", `<input id="m-sched" value="${esc(med?.schedule)}" placeholder='e.g. "twice daily" or "1st of month"'>`) +
      field("Next due", `<input type="date" id="m-due" value="${esc(med?.nextDue)}">`) +
      field("Repeats every … days (optional)",
        `<input type="number" min="1" max="365" inputmode="numeric" id="m-repeat" value="${esc(med?.repeatDays)}" placeholder="e.g. 30 for monthly">
         <div class="field-hint">With this set, tapping ✓ Done automatically schedules the next dose.</div>`),
    readForm: (m) => {
      const name = $("#m-name", m).value.trim();
      if (!name) { alert("Give the medication a name."); return null; }
      const rep = $("#m-repeat", m).value;
      return {
        name,
        dose: $("#m-dose", m).value.trim(),
        schedule: $("#m-sched", m).value.trim(),
        nextDue: $("#m-due", m).value,
        repeatDays: rep === "" ? "" : Number(rep),
      };
    },
  });
}

function vaxModal(dog, vax) {
  listItemModal({
    title: vax ? "Edit vaccination" : "Add vaccination",
    item: vax,
    list: dog.vaccinations || [],
    listName: "vaccinations",
    fieldsHtml:
      field("Vaccine", `<input id="v-name" value="${esc(vax?.name)}" placeholder="e.g. Rabies">`) +
      field("Date given", `<input type="date" id="v-given" value="${esc(vax?.given)}">`) +
      field("Next due", `<input type="date" id="v-due" value="${esc(vax?.nextDue)}">`),
    readForm: (m) => {
      const name = $("#v-name", m).value.trim();
      if (!name) { alert("Give the vaccine a name."); return null; }
      return { name, given: $("#v-given", m).value, nextDue: $("#v-due", m).value };
    },
  });
}

function visitModal(dog, visit) {
  listItemModal({
    title: visit ? "Edit vet visit" : "Add vet visit",
    item: visit,
    list: dog.vetVisits || [],
    listName: "vetVisits",
    fieldsHtml:
      field("Date", `<input type="date" id="vv-date" value="${esc(visit?.date)}">`) +
      field("Reason", `<input id="vv-reason" value="${esc(visit?.reason)}" placeholder="e.g. Annual checkup">`) +
      field("Notes", `<textarea id="vv-notes" placeholder="What did the vet say?">${esc(visit?.notes)}</textarea>`),
    readForm: (m) => {
      const reason = $("#vv-reason", m).value.trim();
      if (!reason) { alert("What was the visit for?"); return null; }
      return { date: $("#vv-date", m).value, reason, notes: $("#vv-notes", m).value.trim() };
    },
  });
}

function feedModal(dog, feed) {
  listItemModal({
    title: feed ? "Edit feeding time" : "Add feeding time",
    item: feed,
    list: dog.feeding || [],
    listName: "feeding",
    fieldsHtml:
      field("Time", `<input type="time" id="f-time" value="${esc(feed?.time)}">`) +
      field("Amount / food", `<input id="f-amount" value="${esc(feed?.amount)}" placeholder="e.g. 1 cup kibble + salmon oil">`),
    readForm: (m) => {
      const amount = $("#f-amount", m).value.trim();
      if (!amount) { alert("What do they get fed?"); return null; }
      return { time: $("#f-time", m).value, amount };
    },
  });
}

const TASK_SUGGESTIONS = ["Brushing", "Teeth brushing", "Weigh-in", "Buy food", "Bath", "Flea remedy", "Nail trim"];

function taskModal(dog, task) {
  const chips = task ? "" :
    `<div class="suggest-row">` +
    TASK_SUGGESTIONS.map((s) =>
      `<button type="button" class="suggest-chip" data-suggest="${esc(s)}">${taskIcon(s)} ${esc(s)}</button>`).join("") +
    `</div>`;
  listItemModal({
    title: task ? "Edit care task" : "Add care task",
    item: task,
    list: dog.careTasks || [],
    listName: "careTasks",
    fieldsHtml:
      field("What", `<input id="t-name" value="${esc(task?.name)}" placeholder="e.g. Brushing, Weigh-in, Buy food…">${chips}`) +
      field("How often", `<div class="interval-row">
          <input type="number" min="1" max="365" inputmode="numeric" id="t-interval" value="${esc(task?.interval)}" placeholder="2">
          <select id="t-unit">
            <option value="days" ${task?.unit === "days" ? "selected" : ""}>days</option>
            <option value="weeks" ${!task || task?.unit === "weeks" ? "selected" : ""}>weeks</option>
            <option value="months" ${task?.unit === "months" ? "selected" : ""}>months</option>
          </select>
        </div>`) +
      field("Last done", `<input type="date" id="t-last" value="${esc(task?.last)}">`),
    readForm: (m) => {
      const name = $("#t-name", m).value.trim();
      if (!name) { alert("What's the task called?"); return null; }
      return {
        name,
        interval: $("#t-interval", m).value === "" ? "" : Number($("#t-interval", m).value),
        unit: $("#t-unit", m).value,
        last: $("#t-last", m).value,
      };
    },
  });
  // suggestion chips fill the name box
  modalRoot.querySelectorAll(".suggest-chip").forEach((c) => {
    c.onclick = () => { const i = $("#t-name", modalRoot); i.value = c.dataset.suggest; i.focus(); };
  });
}

function addDogModal() {
  openModal(`<h2>Add a dog 🐶</h2>
    ${field("Name", `<input id="d-name" placeholder="Their name">`)}
    ${field("Breed (optional)", `<input id="d-breed" placeholder="e.g. Husky mix">`)}
    ${modalActions(false)}`);
  const modal = modalRoot.querySelector(".modal");
  modal.querySelector('[data-m="cancel"]').onclick = closeModal;
  modal.querySelector('[data-m="save"]').onclick = async () => {
    const name = $("#d-name", modal).value.trim();
    if (!name) { alert("Every dog needs a name!"); return; }
    const d = blankDog(name, state.dogs.length);
    d.breed = $("#d-breed", modal).value.trim();
    const id = name.toLowerCase().replace(/[^a-z0-9]+/g, "-") + "-" + uid().slice(0, 4);
    closeModal();
    await setDoc(dogRef(id), d);
    location.hash = `#/dog/${id}`;
  };
  $("#d-name", modal).focus();
}

// ---------------- event wiring ----------------

appEl.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-action]");
  if (!btn) return;
  const dog = currentDog();
  const findIn = (list) => (list || []).find((x) => x.id === btn.dataset.id);

  switch (btn.dataset.action) {
    case "open-dog": location.hash = `#/dog/${btn.dataset.id}`; break;
    case "back": location.hash = "#/"; break;
    case "add-dog": addDogModal(); break;

    case "add-med": medModal(dog, null); break;
    case "edit-med": medModal(dog, findIn(dog?.medications)); break;
    case "add-vax": vaxModal(dog, null); break;
    case "edit-vax": vaxModal(dog, findIn(dog?.vaccinations)); break;
    case "add-visit": visitModal(dog, null); break;
    case "edit-visit": visitModal(dog, findIn(dog?.vetVisits)); break;
    case "add-feed": feedModal(dog, null); break;
    case "edit-feed": feedModal(dog, findIn(dog?.feeding)); break;
    case "add-task": taskModal(dog, null); break;
    case "edit-task": taskModal(dog, findIn(dog?.careTasks)); break;

    case "done": markDone(btn.dataset.dogId, btn.dataset.kind, btn.dataset.id); break;

    case "add-allergy": {
      const input = $("#allergy-input");
      const val = input.value.trim();
      if (!val || !dog) break;
      input.value = "";
      saveList("allergies", [...(dog.allergies || []), val]);
      break;
    }
    case "del-allergy": {
      if (!dog) break;
      const next = (dog.allergies || []).filter((_, i) => i !== Number(btn.dataset.i));
      saveList("allergies", next);
      break;
    }

    case "change-photo": photoInput.click(); break;

    case "ics": downloadIcs({
      title: btn.dataset.title, date: btn.dataset.date,
      dog: btn.dataset.dog, desc: btn.dataset.desc,
    }); break;

    case "enable-notifs":
      Notification.requestPermission().then(() => { render(); maybeNotify(); });
      break;

    case "delete-dog":
      if (dog && confirm(`Remove ${dog.name} and all their records? This can't be undone.`)) {
        location.hash = "#/";
        deleteDoc(dogRef(dog.id));
      }
      break;
  }
});

// Inline field saves (breed, weight, dates, contacts, notes, name…)
appEl.addEventListener("change", (e) => {
  const el = e.target;
  const path = el.dataset.field;
  if (!path) return;
  let value = el.value;
  if (el.dataset.type === "number") value = value === "" ? "" : Number(value);
  if (path === "name" && !String(value).trim()) return; // never blank the name
  saveField(path, typeof value === "string" ? value.trim() : value);
});

// Enter key adds an allergy
appEl.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && e.target.id === "allergy-input") {
    e.preventDefault();
    $('[data-action="add-allergy"]')?.click();
  }
});

// If a live update arrived while typing, repaint once the field blurs.
appEl.addEventListener("focusout", () => {
  setTimeout(() => { if (pendingRender && !isTypingInApp()) render(); }, 60);
});

window.addEventListener("hashchange", () => {
  closeModal();
  render();
});

// ---------------- boot ----------------

if (!configReady) {
  appEl.innerHTML = renderSetup();
  tabbar.hidden = true;
} else {
  if ("serviceWorker" in navigator) {
    // Registration is best-effort; the app works fine without it.
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  }
  startListening();
}
