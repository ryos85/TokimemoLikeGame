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

  // ……（既存のバッジ描画の後に追記）
  let hintEl = document.getElementById("badge-hint");
  if (!hintEl) {
    hintEl = document.createElement("span");
    hintEl.id = "badge-hint";
    hintEl.className = "badge";
    statusEl.appendChild(hintEl);
  }
  const hint = (typeof getActionHintText === "function") ? getActionHintText() : "";
  hintEl.textContent = hint || "💡 おすすめ：—";

  // 週カレンダー（4月始まり、各月4週、全48週）
  const MONTHS = ["4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月", "1月", "2月", "3月"];
  const WEEKS_PER_MONTH = 4;
  const TOTAL_WEEKS = MONTHS.length * WEEKS_PER_MONTH;

  const t = Math.max(1, Math.min(turn || 1, TOTAL_WEEKS)); // 1..48 に丸め
  const idx = t - 1;
  const monthIdx = Math.floor(idx / WEEKS_PER_MONTH);
  const week = (idx % WEEKS_PER_MONTH) + 1;
  const label = `${MONTHS[monthIdx]} ${week}週`;

  // 曜日バー（装飾）
  const days = ["月", "火", "水", "木", "金", "土", "日"];
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

// カード生成（初回だけDOMを作る）
function createCharacterEl(h) {
  const el = document.createElement("div");
  el.className = "character";
  el.dataset.key = h.名前; // 不変キー（並べ替え判定に使う）
  el.innerHTML = `
    <img alt="">
    <div class="meta">
      <div class="name"></div>
      <div class="favor favor-love"></div>
      <div class="favor favor-aff"></div>
      <div class="favor favor-pref"></div>
    </div>
  `;
  return el;
}

// カード更新（表示内容を差し替え）
function updateCharacterEl(el, h, player) {
  const img = el.querySelector("img");
  img.src = h.画像;
  img.alt = h.名前;

  el.querySelector(".name").textContent = h.名前;

  const affinity = (typeof calcAffinity === "function") ? calcAffinity(player, h.嗜好) : 0;
  el.querySelector(".favor-love").textContent = `好感度: ${h.好感度}`;
  el.querySelector(".favor-aff").textContent  = `相性: ${affinity}（閾値 ${h.相性閾値}）`;
  el.querySelector(".favor-pref").textContent = `嗜好: 📘${h.嗜好.学力}% 🏃‍♂️${h.嗜好.運動}% ✨${h.嗜好.魅力}%`;
}

