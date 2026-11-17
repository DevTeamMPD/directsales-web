# Feature inventory: MPD Direct Sale web prototype

All files are under `C:\Claude Ai\Directsale\directsales-web\`. Line references (`L`) point to `app.js` unless another file is named. `app.js` is one IIFE of 1,016 lines, and I read all of it. I also read `index.html`, `styles.css`, `config.js`, and the shape of `data.js` and `icons.js`.

The app has two modes:
- **Demo:** `LIVE=false`. State lives in localStorage under the key `mpd-directsale-preview-v5` (L3, L17–24).
- **Live:** `LIVE=true` after Supabase login (L981). Nothing is written to localStorage (`save()` returns early, L23).

---

## 1. Layout shell

### Fonts and page
- `index.html:9` loads Google Fonts: IBM Plex Sans Thai (weights 400/500/600/700) and IBM Plex Mono (500).
- `index.html:11` loads supabase-js 2.45.4 UMD from jsdelivr.
- Page attributes: `lang="th"`, title "MPD Direct Sale", `viewport-fit=cover`.

### Sidebar `aside.sidebar#sidebar` (`index.html:16-55`)
- **Brand block:** `.brand` > `.brand-name` "MPD Direct Sale" and `.brand-sub` "MPD Group · Preview v0.1".
- **Nav** `nav.nav#nav`. Each `.nav-item` is an `<a>` with an inline SVG, a `<span>` label and an optional `<b class="nav-badge">`.

| Group (`.nav-group`) | Item label | href / `data-route` | Badge id |
|---|---|---|---|
| ข้อมูลลูกค้าเก่า | Direct Sale (phone icon) | `#leads` | `#badge-leads` (red) |
| แคมเปญ | Bebeplay (megaphone icon) | `#campaign-bebeplay` | `#badge-bebeplay` (`.soft`) |
| แคมเปญ | Hosttail (megaphone icon) | `#campaign-hosttail` | `#badge-hosttail` (`.soft`) |
| Overview | Dashboard (grid icon) | `#dashboard` | — |
| Tool (`#nav-tool`) | ตั้งค่า (gear icon), `#nav-setup` | `#setup` | — |

- The Tool group and `#nav-setup` are hidden when the user is not admin (L141).
- **Badge counts** (`updateBadges`, L151-160; runs on every `route()`):
  - `#badge-leads` counts leads where `owner === meId` and status is `new` or `callback`.
  - `#badge-<brand>` counts leads where `brand===b && source==='campaign' && status==='new' && !owner`. It always gets class `soft`.
  - When the count is 0 the text is empty, and `.nav-badge:empty` hides it.
  - Counts use raw `state.leads`. They do not go through `visible()`.
- **Active item:** the `.nav-item.active` class toggles on whichever `data-route` matches; unknown routes fall back to `leads` (L145).

### "Me" box `.me` (`index.html:47-54`, `fillMe` L916-926)
- `.avatar#me-avatar` shows `me().initials.slice(0,2)`, or "?" if missing.
- `#me-label` and `select#me-select.me-select`:
  - **Live:** label "เข้าสู่ระบบแล้ว"; the select is disabled and holds one option, the user's name (or `authUser` email).
  - **Demo:** label "โหมดตัวอย่าง · ใช้งานในชื่อ"; options list every rep. Changing it does `state.meId=…; save(); fillMe(); route()` (L927) to impersonate.
- `button.icon-btn.logout#logout`, title "ออกจากระบบ" (L1005):
  - Calls `sb.auth.signOut()` if signed in, sets `authUser=null` and clears the password field.
  - If the session was live, it does `location.reload()`; otherwise it calls `showLogin('')`.

### Topbar `header.topbar` (`index.html:59-68`)
- `#menu-btn` (hamburger, `.menu-btn`, only shown at ≤760px) calls `openMenu` (L161, L906). This adds `.open` to `#sidebar` and `#scrim`.
- Clicking `#scrim` calls `closeMenu`, and `route()` always calls `closeMenu` too (L148).
- `#page-title` (h1) and `#page-sub` come from the routes table (L130-136). The campaign page overrides the sub with "`N` แคมเปญ" (L262).
- `#topbar-actions` is cleared on every route (L146), then each page fills its own buttons.

### Login screen `#login.login` (`index.html:73-83`)
- Form `#login-form.login-card` contains:
  - brand name;
  - help text "เข้าสู่ระบบด้วยอีเมลและรหัสผ่านที่ลงทะเบียนไว้ใน Supabase";
  - `#l-email` (`autocomplete=username`) and `#l-pass` (`autocomplete=current-password`), both required;
  - `#l-err.login-err` (`role=alert`, hidden by default);
  - `#l-submit` (`.btn.primary`) "เข้าสู่ระบบ";
  - `#l-demo` (`.btn`) "ดูตัวอย่างโดยไม่ล็อกอิน".
- **Submit** (L994-1003):
  - If `sb` is null: show "โหลดระบบล็อกอินไม่สำเร็จ ตรวจสอบอินเทอร์เน็ตแล้วลองใหม่ หรือเลือกดูตัวอย่าง".
  - The submit button is disabled while `sb.auth.signInWithPassword({email: trimmed, password})` runs.
  - On error: "อีเมลหรือรหัสผ่านไม่ถูกต้อง".
  - Then `enterAuth`. If that fails: "โหลดข้อมูลจาก Supabase ไม่สำเร็จ: …".
  - Then `start()`.
- **Demo button** (L1004): sets `authUser=null`. If the current `me()` has an `email` (left over from a live session), it resets `meId` to `'r4'`. Then `start()`.
- **Boot** (L1007-1015):
  - If there is no config, call `start()` directly.
  - If there is no `sb`, show the login error above.
  - If `sb.auth.getSession()` returns a session user, run `enterAuth` then `start()`. Otherwise show the login screen.
- `start()` (L928): hides the login screen, calls `fillMe()`, adds the `hashchange` listener once, then calls `route()`.

### Other shell elements
- `#modal-root.modal-root` (hidden) and `#toast.toast` (hidden) sit at `index.html:84-85`.
- Script order: `icons.js`, `config.js`, `data.js`, `app.js`.

---

## 2. Pages and routes

`route()` (L137-150) does the following in order:
1. Runs `applyAuto` for every campaign with `claimMode==='auto'`. This is a no-op in live mode.
2. Reads the hash (default `#leads`).
3. If the route is `#setup` and the user is not admin, it redirects to `#leads`.
4. Sets title and sub, clears the topbar actions, calls the page's render, closes the menu, and updates the badges.

Unknown hashes render the leads page.

**Shared UI state** `ui` (L27, L616):
- `q`, `status`, `camp`, `rep`, `selCamp`, `sort` (default `'due'`), `dashBrand`;
- `period {from,to,key}`;
- `pool {...}`, `focusSearch`, `dirtyRows`.

The search text, status chip, rep, sort and period are **shared** between the leads page and the campaign pages, and they persist across navigation.

### Period filter card (every page except setup) — `periodHtml` L57-66, `bindPeriod` L67-78
- Rendered as `.period.card` > `.period-row` containing:
  - the label "ช่วงวันที่";
  - preset chips (`data-pk`): ทั้งหมด (`all`), วันนี้ (`today`), 7 วันล่าสุด (`7d`), เดือนนี้ (`m0`), เดือนก่อน (`m1`), ปีนี้ (`y0`);
  - `input[type=month]#p-month.pin`;
  - `select#p-year`: "ปี…" plus the current year and the two before it;
  - `#p-from` date, the word "ถึง", and `#p-to` date.
- Footer `.sub`:
  - With a period: "กรอง d/m/y – d/m/y · แสดงลีดที่มีการติดต่อ นัด หรือปิดการขายในช่วงนี้ (ลีดที่ยังไม่มีผู้ดูแลแสดงเสมอ)".
  - Without: "ยังไม่ได้กรองช่วงวันที่".
- Every change sets `ui.period` (key is one of `all|today|7d|m0|m1|y0|month|year|custom`), resets `ui.pool.page=0` and `pool.loaded=false`, then redraws.
- `presetRange` (L47-56) does its date maths in UTC on the `today` string:
  - `7d` = today−6 to today;
  - `m0` = first to last day of this month;
  - `m1` = previous month;
  - `y0` = Jan 1 to Dec 31.
