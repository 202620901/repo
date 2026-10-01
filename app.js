const ITEMS = [
  { id: "futsalball", name: "풋살공", icon: "⚽", stock: 5 },
  { id: "basketball", name: "농구공", icon: "🏀", stock: 10 },
  { id: "volleyball", name: "배구공", icon: "🏐", stock: 5 },
  { id: "jokguball", name: "족구공", icon: "🏐", stock: 5 },
  { id: "racket", name: "라켓", icon: "🏸", stock: 20 },
  { id: "cock", name: "콕", icon: '<img class="icon-img" src="shuttlecock.svg" alt="배드민턴 콕">', stock: 12, maxPerRental: 2 }
];

const BALL_SLOTS = ["17:00~18:30", "19:00~20:30"];

const GYM_SLOTS = [
  "17:00~17:30",
  "17:30~18:00",
  "18:00~18:30",
  "19:00~19:30",
  "19:30~20:00",
  "20:00~20:30"
];

const FACILITIES = [
  { id: "jokgu", name: "족구장", icon: "🏐", desc: "야외 족구장 (통째 이용)", capacity: 1, type: "ball", slots: BALL_SLOTS },
  { id: "futsal", name: "풋살장", icon: "⚽", desc: "인조잔디 풋살장", capacity: 1, type: "ball", slots: BALL_SLOTS },
  { id: "basket", name: "농구장", icon: "🏀", desc: "야외 농구장", capacity: 1, type: "ball", slots: BALL_SLOTS },
  { id: "badminton", name: "배드민턴코트", icon: "🏸", desc: "강당 내 3코트 (코트별 예약)", capacity: 3, unit: "코트", type: "ball", slots: BALL_SLOTS },
  { id: "volley", name: "배구네트", icon: "🏐", desc: "네트 설치 코트", capacity: 1, type: "ball", slots: BALL_SLOTS },
  { id: "gym", name: "헬스장", icon: "🏋️", desc: "운동기구 이용 (30분 단위, 타임당 최대 7명)", capacity: 7, unit: "인원", type: "gym", slots: GYM_SLOTS }
];

const LS_FAC = "fz_facility_reservations";
const LS_ITEM = "fz_item_rentals";

let selectedFacility = null;
let selectedItem = null;
let selectedSlot = null;
let ttFacility = "jokgu";

const $ = (id) => document.getElementById(id);

function load(key) {
  try {
    return JSON.parse(localStorage.getItem(key)) || [];
  } catch {
    return [];
  }
}

function save(key, list) {
  localStorage.setItem(key, JSON.stringify(list));
}

function todayStr() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
}

function gradeClass(studentId) {
  const c = String(studentId || "").charAt(0);
  return c === "1" ? "g1" : c === "2" ? "g2" : c === "3" ? "g3" : "";
}

function nextCourt(list, facilityId, date, slot, cap) {
  const used = list
    .filter((r) => r.facilityId === facilityId && r.date === date && r.time === slot)
    .map((r) => r.court || 1);
  for (let i = 1; i <= cap; i++) {
    if (!used.includes(i)) return i;
  }
  return null;
}

function migrate() {
  const fac = load(LS_FAC);
  let changed = false;
  fac.forEach((r) => {
    if (r.className) {
      r.studentId = r.studentId || r.className;
      delete r.className;
      changed = true;
    }
  });
  if (changed) save(LS_FAC, fac);

  const items = load(LS_ITEM);
  changed = false;
  items.forEach((r) => {
    if (r.className) {
      r.studentId = r.studentId || r.className;
      delete r.className;
      changed = true;
    }
    if (!r.status) {
      r.status = "pending";
      changed = true;
    }
  });
  if (changed) save(LS_ITEM, items);
}

function showToast(msg, isError) {
  const t = $("toast");
  t.textContent = msg;
  t.className = isError ? "error" : "";
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.add("hidden"), 2600);
}

function initTabs() {
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
      document.querySelectorAll(".tab-content").forEach((c) => c.classList.remove("active"));
      btn.classList.add("active");
      $("tab-" + btn.dataset.tab).classList.add("active");
    });
  });
}

function renderFacilities() {
  const list = load(LS_FAC);
  $("facility-list").innerHTML = FACILITIES.map((f) => {
    const booked = list.filter((r) => r.facilityId === f.id && r.date === todayStr()).length;
    const badge =
      f.capacity > 1
        ? `오늘 ${booked}건 예약`
        : `오늘 ${booked}/${f.slots.length} 예약됨`;
    return `
      <div class="fac-card ${selectedFacility === f.id ? "selected" : ""}" data-id="${f.id}">
        <div class="fac-icon">${f.icon}</div>
        <div class="fac-name">${f.name}</div>
        <div class="fac-desc">${f.desc}</div>
        <span class="badge">${badge}</span>
      </div>`;
  }).join("");

  document.querySelectorAll(".fac-card").forEach((card) => {
    card.addEventListener("click", () => openFacilityForm(card.dataset.id));
  });
}