// キャラクター一覧を表示（好感度降順）＋FLIP並び替え＋上下移動の発光
function renderCharacters() {
  const { heroines, player } = window.state;
  const wrap = document.getElementById("characters");
  if (!wrap) return;

  // 直前のDOM順（インデックス）を記録
  const beforePos = new Map(Array.from(wrap.children).map((el, i) => [el.dataset.key, i]));
  const beforeRect = new Map(Array.from(wrap.children).map(el => [el.dataset.key, el.getBoundingClientRect()]));

  // 並べ替え（stateは不変）
  const sorted = Array.isArray(heroines)
    ? [...heroines].sort((a, b) => (b.好感度 || 0) - (a.好感度 || 0))
    : [];

  // 既存DOMを再利用
  const byKey = new Map(Array.from(wrap.children).map(el => [el.dataset.key, el]));
  const frag = document.createDocumentFragment();

  // 移動方向（up/down）を検知するためのマップ
  const moveDir = new Map(); // key -> 'up' | 'down' | undefined

  sorted.forEach((h, newIndex) => {
    let el = byKey.get(h.名前);
    if (!el) {
      // 新規作成（初回描画）
      el = document.createElement("div");
      el.className = "character";
      el.dataset.key = h.名前;
      el.innerHTML = `
        <img alt="">
        <div class="meta">
          <div class="name"></div>
          <div class="favor favor-love"></div>
          <div class="favor favor-aff"></div>
          <div class="favor favor-pref"></div>
        </div>
      `;
      // ちょいフェードイン
      el.style.opacity = "0";
      el.style.transform = "scale(0.98)";
    }

    // 表示内容の更新
    const img = el.querySelector("img");
    img.src = h.画像; img.alt = h.名前;
    el.querySelector(".name").textContent = h.名前;
    const affinity = (typeof calcAffinity === "function") ? calcAffinity(player, h.嗜好) : 0;
    el.querySelector(".favor-love").textContent = `好感度: ${h.好感度}`;
    el.querySelector(".favor-aff").textContent  = `相性: ${affinity}（閾値 ${h.相性閾値}）`;
    el.querySelector(".favor-pref").textContent = `嗜好: 📘${h.嗜好.学力}% 🏃‍♂️${h.嗜好.運動}% ✨${h.嗜好.魅力}%`;

    // 移動方向を判定（前回のインデックスと比較）
    if (beforePos.has(h.名前)) {
      const oldIndex = beforePos.get(h.名前);
      if (oldIndex > newIndex) moveDir.set(h.名前, 'up');
      else if (oldIndex < newIndex) moveDir.set(h.名前, 'down');
    }

    frag.appendChild(el);
  });

  // 反映
  wrap.innerHTML = "";
  wrap.appendChild(frag);

  // After座標
  const afterRect = new Map(Array.from(wrap.children).map(el => [el.dataset.key, el.getBoundingClientRect()]));

  // FLIP＋発光
  Array.from(wrap.children).forEach(el => {
    const key = el.dataset.key;
    const a = afterRect.get(key);
    const b = beforeRect.get(key);

    el.style.transition = "none";

    if (b) {
      // 既存カード：位置差分で移動
      const dx = b.left - a.left;
      const dy = b.top  - a.top;
      if (dx || dy) el.style.transform = `translate(${dx}px, ${dy}px)`;
      el.style.opacity = "1";
      requestAnimationFrame(() => {
        el.style.transition = "transform 240ms ease, opacity 240ms ease";
        el.style.transform = "translate(0,0)";
      });
    } else {
      // 新規カード：フェードイン
      requestAnimationFrame(() => {
        el.style.transition = "transform 240ms ease, opacity 240ms ease";
        el.style.opacity = "1";
        el.style.transform = "scale(1)";
      });
    }

    // ★ 上下移動の発光（薄青＝UP、薄赤＝DOWN）
    const dir = moveDir.get(key);
    if (dir === 'up' || dir === 'down') {
      // 既存のクラスをクリアしてから付与
      el.classList.remove('flash-up', 'flash-down');
      // 次フレームで付与すると確実に再生される
      requestAnimationFrame(() => {
        el.classList.add(dir === 'up' ? 'flash-up' : 'flash-down');
        // 終了後にクラスを外す（600ms + α）
        setTimeout(() => el.classList.remove('flash-up', 'flash-down'), 700);
      });
    }

    // 後片付け
    el.addEventListener("transitionend", function handler(e) {
      if (e.propertyName === "transform" || e.propertyName === "opacity") {
        el.style.transition = "";
      }
      el.removeEventListener("transitionend", handler);
    });
  });
}

function renderLog() {
  const logDiv = document.getElementById("log");
  const html = window.state.logs
    .map(({ msg, cls, sub, sep }) => {
      if (sep || cls === 'week-sep') {
        const label = msg ? String(msg) : '';
        return `<div class="log-sep" aria-label="week-sep"><span>${label}</span></div>`;
      }
      const bullet = sub ? "" : "• ";
      const c = cls ? cls : "";
      const s = sub ? "sub" : "";
      const clsAttr = `${c} ${s}`.trim();
      return `<div class="${clsAttr}">${bullet}${msg}</div>`;
    })
    .join("");

  logDiv.innerHTML = html;

  // ★描画完了後に一番下へ（常に最新が見える）
  requestAnimationFrame(() => {
    logDiv.scrollTop = logDiv.scrollHeight;
  });
}

// 全UIを更新する
function updateUI() {
  renderStatus();
  renderCharacters();
  renderCalendar();
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
  document.getElementById("btnStudy").disabled = !enabled;
  document.getElementById("btnSports").disabled = !enabled;
  document.getElementById("btnStyle").disabled = !enabled;
  document.getElementById("btnDate").disabled = !enabled;
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
    : () => { };

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
// 直近カレンダーを描画（最大5件）
function renderCalendar() {
  const listEl = document.getElementById("calendar");
  if (!listEl) return;

  // main.js 側で公開している取得関数を利用
  const items = (typeof getUpcomingSchedule === "function") ? getUpcomingSchedule(5) : [];

  if (!items.length) {
    listEl.innerHTML = `<div class="cal-empty">直近の予定はありません</div>`;
    return;
  }

  const html = items.map(it => {
    const now = it.isThisWeek ? ` <span class="cal-now">☆今週実施予定</span>` : "";
    return `
      <div class="cal-item">
        <div class="cal-when">${it.when}</div>
        <div class="cal-title">${it.title}${now}</div>
      </div>
    `;
  }).join("");
  listEl.innerHTML = html;
}
