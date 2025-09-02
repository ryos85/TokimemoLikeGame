// ステータスと週表示（曜日バー付き／待機中は「月」を点灯）
function renderStatus() {
  const { player, turn, maxTurn } = window.state;
  const statusEl = document.getElementById("status");
  const bg = document.getElementById("badge-gakuryoku");
  const bu = document.getElementById("badge-undou");
  const bm = document.getElementById("badge-miryoku");

  // バッジ（既存維持）
  if (bg && bu && bm) {
    bg.textContent = `📘 学力: ${player.学力}`;
    bu.textContent = `🏃‍♂️ 運動: ${player.運動}`;
    bm.textContent = `✨ 魅力: ${player.魅力}`;
  } else {
    statusEl.innerHTML = `
      <span id="badge-gakuryoku" class="badge">📘 学力: ${player.学力}</span>
      <span id="badge-undou"    class="badge">🏃‍♂️ 運動: ${player.運動}</span>
      <span id="badge-miryoku"  class="badge">✨ 魅力: ${player.魅力}</span>
    `;
  }

  // 週カレンダー（4月始まり、各月4週、全48週）
  const MONTHS = ["4月","5月","6月","7月","8月","9月","10月","11月","12月","1月","2月","3月"];
  const WEEKS_PER_MONTH = 4;
  const TOTAL_WEEKS = MONTHS.length * WEEKS_PER_MONTH;

  const t = Math.max(1, Math.min(turn || 1, TOTAL_WEEKS)); // 1..48 に丸め
  const idx = t - 1;
  const monthIdx = Math.floor(idx / WEEKS_PER_MONTH);
  const week = (idx % WEEKS_PER_MONTH) + 1;
  const label = `${MONTHS[monthIdx]} ${week}週`;

  // 曜日バー（装飾）
  const days = ["月","火","水","木","金","土","日"];
  const weekdayBar = `
    <span class="weekday-bar">
      ${days.map((d, i) => `<span class="day ${i >= 5 ? 'wkend' : ''}">${d}</span>`).join("")}
    </span>
  `;

  const turninfoEl = document.getElementById("turninfo");
  if (turninfoEl) {
    turninfoEl.innerHTML = `週：${label}（${t}/${maxTurn}）${weekdayBar}`;
    // ★待機中ハイライト（「月」を点灯）
    if (typeof setIdleMondayHighlight === "function") {
      setIdleMondayHighlight();
    }
  }
}

// キャラクター一覧を表示する（相性表示）
function renderCharacters() {
  const { heroines, player } = window.state;
  const wrap = document.getElementById("characters");
  wrap.innerHTML = "";
  heroines.forEach((h) => {
    const affinity = calcAffinity(player, h.嗜好);
    const el = document.createElement("div");
    el.className = "character";
    el.innerHTML = `
      <img src="${h.画像}" alt="${h.名前}">
      <div class="meta">
        <div class="name">${h.名前}</div>
        <div class="favor">好感度: ${h.好感度}</div>
        <div class="favor">相性: ${affinity}（閾値 ${h.相性閾値}）</div>
        <div class="favor">嗜好: 📘${h.嗜好.学力}% 🏃‍♂️${h.嗜好.運動}% ✨${h.嗜好.魅力}%</div>
      </div>
    `;
    wrap.appendChild(el);
  });
}

// イベントログを表示する
function renderLog() {
  const logDiv = document.getElementById("log");
  logDiv.innerHTML = window.state.logs
    .map(({ msg, cls, sub }) => {
      const bullet = sub ? "" : "• ";
      const c = cls ? cls : "";
      const s = sub ? "sub" : "";
      const clsAttr = `${c} ${s}`.trim();
      return `<div class="${clsAttr}">${bullet}${msg}</div>`;
    })
    .join("");
}

// 全UIを更新する
function updateUI() {
  renderStatus();
  renderCharacters();
  renderLog();
}

// バッジを発光させる
function flashBadge(id, direction = 'up') {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.remove('flash-up', 'flash-down');
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      el.classList.add(direction === 'down' ? 'flash-down' : 'flash-up');
      const dur = 600;
      setTimeout(() => {
        el.classList.remove('flash-up', 'flash-down');
      }, dur + 50);
    });
  });
}

// 行動ボタンの有効／無効を切り替える
function setActionButtonsEnabled(enabled) {
  document.getElementById("btnStudy").disabled  = !enabled;
  document.getElementById("btnSports").disabled = !enabled;
  document.getElementById("btnStyle").disabled  = !enabled;
  document.getElementById("btnDate").disabled   = !enabled;
}