- Month input gives the 1st to the last day of that month. Year select gives Jan 1 to Dec 31. Clearing the month input resets to `all`.

### Lead toolbar — `toolbar(base, withCampSelect)` L219-235, `bindToolbar` L236-243
- **Search:** `label.search` with an SVG and `input#q[type=search]`, placeholder "ค้นหา ชื่อ, เบอร์, เลขบิล, ร้านค้า". Every keystroke calls `redraw(true)` with no debounce; the input is refocused and the caret moved to the end (L254, L295).
- **Status chips** (`data-chip`), in this order. Each label has the count `(n)`, counted over `base` with `periodOk`:

| Chip | Label | Dot colour |
|---|---|---|
| `all` | ทั้งหมด | none |
| `overdue` | เลยนัด | `--bad` |
| `today` | นัดวันนี้ | `--warn` |
| `new` | `STATUS.new` | `--grey` |
| `following` | `STATUS.following` | `--info` |
| `callback` | `STATUS.callback` | `--warn` |
| `won` | `STATUS.won` | `--ok` |
| `unreachable` | `STATUS.unreachable` | `--violet` |
| `lost` | `STATUS.lost` | `--bad` |
| `nocall` | ไม่สะดวกให้โทร | `--bad` |

- `select#camp-sel` (leads page only): แคมเปญทั้งหมด / เซลล์ขุดเอง (`self`) / each campaign by name.
- `select#sort-sel`: "เรียง: วันนัดใกล้สุด" (`due`), "เรียง: ยอดซื้อสูงสุด" (`spend`), "เรียง: ตามเดิม" (`none`).
- `select#rep-sel` (admin only): เซลล์ทุกคน plus each rep.

### Lead table — `tableHtml` L212-216, `leadRows` L192-211
Wrapper is `.card.table-wrap > table`. The 9 columns:

| # | Header | Cell contents |
|---|---|---|
| 1 | ชื่อ / เบอร์ | `button.cust-name[data-act=open]` with the name; `.sub.mono` phone; `contactBar(l, channels, mini=true)` (call button plus up to 4 chat icons at 16px) |
| 2 | เลขบิลที่เคยซื้อ | `.bills > span.bill` for each of `bills(l)` (live `l.bills`, demo the unique purchase bills) |
| 3 | ร้านค้า | `l.shop` |
| 4 | แคมเปญ | `source==='self'` gives `span.tag.self` "เซลล์ขุดเอง"; otherwise `span.camp-cell` with the campaign name or "—" |
| 5 | พนักงานขาย | `span.rep-name` with the owner name, or `.sub` "ยังไม่มีผู้ดูแล"; plus `.sub` "ขายล่าสุด: <name>" when `lastSeller(l)` exists (demo only, since live purchases are `[]`) |
| 6 | ยอดซื้อรวม (`th.r`) | `td.r.num` `baht(total(l))` |
| 7 | สถานะ | see breakdown below |
| 8 | บันทึกล่าสุด (`td.note-cell`) | `noteCell` L114-121, see breakdown below |
| 9 | ปุ่มดำเนินการ | `.actions`, see breakdown below |

Column 7 (สถานะ) contains, in order:
- `span.badge.s-<status>` with the `STATUS` label;
- `dueHtml`: `.due.overdue` "เลยนัด d/m/y", `.due.today` "นัดวันนี้ …", or plain "นัดติดต่อ …";
- if `chatCheck.sent`: `span.tag.chat-ok` "ทักแชทแล้ว ✓";
- if `noCall`: `span.tag.nocall` "ห้ามโทร · แชตเท่านั้น", and for admins also `.sub` "แจ้งโดย <name> · d/m/y";
- for admins, when there is no owner but `releasedBy` is set: `.sub` "คัดออกโดย <names>".

Column 8 (บันทึกล่าสุด) contains:
- "สนใจ: <interest>" when interest is set;
- for won leads with closed bills: "บิลที่ปิด:" followed by `.bill` spans;
- the note of the last interaction, or "—".

Column 9 (ปุ่มดำเนินการ) contains:
- `btn.sm.primary[data-act=log]`: "บันทึก" (`data-type=call`), or "บันทึกแชต" (`chat`) if `noCall`;
- `claimCell` (campaign pages only);
- `unclaimBtn`: `btn.sm.danger` "ยกเลิกจอง" when `canUnclaim`;
- for admins with a `noCall` lead: `btn.sm[data-act=dnc-restore]` "ยกเลิกห้ามโทร".

The empty state is a single row: `td[colspan=9].empty` "ไม่พบรายการที่ตรงกับตัวกรอง".

**`claimCell(l, opts)`** (L106-113) returns nothing if there is no mode or the lead already has an owner. Admins get `select[data-assign]` "มอบหมายให้…" plus each rep.

| Mode | Sales sees | Admin sees |
|---|---|---|
| `self` | `btn.sm.outline[data-act=claim]` "จอง" | "จอง" button plus the assign select |
| `assign` | "รอหัวหน้ามอบหมาย" | assign select |
| `auto` | "ไม่มียอดขายเดิมให้อ้างอิง" | assign select |

In the "ลูกค้าทุกแคมเปญ" (`CAMPS`) view, the mode is taken from each lead's own campaign (`perCamp`, L196).

### `#leads` — Direct Sale (`renderLeads` L245-257)
- Title "Direct Sale", sub "ลูกค้าเก่า Direct Sale Lead".
- Topbar: `btn.primary#add-lead` "+ เพิ่มลูกค้าจากถังลูกค้าทั้งหมด" opens `pickFromBucket()`.
- Base list: `state.leads.filter(mineOrAll)`, which is everything for admins and own leads for sales.
- View, top to bottom:
  - `.demo-note`: "ข้อมูลทั้งหมดเป็นตัวอย่างสำหรับ Preview — กดบันทึกได้จริง ข้อมูลเก็บในเบราว์เซอร์นี้เท่านั้น". **This also shows in live mode** (quirk).
  - the period card;
  - the toolbar with the campaign select;
  - the table with no claim column content.
- Every draw calls `verifyMine(() => draw())` (section 6).

### `#campaign-bebeplay` / `#campaign-hosttail` (`renderCampaign(brand)` L259-298)
- Title "แคมเปญ Bebeplay" or "แคมเปญ Hosttail"; sub "`cs.length` แคมเปญ".
- `ui.selCamp` resets to `'ALL'` unless it is `ALL`, `CAMPS`, or a campaign of this brand.
- `ui.pool.loaded=false` on every entry. On a brand change the pool is reset to `{brand, page:0, q:'', total:null, rows:[], grand:null, grandFor:null}`.
- **Admin topbar:**
  - `btn#auto-run` "จัดสรรให้เซลล์ที่ขายล่าสุด": `applyAuto(ui.selCamp)`; if it returns 0, toast "ไม่มีลีดที่ต้องจัดสรร"; then `route()`. Live always returns 0.
  - `btn.primary#new-camp` "+ สร้างแคมเปญ" opens `campaignForm(brand)`.
- **Card grid** `.camp-grid`, in this order:
  1. `poolCard()` (L664): `button.camp.all[data-camp=ALL]`, "ลูกค้าทั้งหมด".
     - Badge `s-won` "ข้อมูลจริง" when `pool.live`, otherwise `s-new` "ตัวอย่าง".
     - "ลูกค้าทั้งหมดของ <Brand>".
     - `.kpi-value` showing `grand` in th-TH format (or "…") plus "ราย".
     - Stats: live "ทั้งที่เข้าและยังไม่เข้าแคมเปญ"; demo `inCampLine()` "เข้าแคมเปญแล้ว X · ยังไม่เข้า Y" (matched by phone).
  2. `campsCard()` (L654): `[data-camp=CAMPS]`, "ลูกค้าทุกแคมเปญ".
     - Badge `s-following.plain` "N แคมเปญ".
     - Meta "ลูกค้าที่อยู่ในแคมเปญต่างๆ ของ <Brand> รวมกัน".
     - Count of visible leads in the brand's campaigns, a progress `.bar`, and "ติดต่อแล้ว done/n" with "ปิดการขาย won".
  3. One `button.camp[data-camp=id]` per campaign of this brand (L274-286):
     - `.camp-name`;
     - badge: if `active!==false && (!end || end>=today)`, `s-won` "กำลังดำเนินการ"; otherwise `s-new` with "ปิดอยู่" (`active===false`) or "จบแล้ว";
     - meta "start – end" and the note;
     - `.bar` at done/n where done = status≠new;
     - stats "ติดต่อแล้ว done/n" and "ปิดการขาย won". Leads are counted through `visible()`.
  - Empty state: `.empty` "ยังไม่มีแคมเปญ", plus " — กด "+ สร้างแคมเปญ" ด้านบน" for admins.
  - Clicking a card sets `selCamp` and resets `ui.status='all'`.
