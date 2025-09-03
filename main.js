async function init() {
  await preloadEvents();                       // 1) 読み込み
  debugEventsSelfCheck();                     // 2) 状況をログに出す（1回だけ）
  updateUI();
  await runEntranceCeremony();
}
window.addEventListener('DOMContentLoaded', init);

async function nextTurn() {
  const s = window.state;

  try {
    if (typeof animateWeekPassage === 'function') {
      await animateWeekPassage();
    }

    // 行動後：当週のイベントを発火
    const summary = (typeof triggerWeeklyEvents === 'function')
      ? await triggerWeeklyEvents(s.turn)
      : { titles: [] };

    // 週まとめ（最新が上に来ます）
    const weekLine = (summary.titles && summary.titles.length)
      ? `イベント：${summary.titles.join('、')}`
      : `イベント：なし`;
    const dateLine = `デート：${s._hadDateThisWeek ? 'あり' : 'なし'}`;
    pushGroup([
      { msg: `📌 今週のまとめ` },
      { msg: weekLine, sub: true },
      { msg: dateLine, sub: true }
    ]);

    // 週を進める＆フラグリセット
    s.turn += 1;
    // 週区切り（次の週の先頭に置く）
    if (s.turn <= s.maxTurn && typeof pushLog === 'function') {
      pushLog({ msg: makeWeekLabel(s.turn), cls: 'week-sep', sep: true });
    }
    s._hadDateThisWeek = false;

  } finally {
    if (s.turn > s.maxTurn) { endGame(); return; }
    if (typeof setActionButtonsEnabled === 'function') setActionButtonsEnabled(true);
    updateUI();
  }
}

function endGame() {
  setActionButtonsEnabled(false);
  document.getElementById("restartBtn").style.display = "block";
  const winner = window.state.heroines.find(h => h.好感度 >= 70);
  if (winner) {
    pushLog({ msg: `${winner.名前}と結ばれました！` });
  } else {
    pushLog({ msg: "誰とも結ばれませんでした…" });
  }
  updateUI();
}

function resetGame() {
  window.state = createInitialState();
  setActionButtonsEnabled(true);
  document.getElementById("restartBtn").style.display = "none";
  updateUI();
}

// ================================
// 週ミニイベント：読込・正規化・発火
// ================================
const _MONTHS_ORDER = [4, 5, 6, 7, 8, 9, 10, 11, 12, 1, 2, 3];
function _mwToWeekNumber(m, w) {
  const idx = _MONTHS_ORDER.indexOf(Number(m));
  if (idx < 0 || w < 1 || w > 4) return null;
  return idx * 4 + Number(w); // 1..48
}