// プレイヤー能力と嗜好から相性を算出する
function calcAffinity(player, pref) {
  const score =
    player.学力 * (pref.学力 ?? 0) +
    player.運動 * (pref.運動 ?? 0) +
    player.魅力 * (pref.魅力 ?? 0);
  return Math.round(score / 100);
}

/* === デート相手選択モーダル（行クリックで選択→デート先へ） === */
function openDatePicker() {
  const { heroines } = window.state;
  const list = document.getElementById("datePickerList");
  list.innerHTML = "";
  heroines.forEach((h, idx) => {
    const item = document.createElement("div");
    item.className = "picker-item clickable";
    item.innerHTML = `
      <img src="${h.画像}" alt="${h.名前}">
      <div>
        <div class="picker-name">${h.名前}</div>
        <div class="picker-favor">好感度: ${h.好感度}</div>
      </div>
    `;
    item.onclick = () => dateWith(idx);
    list.appendChild(item);
  });
  const modal = document.getElementById("datePicker");
  modal.classList.add("show");
  modal.setAttribute("aria-hidden", "false");
}
function closeDatePicker() {
  const modal = document.getElementById("datePicker");
  modal.classList.remove("show");
  modal.setAttribute("aria-hidden", "true");
}

/* === デート先選択モーダル（行クリックでデート開始） === */
function openSpotPicker(heroIndex) {
  const { dateSpots } = window.state;
  const list = document.getElementById("spotPickerList");
  list.innerHTML = "";
  dateSpots.forEach((spot) => {
    const item = document.createElement("div");
    item.className = "picker-item clickable";
    item.innerHTML = `
      <img src="images/spots/${spot.id}.png" alt="${spot.名称}" onerror="this.style.visibility='hidden'">
      <div>
        <div class="picker-spotname">${spot.名称}</div>
      </div>
    `;
    item.onclick = () => dateWithAt(heroIndex, spot.id);
    list.appendChild(item);
  });
  const modal = document.getElementById("spotPicker");
  modal.classList.add("show");
  modal.setAttribute("aria-hidden", "false");
}
function closeSpotPicker() {
  const modal = document.getElementById("spotPicker");
  modal.classList.remove("show");
  modal.setAttribute("aria-hidden", "true");
}
// ================================
// 1週間の経過を演出（曜日を順にハイライト）
// 呼び出し側で await して使う
// ================================
async function animateWeekPassage() {
  const s = window.state || (window.state = {});
  s._isAnimatingWeek = true;

  const bar = document.querySelector('#turninfo .weekday-bar');
  if (!bar) { s._isAnimatingWeek = false; return; }

  const days = Array.from(bar.querySelectorAll('.day'));
  if (days.length !== 7) { s._isAnimatingWeek = false; return; }

  // ボタン一時無効化（関数が無ければ無視）
  const safeToggle = (typeof setActionButtonsEnabled === "function")
    ? setActionButtonsEnabled
    : () => {};

  safeToggle(false);

  const stepMs = 120; // アニメ速度
  for (let i = 0; i < days.length; i++) {
    if (i > 0) {
      days[i - 1].classList.remove('active');
      days[i - 1].classList.add('past');
    }
    days[i].classList.add('active');
    await new Promise(r => setTimeout(r, stepMs));
  }

  // 余韻
  await new Promise(r => setTimeout(r, 120));

  // クリーンアップ：痕跡を消す（次の待機で「月」が点灯する前提）
  days.forEach(d => d.classList.remove('active', 'past'));

  safeToggle(true);
  s._isAnimatingWeek = false;

  // ※この後、nextTurn() 側で state.turn++ → updateUI() が走り、
  //   renderStatus() 経由で setIdleMondayHighlight() が再び「月」を点灯させます。
}

// ================================
// 待機中ハイライト：「月」を点灯（週アニメ中は何もしない）
// ================================
function setIdleMondayHighlight() {
  const s = window.state || {};
  if (s._isAnimatingWeek) return;

  const bar = document.querySelector('#turninfo .weekday-bar');
  if (!bar) return;

  // 既にアニメ痕跡があれば（active/past）触らない
  if (bar.querySelector('.day.active, .day.past')) return;

  const days = bar.querySelectorAll('.day');
  if (days.length === 7) {
    days[0].classList.add('active'); // 「月」
  }
}
