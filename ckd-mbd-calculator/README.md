# CKD-MBD Management Planner

A single-file, client-side web app that generates a **CKD–Mineral and Bone Disorder (CKD-MBD)** management plan aligned with the **KDIGO 2017 CKD-MBD guideline update** (plus 2018/2024 guidance). Enter the patient's modality and labs and it returns, with a one-line rationale for each:

- **Phosphate binder** — choice + starting dose
- **Active vitamin D** (calcitriol / paricalcitol / doxercalciferol) — choice + dose, or *"none indicated"*
- **Calcimimetic** (cinacalcet / etelcalcetide) — choice + dose, or *"none indicated"*

…plus the KDIGO target ranges being used, safety flags, a set of verification checks, and a monitoring schedule.

> ⚠️ **Clinical decision support only — not a prescription.** Output is educational and must be verified against the full KDIGO guideline, current drug labels, and the individual patient by a qualified clinician. Assay upper-normal limits and dialysate calcium vary by lab/unit. The tool does **not** address dialysis prescription, bone-biopsy interpretation, or care outside CKD-MBD.

## Features

- **100% client-side.** No backend, no login, no build step, no data leaves the browser — safe to host as a static page.
- **Modality-aware logic.** Non-dialysis CKD (by stage), hemodialysis, and peritoneal dialysis use different targets and first-line agents (e.g. etelcalcetide is offered only for HD; calcimimetics are not offered in non-dialysis CKD).
- **Paired slider + number input** for each lab value (phosphorus, corrected calcium, iPTH, 25-OH vitamin D).
- **Built-in safety rules:**
  - Always displays the **KDIGO target range** in use for each parameter.
  - **Flags hypercalcemia** before recommending calcium-based binders or active vitamin D.
  - **Never recommends a calcimimetic below the safe calcium threshold** (corrected Ca ≥ 8.4 mg/dL; etelcalcetide ≥ 8.3) — and shows the threshold used.
  - Detects low-turnover / adynamic-bone signals and avoids over-suppressing PTH.
- **Verification pass** before results render: confirms the plan matches the modality, that the calcium load is appropriate for the calcium level, and that the PTH level justifies starting/adjusting a vitamin D analog or calcimimetic.
- Mobile-responsive, dark UI.

## Targets used (KDIGO)

| Parameter | Range used |
|---|---|
| Serum phosphate | Toward normal **2.5–4.5 mg/dL** (treat persistent/progressive elevation) |
| Corrected calcium | **8.5–10.2 mg/dL**; avoid hypercalcemia |
| iPTH — dialysis (G5D) | **~2–9× assay ULN** (≈130–585 pg/mL at ULN 65) |
| iPTH — non-dialysis | No fixed target; treat modifiable factors when progressively/persistently above ULN |
| 25-OH vitamin D | **≥30 ng/mL** sufficient (<20 deficient, 20–30 insufficient) |
| Calcimimetic calcium floor | Corrected Ca **≥ 8.4 mg/dL** to initiate (etelcalcetide ≥ 8.3) |

Assay upper-normal limit is assumed at ~65 pg/mL; adjust to your lab.

## Run locally

It's a single static file — just open it:

```bash
# from this folder
open index.html          # macOS
xdg-open index.html      # Linux
# or double-click the file in a file browser
```

No dependencies, no `npm install`, nothing to build.

## Deploy to GitHub Pages

This app lives in the `ckd-mbd-calculator/` folder of the repository. Two easy options:

### Option A — serve the whole repo (folder path)

1. Push the repository to GitHub.
2. In the repo, go to **Settings → Pages**.
3. Under **Build and deployment**, set **Source = "Deploy from a branch"**.
4. Choose the branch (e.g. `main`) and folder **`/ (root)`**, then **Save**.
5. After a minute your site is live; the calculator is at:
   `https://<your-username>.github.io/<repo-name>/ckd-mbd-calculator/`

### Option B — make it the site root (dedicated repo or `/docs`)

- **Dedicated repo:** put `index.html` at the repository root and enable Pages with folder **`/ (root)`**. The app is then served at `https://<your-username>.github.io/<repo-name>/`.
- **`/docs` folder:** move `index.html` into a `docs/` folder, then in **Settings → Pages** choose folder **`/docs`**.

### Add it to an existing repo from the command line

```bash
# copy the folder into your repo, then:
git add ckd-mbd-calculator/
git commit -m "Add CKD-MBD management planner"
git push
# then enable Pages as in Option A
```

That's it — GitHub serves the static file directly; there is no build step to configure.

## How the logic is organized

All decision logic lives in pure functions inside `index.html`:

- `generatePlan(input)` — orchestrates everything and returns the structured plan.
- `recBinder`, `recVitD`, `recCalcimimetic` — one per drug class.
- Verification helpers (`modalityCheck`, `caLoadCheck`, `pthCheck`) implement the required self-checks.
- All thresholds are centralized in the `T` object at the top of the script, so the target ranges shown to the user and the ranges used in the logic are the same source of truth.

## Scope / boundaries

Recommends **only** phosphate binders, active vitamin D, and calcimimetics. It does not change dialysis prescriptions, interpret bone biopsies, or make recommendations outside CKD-MBD.