async function preloadEvents() {
  const s = window.state;
  if (s._eventsReady) return;

  let data = null;

  // 0) file:// 用 JS直読み
  if (Array.isArray(window.GAME_EVENTS)) data = window.GAME_EVENTS;

  // 1) JSON
  if (!Array.isArray(data)) {
    try {
      const res = await fetch('data/events.json', { cache: 'no-store' });
      if (res.ok) data = await res.json();
    } catch (_) { }
  }

  // 2) インライン
  if (!Array.isArray(data)) {
    const tag = document.getElementById('events-data');
    if (tag) {
      try { data = JSON.parse((tag.textContent || '').trim()); } catch (_) { }
    }
  }

  // 3) フォールバック
  if (!Array.isArray(data)) {
    data = [{
      month: 4, week: 1, title: "入学式",
      messages: ["入学式があった。新しい生活が始まる。"],
      effects: { affection: { all: 0 } } // ← player省略OK
    }];
  }

  // —— バリデーション（player=任意 / affection=必須・空不可）——
  const MONTHS_ORDER = [4, 5, 6, 7, 8, 9, 10, 11, 12, 1, 2, 3];
  const isObj = v => v && typeof v === 'object' && !Array.isArray(v);

  const validAffection = (obj) => {
    if (!isObj(obj)) return false;
    if (typeof obj.all === 'number') return true;
    if (isObj(obj.byName)) {
      for (const v of Object.values(obj.byName)) if (typeof v === 'number') return true;
    }
    return false;
  };
  const validPlayerOpt = (obj) => {
    if (obj == null) return true;  // 省略OK
    if (!isObj(obj)) return false; // 空{}もOK（読み飛ばし）
    return true;
  };
  const monthWeekToWeek = (month, week) => {
    const idx = MONTHS_ORDER.indexOf(Number(month));
    if (idx < 0 || week < 1 || week > 4) return null;
    return idx * 4 + Number(week); // 1..48
  };

  s._eventsByWeek = {};
  s._eventsErrors = [];

  data.forEach((ev, i) => {
    if (!isObj(ev)) return;

    if (typeof ev.month !== 'number' || typeof ev.week !== 'number') {
      s._eventsErrors.push(`イベント#${i}（${ev.title || '無題'}）: month/week が数値で必須`);
      return;
    }
    const weekNum = monthWeekToWeek(ev.month, ev.week);
    if (!weekNum) {
      s._eventsErrors.push(`イベント#${i}（${ev.title || '無題'}）: month/week の範囲が不正（month=4..3循環, week=1..4）`);
      return;
    }

    if (!isObj(ev.effects) || !validAffection(ev.effects.affection) || !validPlayerOpt(ev.effects.player)) {
      s._eventsErrors.push(`イベント#${i}（${ev.title || '無題'}）: effects.affection は必須（空不可）／ effects.player は任意（空可）`);
      return;
    }

    (s._eventsByWeek[weekNum] ||= []).push(ev);
  });

  if (s._eventsErrors.length) console.warn('[events] 設定エラー:', s._eventsErrors);
  s._eventsReady = true;
}

function applyEventEffects(ev) {
  const s = window.state;
  const eff = ev.effects || {};
  const lines = [];

  // Player（任意）：数値キーのみ適用。±0でもログを出す
  if (eff.player && typeof eff.player === 'object') {
    for (const [k, delta] of Object.entries(eff.player)) {
      if (typeof delta !== 'number') continue;
      if (typeof s.player?.[k] !== 'number') continue;
      const before = s.player[k];
      const after = before + delta;
      s.player[k] = after;
      const sign = delta >= 0 ? `+${delta}` : `${delta}`;
      lines.push(`${k} ${before} → ${after}（${sign}）`);
    }
  }

  // Affection（必須）：all / byName。±0でもログを出す
  if (eff.affection && typeof eff.affection === 'object') {
    if ('all' in eff.affection && typeof eff.affection.all === 'number') {
      const d = eff.affection.all;
      s.heroines.forEach(h => { h.好感度 += d; });
      const sign = d >= 0 ? `+${d}` : `${d}`;
      lines.push(`好感度（全員）${sign}`);
    }
    if (eff.affection.byName && typeof eff.affection.byName === 'object') {
      for (const [name, d] of Object.entries(eff.affection.byName)) {
        if (typeof d !== 'number') continue;
        const h = s.heroines.find(x => x.名前 === name);
        if (!h) continue;
        const b = h.好感度;
        h.好感度 += d;
        const sign = d >= 0 ? `+${d}` : `${d}`;
        lines.push(`${name} 好感度 ${b} → ${h.好感度}（${sign}）`);
      }
    }
  }

  return lines.length ? `効果：${lines.join(' / ')}` : '効果：なし（±0）';
}