- Then the period card.
- **If `selCamp === 'ALL'`:** `poolPanel()` (below).
- **Otherwise:**
  - `.quota.card` line: "ลีดในแคมเปญนี้ **n** รายการ · ที่ฉันดูแล **mine** · ยังไม่มีผู้ดูแล **x** · วิธีจอง: **<MODES[mode]>**" (for CAMPS: "ตามที่ตั้งไว้ในแต่ละแคมเปญ");
  - the toolbar without the campaign select;
  - the lead table with `{mode, perCamp: isCamps}`.
  - Base list: leads in the selected campaign (or in all brand campaigns for CAMPS) that pass `visible()`.
- With `ui.focusSearch`, `#pool-q` is focused until the pool has loaded (L294).

### Pool panel ("ถังลูกค้าทั้งหมด") — `poolPanel` L672-688, `bindPool` L754-760, `poolLoad` L622-646
- **Toolbar:** `label.search` (`flex-basis:480px`) with `#pool-q`, placeholder "ค้นหา เบอร์ / เลขบิล / ชื่อแชต / ชื่อลูกค้า"; shows "กำลังโหลด…" while loading.
  - Input is **debounced 300 ms** (`P.t`), resets the page to 0, then `poolLoad(draw, keepFocus=true)`.
- **Error:** `.login-err` "โหลดลูกค้าไม่สำเร็จ: …".
- **Table** (8 columns):

| # | Header | Cell contents |
|---|---|---|
| 1 | ชื่อ / เบอร์ | `button.cust-name[data-pool-open]`, phone, and `.sub` "แชต: <chat>" |
| 2 | แคมเปญ | live "—"; demo the campaign names (`.camp-cell`) or "ยังไม่เข้าแคมเปญ" |
| 3 | กลุ่มลูกค้า | `.tag` segment, or "—" |
| 4 | ยอดซื้อสะสม (r) | `baht(round(ltv))` |
| 5 | ออเดอร์ (r) | `orders` |
| 6 | ซื้อล่าสุด | `fmtDate(last)` |
| 7 | แบรนด์ | `.tag.bebe` / `.tag.host` per brand |
| 8 | (blank header) | `poolAction` button |

- Empty or loading row: `colspan=8`, "กำลังโหลด…" or "ไม่พบลูกค้าที่ตรงกับคำค้น".
- **Pagination:** `PAGE=50` (L615).
  - `btn.sm[data-pool=prev]` "← ก่อนหน้า", disabled on page 0.
  - `.sub.num` "from+1–from+rows จาก total" in th-TH format.
  - `[data-pool=next]` "ถัดไป →", disabled at the end or while `total` is null.
- **`poolAction`** (L694-704):
  - Live:
    - `noCall`: disabled "ไม่สะดวกให้โทร".
    - `mine`: `btn.sm.danger[data-act=unclaim]` "ยกเลิกจอง" if `canUnclaimAny`, otherwise disabled "จองแล้ว".
    - `taken` by someone else: disabled "จองแล้ว", or "จองโดย <reserved_by>" for admins.
    - Otherwise `btn.sm.outline[data-pool-claim]` "จอง".
  - Demo: `releasedByMe` gives disabled "คัดออกแล้ว"; the remaining cases follow the same logic using local data.
- **Demo search and sort** (L636-640): matches name (lowercase), chatName, digits-only against phone, or a bill substring. Filtered to the brand, excluding `isDnc`, by period on the latest purchase date. Sorted by total descending.

### `#dashboard` — section 7

### `#setup` — ตั้งค่า (admin only, `renderSetup` L369-382)
Wrapper `.settings` is a grid of `.panel` blocks:
1. **ทีมเซลล์:**
   - One `.list-row` per rep: bold name; `.tag` "หัวหน้า" or "เซลล์"; `.sub` "N ลีด" (owned).
   - `form#rep-form.inline-form`: `#rep-name` ("ชื่อเซลล์ใหม่", required), `#rep-role` (sales/admin), button "เพิ่ม".
   - Live: toast "ทีมเซลล์มาจาก Supabase: ผู้ใช้ที่ล็อกอินครั้งแรกจะถูกเพิ่มเป็นเซลล์อัตโนมัติ".
   - Demo: pushes a rep with id `'r'+Date.now()` and initials = first 2 characters, then toast "เพิ่มเซลล์แล้ว".
2. **แคมเปญ:**
   - One `.list-row` per campaign: name and "start – end"; brand `.tag`; `select[data-claimmode=id]` with the `MODES` options.
   - Changing the select: live updates `dsales_campaigns`, demo saves locally. Toast "บันทึกวิธีจองลีดแล้ว", or "บันทึกไม่สำเร็จ" on failure (L897-899).
   - Help text "สร้างแคมเปญใหม่ได้ที่เมนู แคมเปญ → Bebeplay / Hosttail (เฉพาะหัวหน้า)".
3. **ข้อมูลตัวอย่าง:** `btn.danger#reset` "รีเซ็ตข้อมูลตัวอย่าง" removes the localStorage key and reloads. This is demo-only and should be dropped.

---

## 3. Modals

**Infrastructure** (L385-393):
- `openModal(html, cls)` renders `.modal[.sm]` (`role=dialog`, `aria-modal`) inside `#modal-root`.
- Mousedown on the backdrop (the root itself) closes it.
- On open, the first `input,select,textarea,button.btn` is focused.
- `closeModal()` empties the root. If `ui.dirtyRows` is set, it resets the flag and calls `route()`.
- `X` is the close button `.icon-btn[data-close]`.
- **Esc** closes any modal (L905).
- A global click on `[data-close]` closes (L876).
- Layout pieces: `.modal-h` (h3 + badges + X at `margin-left:auto`), `.modal-b`, `.modal-f` (right-aligned buttons).

### A. Customer detail — `customerModal(id, tab='buy')` L481-522 (default 780px width)
- **Live loading:** on first open, `l._pl='loading'` and `loadPurchases(l)` runs; the modal re-renders on the same tab if it is still open.
- **Header:**
  - name;
  - `badge.s-<status>`;
  - brand `.tag.bebe` / `.tag.host`;
  - full `contactBar`: call button plus up to 8 chat icons at 22px;
  - X.
- **`dl.info-grid`:**

| Field | Value |
|---|---|
| ชื่อ | name |
| เบอร์ | `.mono` phone plus `button.copy[data-copy]` "คัดลอก" (toast "คัดลอกเบอร์แล้ว") |
| ที่อยู่ (`.wide`) | address |
| วันที่ซื้อล่าสุด | `l.lastBuy` or `purchases[0].date` |
| ยอดซื้อรวม | total |
| ร้านค้า | shop |
| ผู้ดูแล | owner name |
| สินค้าที่สนใจ | interest |
| เลขบิลที่ปิดได้ | closed bills joined with ", " (`.mono`) |
| วันที่ปิดการขาย | `closedAt` |
| ช่องทางแชต (แยกตามร้าน) (`.wide`) | `channelRow`: `.ch-chips > button.ch-chip[data-act=jst]` with an 18px icon and the shop (or platform) name; or "ไม่พบช่องทางแชต" |

- **Chat-check box** `.chk`:
  - `.chk-h` contains "การทักแชท (ตรวจจาก JST)" and `btn.sm#chk-refresh` "ตรวจอีกครั้ง";
  - `#chk-body` is filled by `renderChatCheck` (section 6).
- **Tabs** `.tabs` (2-column grid of `button.tab`):
  - "ประวัติการซื้อ (n)" with n = `purchases.length || l.orders || 0`;
  - "ประวัติการโทร/แชต (n)".
  - Clicking a tab re-opens the modal on that tab.
