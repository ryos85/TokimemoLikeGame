// 学力アップ
function study() {
  const s = window.state;
  const before = s.player.学力;
  s.player.学力 += 5;
  const after = s.player.学力;

  renderStatus();
  flashBadge('badge-gakuryoku','up');

  const group = [
    { msg: "勉強を実行した！" },
    { msg: `学力がアップした！ ${before} → ${after}`, cls: "info", sub: true }
  ];

  const changes = applyFavorAll("study", 0.3, 1);
  changes.forEach(c => {
    group.push({ msg: `${c.heroine.名前}の好感度 +${c.added}（${c.reason}）`, cls: "info", sub: true });
    const star = makeClearPossibleEntry(c.heroine, c.before, c.after, c.index);
    if (star) group.push(star);
  });

  pushGroup(group);
  nextTurn();
}

// 運動アップ
function sports() {
  const s = window.state;
  const before = s.player.運動;
  s.player.運動 += 5;
  const after = s.player.運動;

  renderStatus();
  flashBadge('badge-undou','up');

  const group = [
    { msg: "運動を実行した！" },
    { msg: `運動がアップした！ ${before} → ${after}`, cls: "info", sub: true }
  ];

  const changes = applyFavorAll("sports", 0.3, 1);
  changes.forEach(c => {
    group.push({ msg: `${c.heroine.名前}の好感度 +${c.added}（${c.reason}）`, cls: "info", sub: true });
    const star = makeClearPossibleEntry(c.heroine, c.before, c.after, c.index);
    if (star) group.push(star);
  });

  pushGroup(group);
  nextTurn();
}

// 魅力アップ
function styleUp() {
  const s = window.state;
  const before = s.player.魅力;
  s.player.魅力 += 5;
  const after = s.player.魅力;

  renderStatus();
  flashBadge('badge-miryoku','up');

  const group = [
    { msg: "おしゃれを実行した！" },
    { msg: `魅力がアップした！ ${before} → ${after}`, cls: "info", sub: true }
  ];

  const changes = applyFavorAll("styleUp", 0.4, 2);
  changes.forEach(c => {
    group.push({ msg: `${c.heroine.名前}の好感度 +${c.added}（${c.reason}）`, cls: "info", sub: true });
    const star = makeClearPossibleEntry(c.heroine, c.before, c.after, c.index);
    if (star) group.push(star);
  });

  pushGroup(group);
  nextTurn();
}

/* === デートフロー === */
function date() {
  openDatePicker();
}

function dateWith(heroIndex) {
  window.state.pendingDateIndex = heroIndex;
  closeDatePicker();
  openSpotPicker(heroIndex);
}

function dateWithAt(heroIndex, spotId) {
  // モーダルを閉じる
  closeSpotPicker();

  const s = window.state;
  const h = s.heroines[heroIndex];
  const spot = s.dateSpots.find(sp => sp.id === spotId);
  const before = h.好感度;

  // 既存の指標
  const affinity = calcAffinity(s.player, h.嗜好);
  const spotLike = getSpotPreference(h, spotId);
  const threshold = (h.相性閾値 ?? 60);
  const score = Math.round(0.6 * affinity + 0.4 * spotLike);
  const passed = score >= threshold;

  // 訪問状態（初回ボーナス用）※ state.js を改変せず、ここで面倒を見る
  s._visited = s._visited || {};
  const visitKey = `${heroIndex}:${spotId}`;
  const firstVisit = !s._visited[visitKey];
  s._visited[visitKey] = true;

  // スコア計算用パラメータ（調整はここだけでOK）
  const baseGain = 10;  // 成功時の基本加点
  const baseLose = 5;   // 失敗時の基本減点
  // 場所好みによるボーナス（例：50=0, 60=+1, 70=+2, 80=+3, 90=+4）
  const likeBonus = Math.max(0, Math.floor((spotLike - 50) / 10));

  if (passed) {
    const bonus = likeBonus + (firstVisit ? 1 : 0);
    h.好感度 += baseGain + bonus;

    const reason = pick(window.REASONS.date);
    const group = [
      { msg: `${h.名前}とデートした！（場所：${spot.名称}）` },
      { msg: `相性 ${affinity} ／ 場所好み ${spotLike}（閾値 ${threshold}）`, sub: true },
      { msg: `${h.名前}とのデート大成功！ 好感度 ${before} → ${h.好感度}`, cls: "info", sub: true },
      { msg: `加点内訳：基本 +${baseGain} / 好み +${likeBonus}${firstVisit ? " / 初訪問 +1" : ""}`, sub: true },
      { msg: `理由：${reason}`, sub: true },
      { msg: `${h.名前}「${pick(h.セリフ.success)}」`, sub: true }
    ];

    const star = makeClearPossibleEntry(h, before, h.好感度, heroIndex);
    if (star) group.push(star);

    pushGroup(group);
  } else {
    h.好感度 -= baseLose;

    const group = [
      { msg: `${h.名前}とデートした！（場所：${spot.名称}）` },
      { msg: `相性 ${affinity} ／ 場所好み ${spotLike}（閾値 ${threshold}）`, sub: true },
      { msg: `${h.名前}とのデート失敗… 好感度 ${before} → ${h.好感度}（減点 −${baseLose}）`, cls: "down", sub: true },
      { msg: `${h.名前}「${pick(h.セリフ.fail)}」`, sub: true }
    ];

    pushGroup(group);
  }

  nextTurn();
}

/* === ヘルパ === */

// 全キャラへ好感度加点（上がったキャラのみ返す）
function applyFavorAll(actionKey, baseProb, amount) {
  const s = window.state;
  const results = [];
  s.heroines.forEach((h, idx) => {
    const before = h.好感度;
    const prefWeight = getPreferenceWeight(h, actionKey);
    const prob = clamp01(baseProb * (0.6 + (prefWeight / 100) * 0.8));
    if (Math.random() < prob) {
      h.好感度 += amount;
      const pool = window.REASONS[actionKey] && window.REASONS[actionKey].length
        ? window.REASONS[actionKey]
        : window.REASONS.random;
      const reason = pick(pool);
      results.push({ heroine: h, index: idx, before, after: h.好感度, added: amount, reason });
    }
  });
  return results;
}

// クリア可能（70）に到達した時のログを返す
function makeClearPossibleEntry(heroine, before, after, idx) {
  const s = window.state;
  if (before < 70 && after >= 70 && !s.clearedOnce.has(idx)) {
    s.clearedOnce.add(idx);
    return { msg: `☆ クリア可能になった：${heroine.名前}（好感度 ${after}）`, sub: true };
  }
  return null;
}

// 行動→嗜好重み
function getPreferenceWeight(heroine, actionKey) {
  const map = { study: "学力", sports: "運動", styleUp: "魅力" };
  const key = map[actionKey];
  return (heroine.嗜好 && key && typeof heroine.嗜好[key] === "number") ? heroine.嗜好[key] : 33;
}

// デート先への嗜好
function getSpotPreference(heroine, spotId) {
  return (heroine.デート嗜好 && typeof heroine.デート嗜好[spotId] === "number")
    ? heroine.デート嗜好[spotId]
    : 50;
}

// 0〜1に収める
function clamp01(x) { return Math.max(0, Math.min(1, x)); }

// 配列からランダム取得
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

// モーダル用に公開
window.dateWithAt = dateWithAt;