// 週イベント発火（当週）→ タイトル配列を返す
async function triggerWeeklyEvents(weekNum) {
  const s = window.state;
  const fromFile = s._eventsByWeek?.[weekNum] || [];
  const fromBirthday = collectBirthdaysForWeek(weekNum);
  const all = fromFile.concat(fromBirthday);
  if (all.length === 0) return { titles: [] };

  const ordered = all.map((ev, idx) => ({ ev, idx })).sort((a, b) => {
    const pa = Number(a.ev.priority || 0), pb = Number(b.ev.priority || 0);
    if (pb !== pa) return pb - pa;
    const ta = a.ev.type === 'birthday' ? 1 : 0;
    const tb = b.ev.type === 'birthday' ? 1 : 0;
    if (tb !== ta) return tb - ta;
    return a.idx - b.idx;
  });

  const titles = [];
  for (const { ev } of ordered) {
    const title = String(ev.title || (ev.type === 'birthday' ? '誕生日' : 'イベント'));
    titles.push(title);

    if (ev.kind === 'test') {
      await handleTestEvent(ev);
    } else if (ev.type === 'birthday') {
      await handleBirthdayEvent(ev);
    } else {
      const group = [{ msg: `🎉 イベント：${ev.title}` }];
      const msgs = Array.isArray(ev.messages) ? ev.messages : [];
      msgs.forEach(m => group.push({ msg: String(m), sub: true }));
      const effLine = applyEventEffects(ev);
      if (effLine) group.push({ msg: effLine, sub: true, cls: 'info' });
      pushGroup(group);
    }
  }
  return { titles };
}

// week番号(1..48) → {month, week}
function weekToMonthWeek(weekNum) {
  const MONTHS_ORDER = [4, 5, 6, 7, 8, 9, 10, 11, 12, 1, 2, 3];
  const idx = weekNum - 1;
  return {
    month: MONTHS_ORDER[Math.floor(idx / 4)],
    week: (idx % 4) + 1
  };
}

// キャラ設定から誕生日イベントを作る
function collectBirthdaysForWeek(weekNum) {
  const s = window.state;
  const { month, week } = weekToMonthWeek(weekNum);
  const out = [];

  (s.heroines || []).forEach(h => {
    const b = h.誕生日;
    if (!b) return;
    if (Number(b.month) !== month || Number(b.week) !== week) return;

    const name = h.名前;
    out.push({
      month, week,
      title: `${name}の誕生日`,
      type: 'birthday',
      targetName: name,
      priority: Number(b.priority || 10),
      messages: Array.isArray(b.messages) ? b.messages : [`今日は${name}の誕生日だ。プレゼントはどうしよう？`],
      // 基本効果（省略可）：affectionはbyName: name:0 を最低限入れておく
      effects: (b.effects && typeof b.effects === 'object')
        ? b.effects
        : { player: {}, affection: { byName: { [name]: 0 } } },
      // gifts があれば使う
      giftOptions: Array.isArray(b.gifts) ? b.gifts : null
    });
  });

  return out;
}

// 誕生日処理（ギフト選択→効果上乗せを1グループでログ出力）
async function handleBirthdayEvent(ev) {
  const s = window.state;
  const name = ev.targetName;
  const hero = s.heroines.find(h => h.名前 === name);

  // ログを1つの配列にまとめる（最後に pushGroup を1回だけ）
  const group = [];
  group.push({ msg: `🎂 誕生日：${ev.title || (name ? `${name}の誕生日` : '誕生日')}` }); // 見出し（bullet付き）
  const msgs = Array.isArray(ev.messages) ? ev.messages : [];
  msgs.forEach(m => group.push({ msg: String(m), sub: true })); // 本文

  // 対象キャラが見つからない場合は、そのまま効果適用だけ
  if (!hero) {
    const effLine = applyEventEffects(ev);
    if (effLine) group.push({ msg: effLine, sub: true, cls: 'info' });
    pushGroup(group);
    return;
  }

  // オプション（キャラ設定優先 → イベント内 → デフォルト）
  const options = Array.isArray(ev.giftOptions) && ev.giftOptions.length
    ? ev.giftOptions
    : [
      { id: 'flower', label: '花束', effects: { affection: { byName: { [name]: 2 } } } },
      { id: 'sweet', label: 'スイーツ', effects: { affection: { byName: { [name]: 1 } } } },
      { id: 'none', label: '何もしない', effects: { affection: { byName: { [name]: 0 } } } }
    ];

  // ギフト選択（null=渡さない）
  const picked = await showGiftModal(name, options);
  const gift = picked || { id: 'none', label: '何もしない', effects: { affection: { byName: { [name]: 0 } } } };

  // base effects にギフト効果を上乗せ
  const merged = mergeEffects(ev.effects, gift.effects);
  const evWithGift = { ...ev, effects: merged };

  // 効果を適用し、ギフト行→効果行の順で sub 表示
  const effLine = applyEventEffects(evWithGift);
  group.push({ msg: `🎁 プレゼント：${gift.label}`, sub: true });
  if (effLine) group.push({ msg: effLine, sub: true, cls: 'info' });

  // まとめて先頭へ積む（見出し→本文→ギフト→効果の順に並ぶ）
  pushGroup(group);
}