- **Buy tab:** `.mini-table.table-wrap` with columns วัน/เดือน/ปี | SKU (mono) | ชื่อสินค้า (+ `.sub` "บิล X · ขายโดย Y") | ยอดซื้อ (r).
- **Talk tab:** `ul.timeline`, sorted by date descending. Each `li` has:
  - `.feed-ic.call` or `.feed-ic.chat` icon;
  - `.tl-head`: "โทร"/"แชต", `fmtDT · rep`, `.tag` result, and `.tag.s-callback` "นัดติดต่อ d/m/y" when `due` is set;
  - `.tl-note`.
  - Empty state: `.empty` "ยังไม่เคยติดต่อลูกค้ารายนี้".
- **Footer:** `btn.primary[data-log]` "บันทึก" / "บันทึกแชต" (chat when `noCall`) opens `logModal`.

### B. Call/chat log — `logModal(id, type)` L524-600 (`.sm`)
- If `noCall`, the type is forced to `chat`.
- **Header:** "บันทึก · <name>".
- Form `#log-form` (novalidate). Fields:
  1. `noCall` banner: `.warn` "ลูกค้ารายนี้ไม่สะดวกให้โทร ติดต่อได้ทางแชตเท่านั้น".
  2. **ช่องทาง:** `.seg#seg` with buttons โทร (`data-t=call`; disabled with a tooltip when `noCall`) and แชต. Switching refills the result options.
  3. **ผลการติดต่อ** `select#f-res`:
     - call: คุยแล้ว / ไม่รับสาย / สายไม่ว่าง / เบอร์ผิด;
     - chat: ตอบกลับแล้ว / อ่านแล้วไม่ตอบ / ส่งโปรโมชันแล้ว.
  4. **สถานะลูกค้าหลังบันทึก** `select#f-status`:
     - every `STATUS` except `new`;
     - default is `following` if the current status is `new`, otherwise the current status;
     - unless `noCall`, two extra options: `dnc` "ไม่สะดวกให้โทร (ติดต่อทางแชตเท่านั้น)" and `release` "คัดออก (คืนให้คนอื่นโทร)".
  5. `#cb-wrap` **วันที่นัดติดต่อ \*** (`#f-cb`, date, `min=today`, prefilled when `callback>=today`). Shown only for `callback`.
  6. **สินค้าที่ลูกค้าสนใจ** `#f-interest`, placeholder "เช่น เตียงนอนเด็ก, ทรายแมว".
  7. `#won-wrap` (shown only for `won`):
     - `#f-bills` "เลขบิลที่ขายได้ (อ้างอิงตอนผูกข้อมูล คั่นหลายบิลด้วยจุลภาค)";
     - `#f-amount` number "ยอดที่ปิดได้ (บาท)";
     - `#f-closed` date "วันที่ปิดการขาย" (default `closedAt` or today).
  8. `#warn-wrap` / `#warn-text`: `.warn` text taken from the `WARN` map (L549) for `dnc` and `release`. `#note-req` "\* ใส่เหตุผล" shows in the same cases.
  9. **หมายเหตุ** `textarea#f-note`, placeholder "สรุปสิ่งที่คุยกับลูกค้า".
- **Footer:** ยกเลิก (`data-close`) and `btn.primary` บันทึก.
- **Validation** (L558-563), in order. Each failure shows a toast and focuses the field:
  1. callback with no date: "เลือกวันที่นัดติดต่อก่อนบันทึก";
  2. callback date in the past: "วันที่นัดติดต่อต้องไม่ย้อนหลัง";
  3. dnc/release with an empty note: "ใส่เหตุผลในหมายเหตุก่อนบันทึก";
  4. won with no bills: "ใส่เลขบิลที่ขายได้ก่อนปิดการขาย". Bills are split on `/[,\s]+/`.
- **Live save** (L564-579):
  - The note defaults to "(ไม่มีหมายเหตุ)".
  - `dnc`: `st` = previous status (`new` becomes `following`) and `res='ไม่สะดวกให้โทร'`.
  - `release`: `st='new'` and `res='คัดออก'`.
  - Then `dsales_log`. After that, `dnc` calls `dsales_set_nocall{on:true}` and `release` calls `dsales_unclaim_lead`.
  - Then `closeModal`, `pool.loaded=false`, `route()`, and the toast.
  - **`#f-closed` is not sent in live mode.**
- **Demo save** (L581-598):
  - Pushes an interaction `{id, type, date: today+local HH:MM, rep, result, due, note}`.
  - Sets status and interest. For `won` it sets `closedBills`, `closedAmount`, `closedAt`.
  - `callback` is kept only when the status is `callback`.
  - If there is no owner, the owner becomes me.
  - `dnc`: sets the noCall fields and restores the status.
  - `release`: `status=new`, `owner=null`, `releasedBy` += me.
- **Toasts:** "บันทึกแล้ว" / "ทำเครื่องหมายห้ามโทรแล้ว ติดต่อลูกค้ารายนี้ทางแชตเท่านั้น" / "คัดออกแล้ว ลูกค้ากลับเข้าถังให้เซลล์คนอื่นโทร".

### C. Confirm unclaim — `confirmUnclaim(id)` L92-105 (`.sm`)
- Guard: `canUnclaimAny`, otherwise toast "ยกเลิกจองรายการนี้ไม่ได้".
- Content: h3 "ยกเลิกจอง?", the text "ยืนยันยกเลิกการจอง **name** ใช่หรือไม่", and help "ลูกค้าจะกลับเข้าถังให้เซลล์คนอื่นจองได้ ประวัติที่บันทึกไว้ยังอยู่".
- Buttons: "ไม่ยกเลิก" (`data-close`) and `btn.danger.solid#unclaim-ok` "ยืนยันยกเลิกจอง".
- **Live:** `dsales_unclaim_lead`. If the returned lead has no `campaignId` and the user is not admin, it is removed from `state.leads`.
- **Demo:**
  - A self-mined lead with no interactions is deleted.
  - Otherwise it is reset to `{owner:null, claimedBy:null, claimedAt:null, chatCheck:null, status:'new', callback:null, autoSkip: campaign?true:prev}`.
- Toast "ยกเลิกจองแล้ว".

### D. Pick from bucket — `pickFromBucket()` L602-610 (`.sm`)
- h3 "เพิ่มลูกค้า", with two lines of explanation.
- Two `btn.primary[data-open-bucket]` buttons in a `.form-grid`: "ถังลูกค้าทั้งหมด Bebeplay" and "ถังลูกค้าทั้งหมด Hosttail".
- Clicking one sets `selCamp='ALL'`, `focusSearch=true`, `pool.q=''`, `pool.loaded=false`, closes the modal, and sets the hash to `#campaign-<brand>`.

### E. Pool customer detail — `poolDetail(id)` L719-753 (default width)
- **Header:**
  - name;
  - brand tags;
  - when taken: `badge.s-new.plain` showing "จองแล้ว", or "จองโดย <name>" (the name is shown when it is me, or for admins when `takenName` is known);
  - `contactBar` built from `{phone, name, brand: brands[0], chatName: chat}` and channels.
- **`info-grid`:** เบอร์ (+ copy) · กลุ่มลูกค้า · ยอดซื้อสะสม · จำนวนออเดอร์ · ซื้อล่าสุด · ชื่อแชต · ที่อยู่ (demo only) · ช่องทางแชต (`.wide`).
- **"ประวัติการซื้อ":**
  - while loading: `.empty` "กำลังโหลดประวัติการซื้อ…";
  - on error: `.login-err` "โหลดประวัติการซื้อไม่สำเร็จ";
  - otherwise a mini-table (same columns as the customer modal; `seller` is a name string);
  - empty: "ไม่พบประวัติการซื้อรายรายการ".
- **Footer:**
  - `btn.primary[data-pool-claim]` "จอง" if not taken and not `noCall`;
  - `btn.danger[data-act=unclaim]` "ยกเลิกจอง" if taken by me and unclaimable.
- **Live:** renders immediately, then fetches `dsales_customer_purchases` and `dsales_customer_channels` (LINE sorted first), then re-renders.

