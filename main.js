async function init() {
  await preloadEvents();                       // 1) 読み込み
  debugShowEventsStatus();                     // 2) 状況をログに出す（1回だけ）
  updateUI();
  triggerWeeklyEvents(window.state.turn || 1); // 3) 開始週のイベント発火
}
window.addEventListener('DOMContentLoaded', init);

async function nextTurn() {
  const s = window.state;
  // 学年終了
  if (s.turn >= s.maxTurn) {
    endGame();
    return;
  }

  // 1週間の演出（導入済みなら呼ばれる）
  if (typeof animateWeekPassage === "function") {
    await animateWeekPassage();
  }

  // 週を進める
  s.turn += 1;

  // 進行先の週イベントを発火（データドリブン）
  triggerWeeklyEvents(s.turn);

  // 画面更新
  updateUI();
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
const _MONTHS_ORDER = [4,5,6,7,8,9,10,11,12,1,2,3];
function _mwToWeekNumber(m, w) {
  const idx = _MONTHS_ORDER.indexOf(Number(m));
  if (idx < 0 || w < 1 || w > 4) return null;
  return idx * 4 + Number(w); // 1..48
}

async function preloadEvents() {
  const s = window.state;
  if (s._eventsReady) return;

  let data = null;

  // 1) 外部 JSON
  try {
    const res = await fetch('data/events.json', { cache: 'no-store' });
    if (res.ok) data = await res.json();
  } catch (_) {}

  // 2) インライン JSON（#events-data があれば）
  if (!Array.isArray(data)) {
    const tag = document.getElementById('events-data');
    if (tag) {
      try { data = JSON.parse((tag.textContent || '').trim()); } catch(_) {}
    }
  }

  // 3) フォールバック（最小1件：month/week 形式のみ）
  if (!Array.isArray(data)) {
    data = [
      {
        month: 4, week: 1,
        title: "入学式",
        messages: ["入学式があった。新しい生活が始まる。"],
        effects: {
          player:   { "学力": 0, "運動": 0, "魅力": 0 },
          affection:{ "all": 0 }
        }
      }
    ];
  }

  // —— バリデーション（厳格仕様）と週番号正規化 ——
  const MONTHS_ORDER = [4,5,6,7,8,9,10,11,12,1,2,3];
  const isObj = v => v && typeof v === 'object' && !Array.isArray(v);

  const validPlayer = (obj) => {
    if (!isObj(obj)) return false;
    let count = 0;
    for (const v of Object.values(obj)) if (typeof v === 'number') count++;
    return count > 0; // 空不可・0可
  };
  const validAffection = (obj) => {
    if (!isObj(obj)) return false;
    if (typeof obj.all === 'number') return true;
    if (isObj(obj.byName)) {
      for (const v of Object.values(obj.byName)) if (typeof v === 'number') return true;
    }
    return false; // 空不可・0可
  };
  const monthWeekToWeek = (month, week) => {
    const idx = MONTHS_ORDER.indexOf(Number(month));
    if (idx < 0 || week < 1 || week > 4) return null;
    return idx * 4 + Number(week); // 1..48
  };

  s._eventsByWeek = {};
  s._eventsErrors = [];
  let loadedCount = 0;

  data.forEach((ev, i) => {
    if (!isObj(ev)) return;

    // ✖ mw は不許可
    if (typeof ev.mw === 'string') {
      s._eventsErrors.push(`イベント#${i}（${ev.title || '無題'}）: "mw" は廃止。month/week のみ許可`);
      return;
    }

    // effects 厳格
    if (!isObj(ev.effects) || !validPlayer(ev.effects.player) || !validAffection(ev.effects.affection)) {
      s._eventsErrors.push(`イベント#${i}（${ev.title || '無題'}）: effects は必須。player/affection 両方に数値キーが必要（0可）`);
      return;
    }

    // month/week 必須
    if (typeof ev.month !== 'number' || typeof ev.week !== 'number') {
      s._eventsErrors.push(`イベント#${i}（${ev.title || '無題'}）: month/week が数値で必須`);
      return;
    }

    const weekNum = monthWeekToWeek(ev.month, ev.week);
    if (!weekNum) {
      s._eventsErrors.push(`イベント#${i}（${ev.title || '無題'}）: month/week の範囲が不正（month=4..3循環, week=1..4）`);
      return;
    }

    (s._eventsByWeek[weekNum] ||= []).push(ev);
    loadedCount++;
  });

  // 集計を保持（あとでUIに出す）
  s._eventsLoadInfo = {
    loadedEvents: loadedCount,
    weeksWithEvents: Object.keys(s._eventsByWeek).length,
    hasErrors: (s._eventsErrors.length > 0)
  };

  s._eventsReady = true;
}

function applyEventEffects(ev) {
  const s = window.state;
  const eff = ev.effects || {};
  const applied = [];

  // プレイヤー能力
  if (eff.player) {
    for (const [k, delta] of Object.entries(eff.player)) {
      if (typeof s.player?.[k] === 'number' && typeof delta === 'number') {
        const before = s.player[k];
        s.player[k] += delta;
        applied.push(`${k} ${before} → ${s.player[k]}（${delta >= 0 ? '+' : ''}${delta}）`);
      }
    }
  }
  // 好感度
  if (eff.affection) {
    if (typeof eff.affection.all === 'number') {
      const d = eff.affection.all;
      s.heroines.forEach(h => { h.好感度 += d; });
      applied.push(`好感度（全員）${d >= 0 ? '+' : ''}${d}`);
    }
    if (eff.affection.byName) {
      for (const [name, d] of Object.entries(eff.affection.byName)) {
        const h = s.heroines.find(x => x.名前 === name);
        if (h && typeof d === 'number') {
          const b = h.好感度; h.好感度 += d;
          applied.push(`${name} 好感度 ${b} → ${h.好感度}（${d >= 0 ? '+' : ''}${d}）`);
        }
      }
    }
  }

  return applied.length ? `効果：${applied.join(' / ')}` : '';
}

function triggerWeeklyEvents(weekNum) {
  const s = window.state;
  const list = s._eventsByWeek?.[weekNum];
  if (!list || list.length === 0) return false;

  list.forEach(ev => {
    const group = [{ msg: `🎉 イベント：${ev.title}` }];
    const msgs = Array.isArray(ev.messages) ? ev.messages : (ev.message ? [ev.message] : []);
    msgs.forEach(m => group.push({ msg: String(m), sub: true }));
    const effLine = applyEventEffects(ev);
    if (effLine) group.push({ msg: effLine, sub: true, cls: 'info' });
    pushGroup(group);
  });
  return true;
}

function debugShowEventsStatus() {
  const s = window.state;
  const info = s._eventsLoadInfo || { loadedEvents: 0, weeksWithEvents: 0, hasErrors: false };
  const group = [
    { msg: `🧪 イベント読み込み：${info.loadedEvents}件 / 週数 ${info.weeksWithEvents}` }
  ];
  if (s._eventsErrors && s._eventsErrors.length) {
    group.push({ msg: `⚠ 設定エラー ${s._eventsErrors.length}件（詳細はコンソール）`, cls: "down", sub: true });
    // 先頭3件だけ中身も表示
    s._eventsErrors.slice(0, 3).forEach(e => group.push({ msg: e, sub: true }));
  }
  pushGroup(group);
}
