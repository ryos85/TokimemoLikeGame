// ゲームの初期状態を生成する
function createInitialState() {
  return {
    player: { 学力: 50, 運動: 50, 魅力: 50 },
    heroines: [
      {
        名前: "さくら",
        好感度: 30,
        画像: "images/characters/sakura.png",
        嗜好: { 学力: 40, 運動: 30, 魅力: 30 },
        相性閾値: 60,
        デート嗜好: { cinema: 70, cafe: 65, park: 55, library: 60, gym: 40, aquarium: 75 },
        セリフ: {
          success: ["今日すっごく楽しかった！", "また一緒に出かけようね！"],
          fail: ["なんかちょっと退屈だったかも…", "ごめん、疲れちゃった…"]
        }
      },
      {
        名前: "あやか",
        好感度: 20,
        画像: "images/characters/ayaka.png",
        嗜好: { 学力: 20, 運動: 50, 魅力: 30 },
        相性閾値: 62,
        デート嗜好: { cinema: 55, cafe: 60, park: 65, library: 45, gym: 80, aquarium: 50 },
        セリフ: {
          success: ["嬉しい！あなたといると安心する。", "こんなに楽しいの久しぶり！"],
          fail: ["…なんだか微妙だったかな。", "今日はちょっと気分が乗らなかったな…"]
        }
      },
      {
        名前: "ひかり",
        好感度: 25,
        画像: "images/characters/hikari.png",
        嗜好: { 学力: 25, 運動: 55, 魅力: 20 },
        相性閾値: 61,
        デート嗜好: { cinema: 50, cafe: 55, park: 80, library: 40, gym: 85, aquarium: 60 },
        セリフ: {
          success: ["体を動かすのって最高！", "すごく気持ちよかったね！"],
          fail: ["今日はちょっと合わなかったかも…", "次は別の場所に行こう？"]
        }
      },
      {
        名前: "ゆい",
        好感度: 28,
        画像: "images/characters/yui.png",
        嗜好: { 学力: 55, 運動: 20, 魅力: 25 },
        相性閾値: 63,
        デート嗜好: { cinema: 60, cafe: 75, park: 50, library: 85, gym: 35, aquarium: 55 },
        セリフ: {
          success: ["静かな時間が心地よかった。", "素敵な選択だと思う。"],
          fail: ["少し賑やかすぎたかな。", "今日は集中できなかったかも。"]
        }
      },
      {
        名前: "めぐみ",
        好感度: 22,
        画像: "images/characters/megumi.png",
        嗜好: { 学力: 30, 運動: 25, 魅力: 45 },
        相性閾値: 60,
        デート嗜好: { cinema: 80, cafe: 70, park: 55, library: 50, gym: 40, aquarium: 85 },
        セリフ: {
          success: ["雰囲気が最高だったね！", "今日は特別な気分になれたよ。"],
          fail: ["ちょっとピンと来なかったかな。", "気分を変えてまた行こう？"]
        }
      }
    ],
    dateSpots: [
      { id: "cinema",   名称: "映画館" },
      { id: "cafe",     名称: "カフェ" },
      { id: "park",     名称: "公園" },
      { id: "library",  名称: "図書館" },
      { id: "gym",      名称: "スポーツセンター" },
      { id: "aquarium", 名称: "水族館" }
    ],
    turn: 1,
    maxTurn: 48,
    logs: [],
    clearedOnce: new Set(),
    pendingDateIndex: null
  };
}

// 好感度アップの理由一覧
const REASONS = {
  study:  ["勉強の話題で盛り上がった", "ノートの取り方を褒められた", "質問に丁寧に答えた"],
  sports: ["練習を手伝ってくれた", "頑張る姿がかっこよかった", "一緒にランニングした"],
  styleUp:["身だしなみが整っていた", "新しい服が似合っていた", "香りに気づいてくれた"],
  date:   ["段取りが完璧だった", "気遣いが伝わった", "楽しい場所を選べた"],
  random: ["ちょっとした気配りが嬉しかった", "タイミングよく助けてくれた", "一緒にいて安心した"]
};

window.state = createInitialState();
window.REASONS = REASONS;