### F. Campaign builder — `campaignForm(brand)` L782-871 (default width; admin only, otherwise toast "เฉพาะหัวหน้าเท่านั้นที่สร้างแคมเปญได้")
- Form state: `f = {tab, name, desc, active:true, start, end, brand, mode:'self', max, crits:[], prev:false}`.
- **Header** "สร้างแคมเปญใหม่". `.utabs` contains `button.utab[data-ca=tab]`: ข้อมูลพื้นฐาน (`base`), การตั้งค่า (`set`), กลุ่มลูกค้า (`aud`). The `aud` tab shows a `.count` badge with `crits.length`. Tab clicks switch freely with no validation.
- **Tab `base`:**
  - `#cf-name` ชื่อแคมเปญ \* (placeholder "เช่น Bebeplay Q4 2026" / "Hosttail Q4 2026");
  - `#cf-desc` คำอธิบาย (`.opt` "(ไม่บังคับ)");
  - `#cf-brand` select Bebeplay/Hosttail;
  - `label.switch` checkbox "เปิดใช้งานทันที";
  - `#cf-start` / `#cf-end` dates (optional).
- **Tab `set`:**
  - three `label.radio-card` radios (`name=cf-mode`) built from `MODES`, each with a description (L814);
  - `#cf-max` number `min=1` "จำนวนลีดสูงสุดที่เซลล์แต่ละคนจองได้", placeholder "ไม่จำกัด".
- **Tab `aud`:**
  - help text;
  - `#funnel` (`.funnel > .funnel-row`, first row bold): one step for all brand customers excluding DNC, then one step per criterion with "N คน" and a `.bar` relative to the top count;
  - `.crit-row` per criterion: type `select[data-ct]`, inputs `[data-cf="i:field"]`, and a trash `icon-btn[data-ca=del]`;
  - `.crit-actions`: "+ เพิ่มเงื่อนไข" (adds `{type:'product'}`) and "ดูตัวอย่าง" / "ซ่อนตัวอย่าง".
  - The preview is a mini-table (ชื่อ | เบอร์ | ยอดซื้อรวม | ซื้อ (ครั้ง)) of the first 8 rows, plus "แสดง x จาก n คน"; empty: "ไม่มีลูกค้าที่ตรงเงื่อนไขทั้งหมด".
- **Criteria `CRIT`** (L763-769), matched by `matchOne` (L771-779) with AND semantics:

| Type | Label | Fields | Rule |
|---|---|---|---|
| `product` | เคยซื้อสินค้า (ชื่อ / SKU) | `kw` text | any purchase whose "product sku" (lowercase) includes kw |
| `total` | ยอดซื้อรวม (บาท) | `min`, `max` | sum of amounts within [min,max] |
| `dates` | ซื้อเมื่อ (ช่วงวันที่) | `from`, `to` | any purchase date in range |
| `order` | ยอดสั่งซื้อต่อบิลตั้งแต่ (บาท) | `min` | any purchase amount ≥ min |
| `times` | ซื้อมากกว่า (ครั้ง) | `min` | purchases.length **>** min |

  Empty fields pass.
- **Footer:**
  - on `base`/`set`: ยกเลิก and "ถัดไป →" (disabled while the name is empty);
  - on `aud`: "← ย้อนกลับ" and `btn.primary` "สร้างแคมเปญ".
- **Create:**
  - With no name: jump back to `base` and toast "ใส่ชื่อแคมเปญก่อน".
  - **Live:** inserts into `dsales_campaigns` (section 5). No leads are created. Pushes `mapCampaign(d)`, selects it, navigates, and toasts "สร้างแคมเปญแล้ว · เลือกลูกค้าเข้าแคมเปญจากถัง "ลูกค้าทั้งหมด" ด้วยปุ่ม จอง". On error: "สร้างแคมเปญไม่สำเร็จ: …".
  - **Demo:** creates leads (`source:'campaign'`, owner null) from the funnel result and runs `applyAuto` if mode is auto. Toast "สร้างแคมเปญแล้ว · เพิ่ม N ลีดเข้าถัง".
- **Live caveat:** the funnel runs against `state.customers`, which is `[]` in live mode, so it always shows 0.

---

## 4. Lead and campaign model

### Constants
- `STATUS` (L10-13): `new` ยังไม่ติดต่อ · `following` กำลังติดตาม · `callback` รอติดต่อ · `won` ปิดการขายแล้ว · `lost` ไม่สนใจ · `unreachable` ติดต่อไม่ได้.
- CSS badge classes `s-<status>` exist for each; `.s-dnc` exists but is unused.
- Legacy migration (L21): `status==='dnc'` becomes `noCall=true` with status `following`.

### Lead fields
Live `dsales_lead_json`, in `supabase/migrations/20261117090100_dsales_schema_move.sql:242-249`:
- `id, name, phone, address, shop, chatName, channels`
- `brand ('bebeplay'|'hosttail'), source ('self'|'campaign'), campaignId, owner, status, callback (YYYY-MM-DD)`
- `interest, closedBills[], closedAmount, closedAt`
- `claimedBy, claimedAt, noCall, noCallBy, noCallAt, releasedBy[], autoSkip, identityId`
- `bills[] (≤6), total, lastBuy, orders`
- `interactions[] {id,type:'call'|'chat',date,rep,result,note,due,bills}`. Live returns the last 30, ascending.

Client-only fields: `purchases[] {date,bill,sku,product,amount,seller}`, `_pl`, `chatCheck {at,sent,count}`.

`mapLead` (L943-946) applies defaults, sets `purchases:[]`, and passes `claimedAt` and interaction dates through `localStamp`. `upsertLead` (L947-951) keeps the existing `purchases`, `_pl` and `chatCheck`.

### Transitions
- **Claim:**
  - Campaign row (L884-891): fails if it already has an owner ("ลีดนี้มีคนจองไปแล้ว"). `maxPerRep` is checked on the client: "จองได้สูงสุด N ลีดต่อคนในแคมเปญนี้". Sets `owner`, `claimedBy`, `claimedAt=nowStamp()`.
  - Pool (L705-718): see section 3E.
- **Assign** (admin select): sets `owner` only. `claimedBy` is not set, so the sales rep cannot "ยกเลิกจอง" from the table.
- **Log:** any non-new status. `won` requires bills. `callback` requires a date ≥ today. `dnc` and `release` require a note.
- **No-call / DNC:** a permanent flag. Status is kept, callback is cleared. The lead stays visible only to its owner's Direct Sale page (`mineOrAll` does not filter noCall). It is hidden from campaign views (`visible()`) and from the pool (`hiddenFromMe` / live `no_call`). Only chat logging is allowed. Admins see "แจ้งโดย…" and can restore ("ยกเลิกห้ามโทร").
- **Release:** `owner=null`, `status=new`, `releasedBy` += me. Afterwards that rep never sees the lead again (`releasedByMe`), and `applyAuto` will not hand it back to them.
- **Unclaim:** see 3C.
  - `canUnclaim` (table button, L89): `owner===me && claimedBy===me && !noCall && status!=='won'`.
  - `canUnclaimAny` (pool and confirm, L90): same, without the `claimedBy` check.

### Filters
- `isDnc(phone)` (L35): any lead with this phone has `noCall`.
- `releasedByMe(l)` (L36): the user is not admin and `releasedBy` includes me.
- `visible(l)` (L37): `!noCall && !releasedByMe && (admin || !owner || owner===me)`. Used by campaign views and cards.
- `mineOrAll(l)` (L38): admin, or `owner===me`. Used by the Direct Sale page and the dashboard.
- `periodOk(l)` (L43): no period, or no owner, or any interaction / callback / closedAt falls inside the period.
- `contactedIn(l)` (L44): with a period, any interaction in it; without one, `status!=='new'`.
- `wonIn(l)` (L45): `won` and (no period, or `closedAt` in the period).
- `filtered(base)` (L165-180): periodOk, then the status chip (`today`: callback===today; `overdue`: callback<today; `nocall`), then rep, then campaign (`self` means `source==='self'`), then search, then `sortLeads`.
- `sortLeads` (L181-185): `due` sorts by callback ascending with nulls last (`'9999'`); `spend` sorts by total descending; `none` keeps the original order.