// ================================
// テストイベント（学力しきい値は term ごとに変動）
// term: "spring" | "summer" | "winter"
// ================================
async function handleTestEvent(ev) {
  const s = window.state;
  const g = s.player?.学力 ?? 0;

  // termごとのしきい値
  const thresholds = {
    spring: { A: 60, B: 40 }, // 4月
    summer: { A: 70, B: 50 }, // 7月
    winter: { A: 80, B: 60 }, // 12月
  };
  const th = thresholds[ev.term] || thresholds.summer;

  // ログを1グループにまとめて、最後に pushGroup を1回だけ呼ぶ
  const group = [];
  group.push({ msg: `📝 テスト：${ev.title || "学力テスト"}` });           // 見出し（bullet付き）
  const msgs = Array.isArray(ev.messages) ? ev.messages : [];
  msgs.forEach(m => group.push({ msg: String(m), sub: true }));        // 本文
  group.push({ msg: `学力：${g}`, sub: true });                        // 学力表示

  // ランク判定
  let rank = 'C';
  if (g >= th.A) rank = 'A';
  else if (g >= th.B) rank = 'B';

  // 効果 & 追記ログ（sub:true で段下げ）
  if (rank === 'A') {
    s.heroines.forEach(h => { h.好感度 += 2; });
    if (s.heroines.length > 0) {
      const idx = Math.floor(Math.random() * s.heroines.length);
      s.heroines[idx].好感度 += 1;
      group.push({ msg: `成績優秀！クラスの注目を集めた。全員 +2 / ${s.heroines[idx].名前} +1`, sub: true, cls: 'info' });
    } else {
      group.push({ msg: `成績優秀！全員 +2`, sub: true, cls: 'info' });
    }
  } else if (rank === 'B') {
    group.push({ msg: `そこそこの成績。特筆なし。`, sub: true });
  } else {
    s.heroines.forEach(h => { h.好感度 -= 1; });
    group.push({ msg: `成績不振…先生に注意された。全員 −1`, sub: true, cls: 'down' });
  }

  // まとめて先頭へ積む（見出し→本文→結果の順で表示される）
  pushGroup(group);
}


// 効果マージ（player/affection を数値加算）
function mergeEffects(base, extra) {
  const out = { player: {}, affection: {} };
  const addNum = (obj, k, v) => { obj[k] = (typeof obj[k] === 'number' ? obj[k] : 0) + (typeof v === 'number' ? v : 0); };

  // player
  if (base?.player) for (const [k, v] of Object.entries(base.player)) addNum(out.player, k, v);
  if (extra?.player) for (const [k, v] of Object.entries(extra.player)) addNum(out.player, k, v);

  // affection: all —— 0でも「キーが存在していれば」保持
  const hasAll =
    (base?.affection && Object.prototype.hasOwnProperty.call(base.affection, 'all')) ||
    (extra?.affection && Object.prototype.hasOwnProperty.call(extra.affection, 'all'));
  const allVal = (base?.affection?.all ?? 0) + (extra?.affection?.all ?? 0);
  if (hasAll) out.affection.all = allVal;

  // affection: byName
  const dst = {};
  if (base?.affection?.byName) for (const [k, v] of Object.entries(base.affection.byName)) addNum(dst, k, v);
  if (extra?.affection?.byName) for (const [k, v] of Object.entries(extra.affection.byName)) addNum(dst, k, v);
  if (Object.keys(dst).length) out.affection.byName = dst;

  return out;
}


