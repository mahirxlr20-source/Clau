# tabula

*Real plans, real numbers.* The Tabula Campus planners as one Android and iOS app: every department planner of the BRAC University and East West University 2026-27 editions, with an account that saves everything you type and Premium paid through **SSLCommerz**.

```
mobile/    Expo (React Native) app: Android, iOS (and web)
backend/   Node.js API: accounts, saved planner progress, SSLCommerz payments (SQLite)
tools/     import-planners.mjs (HTML planners -> app data) and parity/ (engine check)
```

## What's in the app

The app contains **25 planners**: 12 BRACU departments and 13 EWU departments. After signing up you pick your university and department. You can switch planners at any time, and each keeps its own data and department colour.

Each planner has the same eight tabs as the HTML planner, and they work the same way:

| Tab | What it does |
| --- | --- |
| **Home** | Profile (name, ID, programme, admission semester, this semester, target CGPA), CGPA / credits / in-progress numbers, degree meter, academic standing, the nearest CGPA line, the GPA you need for your target, "Next up" deadlines, the read-this-first guide |
| **Degree** | The whole degree on one map: every course with its semester and grade, Completed / In progress / Add grade status, Ready / Locked / Check-prereq unlock checks, choose-slots and advising-sheet rows, extra courses, filters and search, credit map per category, plan by semester with load limits and prerequisite-order warnings, "What unlocks what", the published roadmap (one tap fills your unscheduled courses), where the university's pages disagree, programme facts |
| **CGPA** | The university's grading scale, quick semester GPA, what it takes to reach a target, retake what-if (latest- or best-grade rule, with the tuition cost), CGPA lines for scholarships and probation |
| **Money** | This semester's bill at the published rates with waiver and installments, the whole-degree estimate, the fee-date ladder with countdowns and calendar export, the scholarship and fee rules |
| **Semester** | Deadlines and tasks with countdowns and calendar export, the weekly routine grid with clash detection, the semester pages and everyday pages, kept separately for each semester |
| **Toolkit** | The department's toolkit guides plus the tracker's log sheets and calculators. Counts, countdowns and flags run on the same formula engine as the Excel tracker. Every sheet exports to CSV |
| **Rules** | Grading, retakes, standing and loads, scholarships, the academic year, deadlines, fees |
| **More** | Account and Premium, Beyond the classroom, a printed degree map, assignment cover pages, the Excel tracker, backup export and import, sources and the legal line |

### Where the app differs from the HTML files

- **Fixed: content the HTML planners never showed.** The 2026-27 build titles its book parts "the Rules tab - …" instead of "Part 2 - …", but the HTML code still looks them up by "Part *n*". As a result the HTML planners show an empty **Rules** tab and no semester pages, everyday pages, toolkit guides, "Beyond the classroom" or scholarship sections in Money. The app finds the parts under either naming (`mobile/src/planners/model.ts`), so all of that content appears.
- **Saved to your account instead of the browser.** Everything you type syncs to your tabula account and comes back on any phone you sign in on. The app reopens on the planner and tab you were last on. The HTML planner's "save this file with my data inside" is not needed, but its **backup file format is kept**: you can import a backup made in an HTML planner into the app, and the reverse.
- **Native equivalents of browser features.** CSV, `.ics`, backup and Excel files open the system share sheet (save to Files, open in Calendar or Excel, send to a laptop). Printing uses the phone's print dialog. Dates and times use the native pickers.
- **Same numbers.** The formula engine and degree model are ported from the HTML planner. `tools/parity/check.sh` loads a filled-in state into both the app engine and each HTML file and compares the CGPA, credits, every course's status and unlock check, standing, gateways and every sheet and calculator formula. All 25 planners match exactly.

### Free and Premium

| Free | Premium (Tk 199 for 30 days, Tk 1,999 for 365 days) |
| --- | --- |
| Home, Degree, CGPA, Rules, More (backup, sources) - for every planner | Money, Semester and Toolkit; the Excel tracker; printing |

To move a feature between the two, edit the lists in `mobile/src/lib/premium.ts`. Prices are set in `backend/src/plans.js`.

## Brand

The UI follows the Tabula Brand Guide v1.0:

- **Colour:** Parchment grounds, Ink text and buttons, Marigold only for the tab on the mark, the edition sticker, the marker underline and the one Premium button. Each planner uses its department's accent and tint from the Campus palette.
- **Type:** Fraunces (Display 144 pt, 72 pt and Text 9 pt cuts) for titles and numbers, Fraunces italic for leads and series lines, Inter for text, Caveat only on the sticker. The font files are the brand kit's own, under the SIL Open Font License (`mobile/assets/fonts`).
- **Hand-drawn pieces:** the hand-drawn check box, the two-stroke marker underline, the edition sticker, the department motif on the cover block, and the horizontal lockup in the header.
- **App icon:** the mark on a Marigold square at 62 %, in single-colour Ink, per the guide.
- **Name:** written "tabula" in lowercase; the legal line appears on every planner.