### Campaign model
- Fields: `{id, brand, name, note, start, end, claimMode, maxPerRep, active, criteria}`. Live mapping is in `mapCampaign` (L942).
- `MODES` (L79): `self` เซลล์จองเอง · `assign` หัวหน้ามอบหมาย · `auto` เด้งเข้าเซลล์ที่ขายล่าสุด.
- **`auto`** (`applyAuto`, L81-87): demo only. For unowned, non-noCall, non-`autoSkip` leads, set the owner to `lastSeller(l)` (the first purchase whose `seller` is a known rep), unless that rep has released the lead.
- **In live mode `mapCampaign` converts `'auto'` to `'self'`**, and `applyAuto` returns 0.

---

## 5. Supabase calls (live)

- Client: `sb = supabase.createClient(cfg.url, cfg.key)`, and `db = sb.schema('dsales')` (L912-913). `sb` is used only for auth.
- Config (`config.js`): `url`, `key` (publishable), `jst: { helper: 'http://127.0.0.1:47321', urlTemplate: '' }`.

| Where | Call | Args | Result mapping |
|---|---|---|---|
| L998 | `sb.auth.signInWithPassword` | `{email, password}` | `data.user` |
| L1011 | `sb.auth.getSession()` | — | `data.session.user` |
| L1005 | `sb.auth.signOut()` | — | — |
| L987 | `db.rpc('dsales_me')` | — | `data[0].display_name`, `data[0].is_admin`. Fallback when the call fails: admin if the email is `dev@mpdgroup.co` (L990) |
| L972 | `db.rpc('dsales_register')` | — | error check only |
| L973 | `db.rpc('dsales_team')` | — | `{id:user_id, name: display_name ‖ email prefix, initials: first 2 uppercase, role: 'admin'‖'sales', email}` |
| L973 | `db.from('dsales_campaigns').select('*').order('created_at')` | — | `mapCampaign`: `description→note`, `start_date→start`, `end_date→end`, `claim_mode→claimMode`, `max_per_rep→maxPerRep`, `active`, `criteria` |
| L973 | `db.rpc('dsales_my_leads')` | `{p_limit:1000, p_offset:0}` | `mapLead` |
| L627 | `db.rpc('dsales_customer_pool_v3')` | `{p_limit:1, p_offset:0, p_brand}` | `grand = data[0].total_count` (once per brand) |
| L631 | `db.rpc('dsales_customer_pool_v4')` | `{p_search\|null, p_limit:50, p_offset, p_brand, [p_from, p_to only if a period is set]}` | row: `identity_id→id, name, phone, rfm_segment‖segment→segment, ltv, order_count→orders, last_order_date→last, brands, chat_name→chat, lead_id→leadId, mine, no_call→noCall, reserved_by→takenName, taken` (truthy becomes me if `mine`, else `'other'`); `total_count→P.total` |
| L747, L959 | `db.rpc('dsales_customer_purchases')` | `{p_phone}` | `txn_date→date, bill_no‖order_no→bill, sku, product_name→product, amount` (seller null) |
| L750, L966 | `db.rpc('dsales_customer_channels')` | `{p_phone}` | `{platform, shop, chat: chat_name}`, LINE sorted first |
| L442 | `db.rpc('dsales_customer_chats')` | `{p_phone, p_since: claimedAt\|null}` | sessions: `admin_msgs, last_admin_time, last_admin_sender, channel, page, last_time` |
| L964 | `mut('dsales_claim_customer')` | `{p_phone, p_brand: pool.brand ‖ brands[0]}` | lead JSON |
| L888 | `mut('dsales_claim_lead')` | `{p_lead}` | lead JSON |
| L99, L575 | `mut('dsales_unclaim_lead')` | `{p_lead}` | lead JSON |
| L895 | `mut('dsales_assign_lead')` | `{p_lead, p_user}` | lead JSON |
| L574, L881 | `mut('dsales_set_nocall')` | `{p_lead, p_on: true\|false}` | lead JSON |
| L572 | `mut('dsales_log')` | `{p_lead, p_type, p_result, p_note, p_status, p_callback, p_interest, p_bills (won only, else []), p_amount (won only)}` | lead JSON |
| L852 | `db.from('dsales_campaigns').insert({...}).select().single()` | `{brand, name, description\|null, start_date\|null, end_date\|null, claim_mode, max_per_rep\|null, active, criteria: crits[]}` | `mapCampaign` |
| L898 | `db.from('dsales_campaigns').update({claim_mode}).eq('id', id)` | — | toast only |

- **`mut(fn, args)`** (L953-957): on error, it looks for the first `LIVE_ERR` key that appears as a substring of `error.message` and throws an Error with the Thai text; otherwise it throws the raw message, or "ทำรายการไม่สำเร็จ". If data is an object it runs `upsertLead(data)`.
- **`LIVE_ERR`** (L952):

| Key | Message |
|---|---|
| `taken` | ลูกค้ารายนี้มีคนจองไปแล้ว |
| `no_call` | ลูกค้ารายนี้ไม่สะดวกให้โทร |
| `forbidden` | ไม่มีสิทธิ์ทำรายการนี้ |
| `bill_required` | ใส่เลขบิลก่อนปิดการขาย |
| `not_found` | ไม่พบข้อมูลรายการนี้ |
| `invalid_phone` | เบอร์โทรของลูกค้าไม่ถูกต้อง |
| `customer_not_found` | ไม่พบลูกค้ารายนี้ |
| `invalid_user` | ผู้ใช้ไม่ถูกต้อง |
| `invalid_brand` | ไม่ทราบแบรนด์ของการจอง |

  Because matching is by substring in object order, `not_found` is checked before `customer_not_found`, so a `customer_not_found` error shows the `not_found` text.
- **After `loadLive`:** `state.customers=[]`, `meId=user.id`, and `today` = the browser's local date (L979-980).

---

## 6. JST integration

- **`PLAT`** (L397): `shopee` Shopee, `line` LINE, `facebook` Facebook, `lazada` Lazada, `tiktok` TikTok, `instagram` Instagram, `website` เว็บไซต์, `other` อื่นๆ.
- **`platformOf(shop)`** (L399): takes the shop-code prefix before `_`, uppercased: `SH`→shopee, `LOA`→line, `LA`→lazada, `TT`→tiktok, `FB`→facebook, `WEB`→website, `IG`→instagram; anything else is `other`.
- **`channelsOf(x)`** (L401-402): uses `x.channels`, or falls back to `[{shop, chat: chatName}]`. Normalises to `{shop, chat (chat‖chat_name), platform (given or platformOf), ms_id}` and sorts LINE first (`lineFirst`).
- **`icon(p, size)`**: `<img class="ch-ico">` whose `src` is `window.DS_ICONS[p]`, falling back to `.other`.
  - `icons.js` keys: `line`, `facebook`, `shopee` (64px PNG data URIs); `lazada`, `tiktok`, `instagram`, `website`, `other` (SVG data URIs).
- **`jstTarget(x, c)`** (L404): `{phone, name, brand, platform, shop, chat: c.chat‖x.chatName‖x.name, ms_id}`. It is JSON-encoded into `data-t` on `[data-act=jst]` buttons.
- **`callBtn`** (L406): `a.ch-btn.call[href=tel:phone][data-call]` with a green phone SVG. A global click handler (L901-904) also copies the phone to the clipboard and toasts "โทร <phone> · คัดลอกเบอร์แล้ว".
- **`contactBar`** (L408): `span.ch-bar[.mini]` with the call button plus chat buttons (`button.ch-btn`). Mini shows 4 at 16px; full shows 8 at 22px. Tooltip "<Platform> · <shop> — เปิดแชตใน JST".
- **`jstOpen(t, {auto})`** (L415-435). The payload is `{...t, rep: me().name}`. It tries three methods in order:
  1. **Helper:** `POST {helper}/open` with a JSON body, aborted after **2500 ms**. If `r.ok`, it toasts "เปิดแชตใน JST แล้ว" (suppressed when `auto`) and returns true.
  2. **`urlTemplate`:** replaces `{key}` with `encodeURIComponent(payload[key])` and opens it with `window.open(u, '_blank', 'noopener')`.
  3. **Clipboard** (skipped when `auto`): copies `chat‖phone`, then toasts "ยังไม่ได้รันตัวช่วย JST บนเครื่อง · คัดลอกชื่อแชตแล้ว นำไปค้นหาใน JST". If copying fails: "ยังไม่ได้รันตัวช่วย JST · ค้นหาใน JST ด้วย: <txt>".