// ギフト選択モーダル（Promise で選択肢を返す）
function showGiftModal(targetName, options) {
  return new Promise(resolve => {
    const ov = document.createElement('div');
    ov.className = 'bday-overlay';

    const modal = document.createElement('div');
    modal.className = 'bday-modal';
    modal.innerHTML = `
      <h3>${targetName}にプレゼントを渡す</h3>
      <p>プレゼントを選んでください（渡さない場合は「閉じる」か背景クリック/Esc）</p>
      <div class="gift-list"></div>
      <div class="close-row"><button id="gift-cancel">閉じる</button></div>
    `;
    ov.appendChild(modal);
    document.body.appendChild(ov);

    const safeToggle = (typeof setActionButtonsEnabled === 'function') ? setActionButtonsEnabled : () => { };
    safeToggle(false); // 表示中は行動ボタン無効化

    const list = modal.querySelector('.gift-list');
    options.forEach(opt => {
      const btn = document.createElement('button');
      btn.className = 'gift-btn';
      btn.textContent = `・${opt.label}`;
      btn.addEventListener('click', () => { cleanup(); resolve(opt); });
      list.appendChild(btn);
    });

    const onEsc = (e) => { if (e.key === 'Escape') { cleanup(); resolve(null); } };
    const onBackdrop = (e) => { if (e.target === ov) { cleanup(); resolve(null); } };

    modal.querySelector('#gift-cancel').addEventListener('click', () => { cleanup(); resolve(null); });
    document.addEventListener('keydown', onEsc);
    ov.addEventListener('click', onBackdrop);

    function cleanup() {
      safeToggle(true);                 // ★必ず再有効化
      document.removeEventListener('keydown', onEsc);
      ov.removeEventListener('click', onBackdrop);
      ov.remove();
    }
  });
}

// 週の並び順をイベント発火と同じルールで整列：priority降順 → 誕生日優先 → 定義順
function _orderEventsForSchedule(arr) {
  return arr.map((ev, idx) => ({ ev, idx })).sort((a, b) => {
    const pa = Number(a.ev.priority || 0), pb = Number(b.ev.priority || 0);
    if (pb !== pa) return pb - pa;
    const ta = a.ev.type === 'birthday' ? 1 : 0;
    const tb = b.ev.type === 'birthday' ? 1 : 0;
    if (tb !== ta) return tb - ta;
    return a.idx - b.idx;
  }).map(x => x.ev);
}

// 直近の予定（イベント＋誕生日）を取得（現在週を含む、最大maxItems件）
function getUpcomingSchedule(maxItems = 5) {
  const s = window.state || {};
  const out = [];
  if (!s._eventsReady) return out; // preloadEvents前は空

  for (let w = s.turn; w <= s.maxTurn && out.length < maxItems; w++) {
    const fromFile = (s._eventsByWeek && s._eventsByWeek[w]) ? s._eventsByWeek[w] : [];
    // 誕生日は毎回動的生成（副作用なし）
    const fromBirthday = (typeof collectBirthdaysForWeek === 'function') ? collectBirthdaysForWeek(w) : [];

    const all = _orderEventsForSchedule(fromFile.concat(fromBirthday));
    if (!all.length) continue;

    const { month, week } = (typeof weekToMonthWeek === 'function') ? weekToMonthWeek(w) : { month: '?', week: '?' };
    const when = `${month}月 ${week}週`;

    all.forEach(ev => {
      if (out.length >= maxItems) return;
      const kind = (ev.type === 'birthday') ? 'birthday' : (ev.kind || 'event');
      const icon = (kind === 'birthday') ? '🎂' : (kind === 'test') ? '📝' : '🎉';
      const title = `${icon} ${ev.title || (kind === 'birthday' ? '誕生日' : 'イベント')}`;
      out.push({ when, title, isThisWeek: w === s.turn });
    });
  }
  return out;
}