function openFacilityForm(facilityId) {
  selectedFacility = facilityId;
  selectedSlot = null;
  const fac = FACILITIES.find((f) => f.id === facilityId);
  $("facility-form-title").textContent = `${fac.icon} ${fac.name} 예약`;
  $("facility-form-panel").classList.remove("hidden");
  const dateInput = $("fac-date");
  dateInput.min = todayStr();
  if (!dateInput.value) dateInput.value = todayStr();
  renderSlots();
  renderFacilityStatus();
  renderFacilities();
  $("facility-form-panel").scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function renderSlots() {
  const reservations = load(LS_FAC);
  const date = $("fac-date").value;
  const fac = FACILITIES.find((f) => f.id === selectedFacility);
  const cap = fac.capacity;
  $("fac-slots").innerHTML = fac.slots.map((slot) => {
    const booked = reservations.filter(
      (r) => r.facilityId === selectedFacility && r.date === date && r.time === slot
    ).length;
    const full = booked >= cap;
    const label = cap > 1 ? `${slot} (${booked}/${cap})` : slot;
    return `<button type="button" class="slot-btn ${full ? "taken" : ""} ${selectedSlot === slot ? "active" : ""}" data-slot="${slot}" ${full ? "disabled" : ""}>${label}</button>`;
  }).join("");

  document.querySelectorAll(".slot-btn:not(.taken)").forEach((btn) => {
    btn.addEventListener("click", () => {
      selectedSlot = btn.dataset.slot;
      renderSlots();
    });
  });
}

function renderFacilityStatus() {
  const reservations = load(LS_FAC);
  const date = $("fac-date").value;
  const sf = FACILITIES.find((f) => f.id === selectedFacility);
  const cap = sf.capacity;
  const rows = reservations
    .filter((r) => r.facilityId === selectedFacility && r.date === date)
    .sort((a, b) => (a.time > b.time ? 1 : a.time < b.time ? -1 : (a.court || 1) - (b.court || 1)))
    .map((r) => `<li><span class="grade-dot ${gradeClass(r.studentId)}"></span>${r.time}${cap > 1 ? ` · ${sf.unit} ${r.court || 1}` : ""} — ${r.name} (${r.studentId})</li>`);
  $("fac-status-list").innerHTML = rows.length
    ? rows.join("")
    : `<li>아직 예약이 없습니다. 첫 번째로 예약해보세요! 🎉</li>`;
}

$("facility-form").addEventListener("submit", (e) => {
  e.preventDefault();
  if (!selectedSlot) {
    showToast("시간대를 선택해 주세요.", true);
    return;
  }
  const fac = FACILITIES.find((f) => f.id === selectedFacility);
  const list = load(LS_FAC);
  const date = $("fac-date").value;
  const studentId = $("fac-student-id").value.trim();
  const myRes = list.filter((r) => r.date === date && r.studentId === studentId);
  const fmtRes = (r) => {
    const f = FACILITIES.find((x) => x.id === r.facilityId);
    return `${f.name} ${r.time}${f.capacity > 1 ? ` (${f.unit} ${r.court || 1})` : ""}`;
  };
  if (fac.type === "ball") {
    const dup = myRes.find((r) => FACILITIES.find((x) => x.id === r.facilityId).type === "ball");
    if (dup) {
      showToast(`구기종목은 하루 1타임만 예약할 수 있습니다. (신청 완료: ${fmtRes(dup)})`, true);
      return;
    }
  } else {
    const gymCount = myRes.filter((r) => FACILITIES.find((x) => x.id === r.facilityId).type === "gym").length;
    if (gymCount >= 2) {
      showToast("헬스장은 하루 최대 2타임까지 예약할 수 있습니다.", true);
      return;
    }
  }
  const court = fac.capacity > 1 ? nextCourt(list, selectedFacility, date, selectedSlot, fac.capacity) : 1;
  if (!court) {
    showToast("해당 시간대는 모두 예약되었습니다.", true);
    renderSlots();
    return;
  }
  list.push({
    id: crypto.randomUUID(),
    facilityId: selectedFacility,
    date,
    time: selectedSlot,
    court,
    name: $("fac-name").value.trim(),
    studentId: $("fac-student-id").value.trim(),
    createdAt: new Date().toISOString()
  });
  save(LS_FAC, list);
  showToast(fac.capacity > 1 ? `✅ 예약 완료! (${fac.unit} ${court})` : "✅ 예약이 완료되었습니다!");
  selectedSlot = null;
  $("facility-form").reset();
  $("fac-date").min = todayStr();
  $("fac-date").value = todayStr();
  renderSlots();
  renderFacilityStatus();
  renderFacilities();
  renderMyList();
  renderTimetable();
});

$("fac-date").addEventListener("change", () => {
  selectedSlot = null;
  renderSlots();
  renderFacilityStatus();
});

$("facility-close").addEventListener("click", () => {
  $("facility-form-panel").classList.add("hidden");
  selectedFacility = null;
  renderFacilities();
});

function remainingQty(itemId, date) {
  const rentals = load(LS_ITEM);
  const used = rentals
    .filter((r) => r.itemId === itemId && r.date === date && r.status !== "done")
    .reduce((sum, r) => sum + r.qty, 0);
  const item = ITEMS.find((i) => i.id === itemId);
  return item.stock - used;
}

function renderItems() {
  $("item-list").innerHTML = ITEMS.map((it) => {
    const remain = remainingQty(it.id, todayStr());
    const cls = remain <= 0 ? "out" : remain <= Math.ceil(it.stock * 0.3) ? "low" : "";
    const label = remain <= 0 ? "모두 대여됨" : `남은 수량 ${remain}개`;
    return `
      <div class="item-card ${selectedItem === it.id ? "selected" : ""}" data-id="${it.id}">
        <div class="item-icon">${it.icon}</div>
        <div class="item-name">${it.name}</div>
        <span class="badge ${cls}">${label}</span>
      </div>`;
  }).join("");

  document.querySelectorAll(".item-card").forEach((card) => {
    card.addEventListener("click", () => openItemForm(card.dataset.id));
  });
}

function openItemForm(itemId) {
  selectedItem = itemId;
  const item = ITEMS.find((i) => i.id === itemId);
  $("item-form-title").innerHTML = `${item.icon} ${item.name} 대여`;
  $("item-form-panel").classList.remove("hidden");
  const dateInput = $("item-date");
  dateInput.min = todayStr();
  if (!dateInput.value) dateInput.value = todayStr();
  updateItemRemaining();
  renderItems();
  $("item-form-panel").scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function updateItemRemaining() {
  if (!selectedItem) return;
  const item = ITEMS.find((i) => i.id === selectedItem);
  const remain = remainingQty(selectedItem, $("item-date").value);
  const cap = item.maxPerRental || remain;
  const max = Math.max(Math.min(remain, cap), 1);
  $("item-remaining").textContent =
    remain > 0
      ? `대여 가능 수량: ${remain}개${item.maxPerRental ? ` · 1인 최대 ${item.maxPerRental}개` : ""}`
      : "해당 날짜는 모두 대여되었습니다.";
  $("item-qty").max = max;
  $("item-qty").value = Math.min(Number($("item-qty").value) || 1, max);
}

$("item-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const qty = Number($("item-qty").value);
  const date = $("item-date").value;
  const item = ITEMS.find((i) => i.id === selectedItem);
  const remain = remainingQty(selectedItem, date);
  const cap = item.maxPerRental || remain;
  if (qty < 1 || qty > remain) {
    showToast(`대여 가능 수량은 1~${Math.min(remain, cap)}개 입니다.`, true);
    return;
  }
  if (qty > cap) {
    showToast(`1인당 최대 ${cap}개까지 대여할 수 있습니다.`, true);
    return;
  }
  const list = load(LS_ITEM);
  list.push({
    id: crypto.randomUUID(),
    itemId: selectedItem,
    date,
    qty,
    name: $("item-name").value.trim(),
    studentId: $("item-student-id").value.trim(),
    status: "pending",
    createdAt: new Date().toISOString()
  });
  save(LS_ITEM, list);
  showToast("✅ 대여 신청이 완료되었습니다!");
  $("item-form").reset();
  $("item-date").min = todayStr();
  $("item-date").value = todayStr();
  $("item-qty").value = 1;
  updateItemRemaining();
  renderItems();
  renderMyList();
});

$("item-date").addEventListener("change", updateItemRemaining);

$("item-close").addEventListener("click", () => {
  $("item-form-panel").classList.add("hidden");
  selectedItem = null;
  renderItems();
});

function renderMyList() {
  const facRes = load(LS_FAC).map((r) => {
    const fac = FACILITIES.find((f) => f.id === r.facilityId);
    return {
      type: "fac",
      id: r.id,
      title: fac.name,
      sub: `📅 ${r.date} · ⏰ ${r.time}${fac.capacity > 1 ? ` · ${fac.unit} ${r.court || 1}` : ""} · ${r.name} (${r.studentId})`
    };
  });
  const itemRes = load(LS_ITEM).map((r) => ({
    type: "item",
    id: r.id,
    title: ITEMS.find((i) => i.id === r.itemId).name,
    sub: `📅 ${r.date} · 🔢 ${r.qty}개 · ${r.name} (${r.studentId})`,
    status: r.status || "pending"
  }));
  const all = [...facRes, ...itemRes].sort((a, b) => (a.sub > b.sub ? -1 : 1));

  if (!all.length) {
    $("my-list").innerHTML = `<div class="empty">아직 신청 내역이 없습니다.<br>시설 예약이나 용품 대여를 신청해보세요!</div>`;
    return;
  }

  $("my-list").innerHTML = all
    .map(
      (r) => `
      <div class="history-card">
        <div class="history-info">
          <div class="h-title">
            <span class="tag ${r.type}">${r.type === "fac" ? "시설 예약" : "용품 대여"}</span>${r.title}
            ${r.type === "item" ? `<span class="status ${r.status === "done" ? "done" : "pending"}">${r.status === "done" ? "제출 완료" : "미완료"}</span>` : ""}
          </div>
          <div class="h-sub">${r.sub}</div>
        </div>
        <div class="history-actions">
          ${r.type === "item" ? `<button class="status-btn" data-id="${r.id}">${r.status === "done" ? "↩ 미완료 처리" : "✅ 제출 완료 처리"}</button>` : ""}
          <button class="cancel-btn" data-type="${r.type}" data-id="${r.id}">취소</button>
        </div>
      </div>`
    )
    .join("");

  document.querySelectorAll(".status-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const list = load(LS_ITEM);
      const rec = list.find((r) => r.id === btn.dataset.id);
      if (!rec) return;
      rec.status = rec.status === "done" ? "pending" : "done";
      save(LS_ITEM, list);
      showToast(rec.status === "done" ? "✅ 제출 완료로 처리했습니다." : "미완료로 변경했습니다.");
      renderMyList();
      renderItems();
      if (selectedItem) updateItemRemaining();
    });
  });

  document.querySelectorAll(".cancel-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (!confirm("정말 취소하시겠습니까?")) return;
      const key = btn.dataset.type === "fac" ? LS_FAC : LS_ITEM;
      save(key, load(key).filter((r) => r.id !== btn.dataset.id));
      showToast("취소되었습니다.");
      renderMyList();
      renderFacilities();
      renderItems();
      renderTimetable();
      if (selectedFacility) {
        renderSlots();
        renderFacilityStatus();
      }
      if (selectedItem) updateItemRemaining();
    });
  });
}