- **JST opens automatically after a claim** (`auto:true`, using the first channel):
  - campaign claim (L888, L890);
  - pool claim, demo (L717);
  - pool claim, live (L968): channels are first fetched with `dsales_customer_channels` and `chatName` is set from the row.
- **`chatCheckFor(l)`** (L438-452):
  - Live: `dsales_customer_chats` returns `{live, sessions, found: sessions.length, count: Σ admin_msgs, sent: count>0, last, by}`, where `last`/`by` come from the session with the latest `last_admin_time`. On error it returns `{err:'ตรวจไม่สำเร็จ: …'}`.
  - Demo: counts chat interactions since `claimedAt`.
- **`renderChatCheck(l)`** (L453-465):
  1. Shows "กำลังตรวจจาก JST…".
  2. Stores `l.chatCheck = {at: nowStamp(), sent, count}`. If `sent` changed, it sets `ui.dirtyRows` so closing the modal re-renders the table.
  3. Renders a badge:

| Result | Badge |
|---|---|
| error | `s-lost.plain` "ตรวจไม่ได้" |
| sent | `s-won` "ทักแชทแล้ว" |
| found, not sent | `s-callback.plain` "ยังไม่พบข้อความที่ส่ง" |
| not found | `s-new.plain` "ไม่พบแชตใน JST" |

  4. Renders the detail text:
     - sent: "เซลล์ส่ง N ข้อความ หลังจอง (dt) · ล่าสุด dt โดย X";
     - found, not sent: "เซลล์ยังไม่ได้ส่งข้อความ…";
     - not found: "จับคู่แชตของลูกค้ารายนี้ไม่พบ (จับคู่ด้วยชื่อแชต/ชื่อผู้ซื้อ) ลองตรวจใน JST เอง".
  5. Renders `ul.chk-list` with one entry per session: icon (channel lowercased; `line`→line, `webchat`→other), page name, "ล่าสุด เซลล์ dt · sender · ส่ง n".
  6. In demo mode adds the note "ข้อมูลตัวอย่าง: นับจากบันทึกแชตในแอป ตอนล็อกอินจริงจะตรวจจาก JST (iim_messages)".
- **`verifyMine(done)`** (L467-479): live only, with a `verifying` re-entrancy guard.
  - Picks up to **10** of my leads with `claimedAt`, `!chatCheck.sent` and `!noCall`, and checks them **sequentially**.
  - Calls `done()` (a redraw) if any lead went from not-sent to sent.
  - Runs on every leads-page draw.

---

## 7. Dashboard (`renderDashboard` L301-366)

- Title "Dashboard", sub "ภาพรวมทีม Direct Sale".
- `A = leads.filter(mineOrAll)`; `L` = `A` filtered by `ui.dashBrand`; `scope` = "ทุกแบรนด์" or the brand name.
- **Layout:** period card, then `.toolbar` with brand chips `[data-brand]`: ทุกแบรนด์ (n), Bebeplay (n, dot `--bebe`), Hosttail (n, dot `--host`). Counts come from `A`.
- **`stat(arr)`:**
  - `n` = length;
  - `c` = count of `contactedIn`;
  - `w` = count of `wonIn`;
  - `val` = Σ of won leads' `closedAmount ?? purchases[0].amount ?? 0`;
  - `due` = count with callback < today;
  - `wait` = count with status `callback`.
- `pct(a, b) = round(a/b·100)`, or 0 when b is 0.
- **KPI cards** (`.kpis > .kpi`, each with label, value, foot):
  1. ลีดทั้งหมด: `n` / scope.
  2. ติดต่อแล้ว: "`c` / n" / "pct(c,n)% ของลีด · scope".
  3. ปิดการขาย: `w` / "อัตราปิด pct(w,c)% ของที่ติดต่อแล้ว".
  4. ยอดที่ปิดได้: `baht(val)` / "จากยอดที่เซลล์บันทึกตอนปิดการขาย".
  5. นัดติดต่อเลยกำหนด: `due` / "ควรติดตามวันนี้" or "ไม่มีค้าง".
- **Panel "เปรียบเทียบแยกแบรนด์":**
  - Columns: แบรนด์ | ลีด | ติดต่อแล้ว (`c` (pct%)) | รอติดต่อ | เลยนัด | ปิดการขาย (`w` (pct w/c%)) | ยอดที่ปิดได้.
  - Rows are Bebeplay and Hosttail, computed from `A`. The selected brand row gets `tr.sel`. A `tr.total` row shows "รวม" with `stat(A)`.
- **Panel "ยอดที่ปิดได้รายเดือนต่อเซลล์ (สำหรับคิดค่าคอม) · scope":**
  - Header toolbar: `#comm-rate` number input (step 0.1, placeholder "เช่น 3", width 90px), label "อัตราค่าคอม (%)", and `btn.sm#comm-copy` "คัดลอกตาราง".
  - `wonLeads = L.filter(wonIn).filter(owner)`.
  - Month key = `closedAt.slice(0,7)`, or `'none'` ("ไม่ระบุวันที่"). Months are sorted ascending. Labels use Thai month abbreviations (`TH`, L328) plus the Gregorian year.
  - One row per rep with at least one win: month cells are Σ `closedAmount ?? 0` (shown as "—" when 0); ยอดรวม (bold); จำนวนบิล = Σ `closedBills.length`; ค่าคอม = `round(sum·rate/100)`, or "—" when the rate is 0. The header shows "(rate%)".
  - A `tr.total` row holds column sums.
  - Empty: "ไม่มียอดที่ปิดได้ในช่วงนี้".
  - The rate is stored in `state.commissionRate`. That is persisted in demo mode only; in live mode it is lost on reload.
  - Copy builds a TSV (header row plus rep rows with raw numbers, no total row) and toasts "คัดลอกตารางแล้ว วางใน Excel ได้เลย" or "คัดลอกไม่สำเร็จ".
- **`.grid-2`:**
  - **"ผลงานรายเซลล์ · scope":** legend with ลีดที่ดูแล (`--accent`) and ปิดการขาย (`--ok`).
    - Each `.rep-row` has the name, two bars, and "c/mine · ปิด w".
    - `maxN = max(1, owned-by-rep counts in L)`. Bar 1 width = `mine/maxN`; bar 2 (`.bar.won`) = `w/maxN`.
    - Sales see only their own row.
  - **"กิจกรรมล่าสุด · scope":** `ul.feed`, the 8 newest interactions of `L` within the period. Each item has a call/chat icon, the lead name, "· rep · fmtDT", and the note. Empty: "ยังไม่มีการบันทึก".

---

## 8. CSS (`styles.css`, 402 lines)

### Theme
CSS variables are defined at `styles.css:2-31`:

| Group | Variables |
|---|---|
| Surfaces and text | `--bg` #f3f5f9, `--surface` #fff, `--surface-2`, `--border`, `--fg` #1c2331, `--muted` |
| Accent | `--accent` #2856e6, `--accent-soft`, `--accent-fg` |
| Sidebar | `--side-bg` #0F4267, `--side-bg-2` #17587f, `--side-fg`, `--side-muted`, `--side-active` #1f6896 |
| Status pairs | `--ok`, `--warn`, `--bad`, `--info`, `--violet`, `--grey`, each with a `-soft` variant |
| Brand | `--bebe` #d9467a, `--host` #e0802a |
| Other | `--shadow`, `--font` ("IBM Plex Sans Thai", Noto Sans Thai, Leelawadee UI, Tahoma…), `--mono` ("IBM Plex Mono"…), `--radius` 10px |

**Dark mode** is automatic via `prefers-color-scheme: dark` unless `[data-theme=light]`, and forced by `:root[data-theme=dark]` (L32-53). The sidebar colours stay the same. Nothing in the JS sets `data-theme`.

### Base styles
- Body: `500 15px/1.6` in `--font`.
- `[hidden]{display:none!important}`.
- `:focus-visible` uses a 2px accent outline.
- `.num` uses tabular numbers; `.mono` is 13.5px mono.