## Run it locally

Requirements: **Node.js 22.13+**, and **Expo Go** on your phone (or an Android emulator / iOS simulator).

```bash
# 1. Backend
cd backend
npm install
cp .env.example .env        # add your SSLCommerz sandbox store id/password
npm run dev                 # http://localhost:4000

# 2. App (new terminal)
cd mobile
npm install
npx expo start              # scan the QR code with Expo Go (Android) or the Camera app (iOS)
```

In development the app calls the backend on port 4000 of the computer running `expo start`. To use another server, set `EXPO_PUBLIC_API_URL` (see `mobile/.env.example`).

Tests:

```bash
cd backend && npm test               # accounts, progress, payments (incl. a mock SSLCommerz server)
cd mobile && npx tsc --noEmit        # typecheck
tools/parity/check.sh <planner-html-folder>   # app engine vs the HTML planners
```

## A new edition of the planners

```bash
node tools/import-planners.mjs <folder-with-BRACU-html> <folder-with-EWU-html>
tools/parity/check.sh <folder-with-BRACU-html>
```

The importer reads each `*-Planner_<edition>.html` and writes three things: the planner's data (`mobile/src/planners/data`), its Excel tracker (`mobile/assets/trackers`), and the catalogue that the picker shows. A new university or department needs no code change.

## SSLCommerz setup

1. Create a **sandbox store** at <https://developer.sslcommerz.com/registration/>. Put the store ID and password in `backend/.env` (`SSLCOMMERZ_STORE_ID`, `SSLCOMMERZ_STORE_PASSWORD`) and keep `SSLCOMMERZ_SANDBOX=true`.
2. SSLCommerz must be able to reach the backend over the internet. Locally, open a tunnel (for example `ngrok http 4000`) and set `PUBLIC_BASE_URL` to its HTTPS URL.
3. In the SSLCommerz merchant panel, set the **IPN URL** to `PUBLIC_BASE_URL/payments/sslcommerz/ipn`.
4. In the app, open **More → Go Premium**, pick 30 or 365 days, enter a phone number and pay with a sandbox test card.

### How a payment works

```
App ──POST /subscriptions/checkout──▶ Backend ──init session──▶ SSLCommerz
App opens the gateway page in an in-app browser ──▶ the customer pays
SSLCommerz ──POST success_url (browser)──▶ Backend ──Order Validation API──▶ SSLCommerz
SSLCommerz ──POST ipn_url (server)───────▶ Backend   (same check; whichever arrives first wins)
Backend page sends the browser to tabula://payment-result ──▶ App asks the backend for the status
```

- Nothing posted to the callbacks is trusted. A payment counts only after SSLCommerz's validation API confirms the same `tran_id`, amount and currency that the backend created.
- A payment is applied exactly once, even if the browser callback and the IPN arrive together.
- If no callback ever arrives, the backend asks SSLCommerz about the pending payment by `tran_id`.
- Payments that SSLCommerz flags as high risk are held for review (`SSLCOMMERZ_HOLD_RISKY`).
- SSLCommerz's standard API has no automatic recurring debit, so Premium is **prepaid**: each payment adds 30 or 365 days on top of any time left.

## Building for the stores

```bash
cd mobile
npx eas-cli@latest login
# set EXPO_PUBLIC_API_URL for each profile in eas.json first
npx eas-cli@latest build --platform android --profile preview   # APK to share for testing
npx eas-cli@latest build --platform all --profile production
npx eas-cli@latest submit --platform all
```

The app identifiers are `bd.tabula.app` (`mobile/app.json`). Change them to ones you own before the first store build.

## Going live checklist

- [ ] `NODE_ENV=production` and a long random `JWT_SECRET`.
- [ ] Serve the backend over **HTTPS** and set `PUBLIC_BASE_URL`.
- [ ] Live SSLCommerz store credentials, `SSLCOMMERZ_SANDBOX=false`.
- [ ] Back up the SQLite file (`DATABASE_PATH`), or move to Postgres for more than one server instance.
- [ ] Check with Apple and Google whether Premium may be sold through an external gateway in the countries you publish in; their in-app purchase rules cover digital content.
- [ ] Brand guide house rule: have a lawyer look at the use of the universities' names and check that "tabula" is free in the classes you trade in.