function renderTimetable() {
  const fac = FACILITIES.find((f) => f.id === ttFacility);
  const cap = fac.capacity;
  const date = $("tt-date").value || todayStr();
  const list = load(LS_FAC).filter((r) => r.facilityId === ttFacility && r.date === date);
  const courtIds = cap > 1 ? Array.from({ length: cap }, (_, i) => i + 1) : [1];

  let html = `
    <div class="tt-title">${fac.icon} ${fac.name} · ${date} ${cap > 1 ? (fac.type === "gym" ? `(타임당 최대 ${cap}명)` : `(${cap}코트)`) : ""}</div>
    <table class="tt-table">
      <thead>
        <tr><th>시간대</th>${courtIds.map((c) => `<th>${cap > 1 ? fac.unit + " " + c : "예약자"}</th>`).join("")}</tr>
      </thead>
      <tbody>`;

  for (const slot of fac.slots) {
    html += `<tr><td class="tt-time">${slot}</td>`;
    for (const c of courtIds) {
      const r = list.find((x) => x.time === slot && (x.court || 1) === c);
      html += r
        ? `<td class="booked ${gradeClass(r.studentId)}">${r.name}<span>${r.studentId}</span></td>`
        : `<td class="free">예약 가능</td>`;
    }
    html += `</tr>`;
  }

  html += `
    </tbody>
    </table>
    <div class="tt-legend">
      <span><i class="grade-dot g1"></i>1학년</span>
      <span><i class="grade-dot g2"></i>2학년</span>
      <span><i class="grade-dot g3"></i>3학년</span>
    </div>`;
  $("tt-table-wrap").innerHTML = html;

  $("tt-facilities").innerHTML = FACILITIES.map(
    (f) => `<button type="button" class="chip ${f.id === ttFacility ? "active" : ""}" data-id="${f.id}">${f.icon} ${f.name}</button>`
  ).join("");
}

function initTimetable() {
  const d = $("tt-date");
  d.min = todayStr();
  d.value = todayStr();
  d.addEventListener("change", renderTimetable);
  $("tt-facilities").addEventListener("click", (e) => {
    const chip = e.target.closest(".chip");
    if (!chip) return;
    ttFacility = chip.dataset.id;
    renderTimetable();
  });
  renderTimetable();
}

function init() {
  migrate();
  initTabs();
  renderFacilities();
  renderItems();
  renderMyList();
  initTimetable();
}

init();
