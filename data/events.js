// ローカル(file://)でも読めるイベント定義
window.GAME_EVENTS = [
    {
        "month": 4,
        "week": 1,
        "title": "入学式",
        "messages": ["入学式があった。新しい生活が始まる。"],
        "effects": {
            "player": { "学力": 0, "運動": 0, "魅力": 0 },
            "affection": { "all": 0 }
        }
    },
    {
        "month": 4,
        "week": 2,
        "title": "部活動決め",
        "messages": ["部活動を決めるぞー。"],
        "effects": {
            "player": { "運動": 0 },
            "affection": { "all": 0 }
        }
    },
    {
        "month": 7,
        "week": 4,
        "title": "夏祭り",
        "messages": ["夏祭りが開催された。屋台と浴衣で賑わっている。"],
        "effects": {
            "player": { "魅力": 2 },
            "affection": { "byName": { "さくら": 2, "かおり": -3, "あやか": 0 } }
        }
    },
    {
        "month": 4,
        "week": 4,
        "title": "学力テスト（春）",
        "messages": ["学期初の学力テストが行われた。結果は…"],
        "effects": { "affection": { "all": 0 } },
        "priority": 5,
        "kind": "test",
        "term": "spring"
    },
    {
        "month": 7,
        "week": 4,
        "title": "学力テスト（夏）",
        "messages": ["期末テストで一年の前半の成果が問われる。"],
        "effects": { "affection": { "all": 0 } },
        "priority": 5,
        "kind": "test",
        "term": "summer"
    },
    {
        "month": 12,
        "week": 4,
        "title": "学力テスト（冬）",
        "messages": ["学期末テストで実力を試された。"],
        "effects": { "affection": { "all": 0 } },
        "priority": 5,
        "kind": "test",
        "term": "winter"
    }

];