### Classes used by the markup
| Area | Classes |
|---|---|
| Shell | `.app .sidebar(.open) .brand .brand-name .brand-sub .nav .nav-group .nav-item(.active) .nav-badge(.soft) .me .avatar .me-info .me-label .me-select .main .topbar .topbar-title .page-sub .topbar-actions .menu-btn .content .scrim(.open)` |
| Controls | `.btn(.primary .outline .sm .danger .solid) .icon-btn .logout .toolbar .search .chip(.active) .dot .select .input .textarea .pin .seg .switch .radio-card .copy` |
| Tables | `.card .table-wrap .cust-name .sub .bills .bill .note-cell .actions .empty .badge(.plain) .s-new .s-following .s-callback .s-won .s-lost .s-unreachable .tag(.bebe .host .self .nocall .chat-ok) .due(.overdue .today) .rep-name .camp-cell tr.sel tr.total th.r td.r` |
| Campaigns | `.camp-grid .camp(.active .all) .camp-top .camp-name .camp-meta .bar>i .camp-stats .quota` |
| Dashboard | `.kpis .kpi .kpi-label .kpi-value .kpi-foot .grid-2 .panel .panel-h .panel-b .rep-row .rep-bars .bar.won .legend .feed .feed-ic(.call .chat) .feed-body` |
| Settings | `.settings .list-row .inline-form .help` |
| Modals | `.modal-root .modal(.sm) .modal-h .modal-b .modal-f .info-grid(.wide) .tabs .tab(.active) .mini-table .timeline .tl-head .tl-note .form-grid .field(.wide) .warn .req .opt .utabs .utab(.active) .count .funnel .funnel-row(.first) .crit-row .crit-actions` |
| Channels | `.ch-bar(.mini) .ch-btn(.call) .ch-ico .ch-chips .ch-chip .chk .chk-h .chk-list` |
| Other | `.period .period-row .toast .demo-note .login .login-card .login-err` |

Defined but unused: `.stats3 .stat .mask .s-dnc`.

### Key sizes
- Sidebar 236px; topbar `min-height` 58px and sticky.
- Modal `min(780px,100%)`; `.modal.sm` 520px; modal radius 16px.
- Login card 380px.
- `.btn.sm` is pill-shaped (`border-radius:999px`).
- `td .select` (the assign select): `max-width` 170px, `margin-top` 6px.
- `.ch-btn` 32px (26px in mini).

### Breakpoints
- **≤900px:** `.grid-2` becomes a single column.
- **≤760px:**
  - the sidebar becomes a fixed off-canvas panel (`translateX(-100%)`, `.2s` transition), z-index 40;
  - the scrim is `rgba(0,0,0,.4)` at z-index 30;
  - the menu button is shown;
  - safe-area padding is applied;
  - `.search` takes 100% width;
  - `.form-grid` and `.info-grid` become one column.
- **`prefers-reduced-motion`** disables transitions.

### Z-index
topbar 5, scrim 30, sidebar 40, modal 50, toast 60, login 70.

---

## 9. Helpers and constants worth porting

- **Formatters:**
  - `esc` (L5): HTML-escapes `& < > " '`.
  - `baht(n)` (L6): `Number(n||0).toLocaleString('th-TH') + '.-'`.
  - `fmtDate(s)` (L7): string slice to `d/m/yyyy` with no leading zeros and the Gregorian year; "—" when empty.
  - `fmtDT(s)` (L8): `fmtDate` plus `" HH:MM"` (characters 11-16) when the string is longer than 10.
- **Lookups:** `rep / camp / lead` find by id (L28-30).
- **`total(l)`** (L31): `l.total`, or Σ of purchase amounts.
- **`bills(l)`** (L122): `l.bills`, or the unique purchase bills.
- **`lastSeller`** (L80).
- **Constants:**
  - `BRAND = {bebeplay:'Bebeplay', hosttail:'Hosttail'}` (L14);
  - `STATUS`, `MODES`, `PLAT`, `CRIT`;
  - `PAGE=50`;
  - Thai month abbreviations `TH` (L328);
  - SVG paths: `SEARCH_SVG` L217, `PHONE_PATH` L405, chat bubble `M4 4h16v12H7l-3 3z` (L321), `TRASH` L780, `X` close L393.
- **Time-zone behaviour:**
  - `today` is the demo string `'2026-11-04'` from `data.js`, or in live mode the **browser-local** `YYYY-MM-DD` (L979).
  - `nowStamp()` (L412) = `today` + local `HH:MM`, with no timezone suffix.
  - `localStamp(iso)` (L941) converts server timestamptz to a browser-local `YYYY-MM-DDTHH:MM` string. It is applied to `claimedAt` and interaction dates.
  - All date comparisons are lexical string compares on `YYYY-MM-DD` (`inPeriod` uses `slice(0,10)`).
  - `presetRange` uses UTC arithmetic on the `today` string, so it has no timezone drift.
  - `fmtDate` never parses a Date.
  - Chat-check timestamps (`last_admin_time`) are passed raw to `fmtDT`, so they show whatever the server returns.
  - The design assumes the browser is in Asia/Bangkok.

---

## 10. Subtle behaviours a rewrite could miss

1. **Toast:** a single element shown for **2200 ms**; a new toast restarts the timer (L124-127).
2. **Search inputs:**
   - Leads and campaign `#q` re-render the whole view on every keystroke, then restore focus and move the caret to the end (L254, L295).
   - Pool search is **debounced 300 ms** and restores focus via `keepFocus`.
   - `poolLoad` awaits a microtask before running, to avoid double renders that lose focus (L624).
3. **`ui.focusSearch`:** after "pick from bucket", the pool search box stays focused until the pool finishes loading.
4. **Pool reloads** (`pool.loaded=false`) on every campaign-page entry, after every claim, unclaim and log, and on every period change. The brand-wide `grand` count is fetched once per brand (`grandFor`).
5. **Clicking a campaign card resets the status chip to `all`.** The status, search, sort and rep filters otherwise persist across pages.
6. **Modal focus:** on open, the first field or `.btn` gets focus. Backdrop **mousedown** (not click) and **Esc** both close.
7. **`ui.dirtyRows`:** if the chat-check result changes while the customer modal is open, the table re-renders when the modal closes.
8. **Customer modal in live mode** re-renders itself once purchases load, on the same tab, which re-runs the chat check.
9. **Campaign builder:** text, select, checkbox and radio changes update state through `oninput` **without** re-rendering, which keeps focus. "ถัดไป →" enables live as the name is typed. Criterion inputs update only `#funnel`. Changing a criterion type, adding or deleting a criterion, toggling the preview, or switching tabs re-renders the whole modal. When the name is empty on the base tab, `#cf-name` is autofocused.
10. **The call link** both navigates to `tel:` and copies the phone, with a toast.
11. **JST helper:** fetch aborts after 2500 ms. In `auto` mode (after a claim) no toast is shown and there is no clipboard fallback.
12. **`verifyMine`** runs on every leads-page render, up to 10 leads, one at a time, guarded against re-entry.
13. **Unclaim permissions:** the table "ยกเลิกจอง" requires `claimedBy===me`, so assigned leads cannot be unclaimed from the table. The pool and detail views only require `owner===me`.
14. **`maxPerRep`** is enforced only for campaign-table claims, on the client. Pool claims do not check it.
15. **Live quirks:**
    - The `.demo-note` still shows on the leads page.
    - The campaign funnel is always 0 because `state.customers=[]`.
    - The `auto` claim mode maps to `self`, so the setup select shows "self" for auto campaigns.
    - The log form's closed date is not sent.
    - The commission rate is not persisted.
    - Admin rights fall back to the `dev@mpdgroup.co` email when `dsales_me` fails.
16. **After a live unclaim**, a self-sourced lead (no `campaignId`) is dropped from the local list for non-admins (L99).
17. **`route()` always clears `#topbar-actions`** before rendering; each page re-adds its buttons. The setup route redirects non-admins to `#leads`.
18. **Logout in live mode does a full page reload.** In demo mode it only shows the login overlay.
19. **Badge counts** use the unfiltered `state.leads`. In live mode that is whatever `dsales_my_leads` returned (limit 1000).
20. **The empty-state colspan** is hard-coded: 9 in the lead table, 8 in the pool.

Supporting files I touched only to confirm field names:
- `C:\Claude Ai\Directsale\directsales-web\supabase\migrations\20261117090100_dsales_schema_move.sql` (lead JSON shape, L236-259).
- `C:\Claude Ai\Directsale\directsales-web\tools\jst-helper\jst-helper.js` (listens on `127.0.0.1:47321`, `POST /open`).