// UI側から呼べるように公開
window.getUpcomingSchedule = getUpcomingSchedule;

// 特例：入学式（行動前に一度だけ表示）
async function runEntranceCeremony() {
  const group = [];
  group.push({ msg: "🎉 イベント：入学式" });
  group.push({ msg: "入学式があった。新しい生活が始まる。", sub: true });
  // 効果はなし（必要になったらここで追記）
  pushGroup(group);
}

// 行動ヒント：今の数値と嗜好から、期待好感度の総和が最大の行動を推定
function getActionHintText() {
  const s = window.state || {};
  const heroines = Array.isArray(s.heroines) ? s.heroines : [];
  if (!heroines.length) return "";

  const actions = [
    { key: "study", label: "勉強", baseProb: 0.3, amount: 1 },
    { key: "sports", label: "運動", baseProb: 0.3, amount: 1 },
    { key: "styleUp", label: "おしゃれ", baseProb: 0.4, amount: 2 },
  ];

  const clamp01 = (x) => Math.max(0, Math.min(1, x));
  const getPref = (h, key) => (typeof getPreferenceWeight === "function" ? getPreferenceWeight(h, key) : 33);

  let best = { label: "", exp: -1 };
  actions.forEach(a => {
    let expSum = 0;
    heroines.forEach(h => {
      const pref = getPref(h, a.key);                               // 0..100
      const p = clamp01(a.baseProb * (0.6 + (pref / 100) * 0.8));   // actions.jsと同じ推定式
      expSum += p * a.amount;                                       // 期待加点（総和）
    });
    if (expSum > best.exp) best = { label: a.label, exp: expSum };
  });

  return best.label ? `💡 おすすめ：${best.label}` : "";
}
// UIから使えるよう公開
window.getActionHintText = getActionHintText;


function debugEventsSelfCheck() {
  const s = window.state || {};
  const byWeek = s._eventsByWeek || {};
  const total = Object.values(byWeek).reduce((acc, arr) => acc + (Array.isArray(arr) ? arr.length : 0), 0);
  const weeks = Object.keys(byWeek).length;
  const errs = Array.isArray(s._eventsErrors) ? s._eventsErrors : [];
  const src = s._eventsSource || (Array.isArray(window.GAME_EVENTS) ? 'js:window.GAME_EVENTS' : 'unknown');

  // 画面ログ
  if (typeof pushGroup === 'function') {
    const g = [{ msg: `🧪 イベント読み込み：${total}件 / 週数 ${weeks}（src: ${src}）` }];
    if (errs.length) {
      g.push({ msg: `⚠ 設定エラー ${errs.length}件（詳細はコンソール参照）`, sub: true, cls: 'down' });
      errs.slice(0, 3).forEach(e => g.push({ msg: e, sub: true }));
    }
    pushGroup(g);
  }

  // コンソール詳細
  console.log('[events] source=', src, 'byWeek=', byWeek);
  if (errs.length) console.warn('[events] errors=', errs);
}
// 週番号 → 「4月 2週」表記を作る（48週/各月4週の前提）
function makeWeekLabel(weekNumber) {
  const s = window.state || {};
  const total = s.maxTurn || 48;
  const w = Math.max(1, Math.min(weekNumber || 1, total));
  const idx = w - 1;
  const monthIdx = Math.floor(idx / 4);
  const week = (idx % 4) + 1;
  const months = [4, 5, 6, 7, 8, 9, 10, 11, 12, 1, 2, 3];
  const month = months[monthIdx] ?? "?";
  return `${month}月 ${week}週`;
}
