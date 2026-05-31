require('dotenv').config();
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static('public'));

const limiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 30,
  message: { error: 'rate_limit', message: '本日の診断上限に達しました。時間をおいて再度お試しください。' }
});
app.use('/api/', limiter);

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

// ─── JSON修復ユーティリティ ──────────────────────────────
// 途中で切れたJSONを可能な限り補完してparseする
function robustJsonParse(raw) {
  // 1. コードブロック除去
  let text = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

  // 2. { ... } の範囲を抽出
  const first = text.indexOf('{');
  if (first === -1) throw new Error('No JSON object found');
  text = text.slice(first);

  // 3. まずそのままparseを試みる
  try { return JSON.parse(text); } catch (_) {}

  // 4. 途中で切れている場合の修復処理
  text = repairTruncatedJson(text);
  return JSON.parse(text);
}

function repairTruncatedJson(text) {
  // 文字列の途中で切れている場合、閉じクォートを追加
  // 開いている [ ] { } の数を数えて閉じる
  let result = text;

  // 末尾の不完全なキー・値を除去（カンマや : の後で切れている場合）
  result = result.replace(/,\s*$/, '');           // 末尾の余分なカンマ
  result = result.replace(/:\s*$/, ': null');      // 値がない場合
  result = result.replace(/:\s*"[^"]*$/, ': ""'); // 途中の文字列

  // 開いているブラケット・ブレースを閉じる
  const opens = [];
  let inString = false;
  let escape = false;

  for (let i = 0; i < result.length; i++) {
    const c = result[i];
    if (escape) { escape = false; continue; }
    if (c === '\\' && inString) { escape = true; continue; }
    if (c === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (c === '{' || c === '[') opens.push(c);
    if (c === '}' || c === ']') opens.pop();
  }

  // 文字列が開きっぱなしなら閉じる
  if (inString) result += '"';

  // 末尾の不完全なカンマを除去（再度）
  result = result.replace(/,\s*$/, '');
  result = result.replace(/,(\s*[}\]])/, '$1');

  // 開いているブラケット・ブレースを逆順に閉じる
  for (let i = opens.length - 1; i >= 0; i--) {
    result += opens[i] === '{' ? '}' : ']';
  }

  return result;
}

// ─── 診断プロンプト ───────────────────────────────────────
// ポイント：理由文を短く制限、全体のJSON出力量を最小化
function buildDiagnosisPrompt(userData) {
  const { basicInfo, answers, freeText } = userData;

  const questionTexts = [
    "問題の原因を論理的に分析することが好きだ",
    "初対面の人とでもすぐに打ち解けることができる",
    "指示を待たず、自分から積極的に行動する",
    "新しいアイデアや独自の方法を考えることが楽しい",
    "プレッシャーのかかる状況でも冷静さを保てる",
    "新しい知識やスキルを習得することに強い意欲を感じる",
    "チームをまとめてプロジェクトをリードすることが得意だ",
    "チームメンバーの意見を尊重し、協力して物事を進められる",
    "データや情報を整理・分析して結論を導き出すことが得意だ",
    "リスクがあっても新しいことに挑戦することが好きだ",
    "細かい作業を丁寧に、ミスなくこなすことができる",
    "相手の気持ちや状況を理解して共感することが得意だ",
    "複数のタスクを同時に管理して優先順位をつけることが得意だ",
    "自分の意見をわかりやすく相手に伝えることができる",
    "長期的な目標に向かって継続して努力することができる",
    "変化や新しい環境にも柔軟に適応することができる",
    "専門的な知識を深く追求することに興味がある",
    "人の役に立ったり、社会に貢献することにやりがいを感じる",
    "数字や論理的な思考を使った問題解決が得意だ",
    "クリエイティブな表現や制作活動に喜びを感じる"
  ];

  const answerLabels = ['全くN', 'あまりN', 'どちらでも', 'ややY', 'とてもY'];
  const answersText = answers.map((ans, i) =>
    `Q${i+1}:${ans}`
  ).join(' ');

  const isStudent = basicInfo.occupation.includes('学生');

  return `キャリア診断AIです。以下のデータを分析し、指定JSONのみ出力してください。

基本情報: 年齢${basicInfo.age}歳 / ${basicInfo.gender||'性別未回答'} / ${basicInfo.education} / ${basicInfo.occupation} / 勤続${basicInfo.yearsOfService}
回答(1-5): ${answersText}
得意: ${freeText.strengths||'未記入'}
苦手: ${freeText.weaknesses||'未記入'}
将来: ${freeText.futureGoals||'未記入'}
避けたい環境: ${freeText.avoidEnvironment||'未記入'}
理想の働き方: ${freeText.idealWorkStyle||'未記入'}

出力ルール:
- JSONのみ出力（説明文・コードブロック禁止）
- 文字列内にダブルクォート禁止
- 各reasonは40文字以内
- careerAdviceは100文字以内
- ${isStudent ? '学生向け' : '社会人向け'}アドバイス

{"suitableJobs":[{"rank":1,"title":"職業名","score":94,"reason":"理由40文字以内"},{"rank":2,"title":"職業名","score":88,"reason":"理由40文字以内"},{"rank":3,"title":"職業名","score":82,"reason":"理由40文字以内"}],"unsuitableJobs":[{"rank":1,"title":"職業名","reason":"理由30文字以内"},{"rank":2,"title":"職業名","reason":"理由30文字以内"},{"rank":3,"title":"職業名","reason":"理由30文字以内"}],"strengths":["強み1","強み2","強み3","強み4","強み5"],"weaknesses":["弱み1","弱み2","弱み3"],"workStyles":["働き方1","働き方2","働き方3"],"careerAdvice":"100文字以内のアドバイス","personalityType":"タイプ名10文字以内","personalityDescription":"説明50文字以内"}`;
}

// ─── 自己PRプロンプト ─────────────────────────────────────
function buildPRPrompt(diagnosisResult, userData) {
  const { basicInfo, freeText } = userData;
  return `キャリアコーチです。以下を元に自己PRをJSON形式で出力してください。

職業:${basicInfo.occupation} / 学歴:${basicInfo.education} / 年齢:${basicInfo.age}歳
強み:${diagnosisResult.strengths.join('、')}
得意:${freeText.strengths||'未記入'}
将来:${freeText.futureGoals||'未記入'}
適職TOP3:${diagnosisResult.suitableJobs.slice(0,3).map(j=>j.title).join('、')}

ルール: JSONのみ / 文字列内にダブルクォート禁止 / prTextは200文字以内 / interviewTipsは80文字以内

{"prText":"自己PR200文字以内","keyStrengths":["強み1","強み2","強み3"],"interviewTips":"面接アドバイス80文字以内"}`;
}

// ─── /api/diagnose ────────────────────────────────────────
app.post('/api/diagnose', async (req, res) => {
  try {
    console.log('🔥 diagnose START');
    const { userData } = req.body;
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({ success: false, error: 'no_api_key', message: 'APIキーが設定されていません。' });
    }

    const prompt = buildDiagnosisPrompt(userData);
    console.log('📨 Gemini呼び出し中...');

    const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 8192,
          thinkingConfig: {
            thinkingBudget: 0
          }
        }
      })
    });

    console.log('📡 Gemini status:', response.status);

    if (response.status === 429) {
      return res.status(429).json({ success: false, error: 'rate_limit', message: '本日の診断上限に達しました。時間をおいて再度お試しください。' });
    }
    if (!response.ok) {
      const errText = await response.text();
      console.error('Gemini error:', errText);
      return res.status(500).json({ success: false, error: 'api_error', message: '診断の実行に失敗しました。時間をおいて再度お試しください。' });
    }

    const data = await response.json();
    const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    console.log('🧾 rawText length:', rawText?.length);

    if (!rawText) {
      return res.status(500).json({ success: false, error: 'empty_response', message: '診断結果の取得に失敗しました。時間をおいて再度お試しください。' });
    }

    // finishReasonチェック（MAX_TOKENSの場合でも修復を試みる）
    const finishReason = data?.candidates?.[0]?.finishReason;
    console.log('📋 finishReason:', finishReason);

    let result;
    try {
      result = robustJsonParse(rawText);
      console.log('✅ JSON parse成功');
    } catch (e) {
      console.error('❌ JSON parse失敗:', e.message);
      console.error('RAW:', rawText);
      return res.status(500).json({ success: false, error: 'json_parse_error', message: '診断結果の解析に失敗しました。時間をおいて再度お試しください。' });
    }

    // 必須フィールドのフォールバック補完（修復後に不足している場合）
    result.suitableJobs   = result.suitableJobs   || [];
    result.unsuitableJobs = result.unsuitableJobs || [];
    result.strengths      = result.strengths      || [];
    result.weaknesses     = result.weaknesses     || [];
    result.workStyles     = result.workStyles     || [];
    result.careerAdvice   = result.careerAdvice   || 'あなたの強みを活かしたキャリアを目指してください。';
    result.personalityType        = result.personalityType        || '分析中';
    result.personalityDescription = result.personalityDescription || '';

    return res.json({ success: true, result });

  } catch (err) {
    console.error('💥 FATAL:', err);
    return res.status(500).json({ success: false, error: 'fatal_error', message: '診断の実行に失敗しました。時間をおいて再度お試しください。' });
  }
});

// ─── /api/generate-pr ─────────────────────────────────────
app.post('/api/generate-pr', async (req, res) => {
  try {
    const { diagnosisResult, userData } = req.body;
    if (!diagnosisResult || !userData) {
      return res.status(400).json({ success: false, message: '入力データが不正です。' });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ success: false, message: 'サーバー設定エラーが発生しました。' });
    }

    const prompt = buildPRPrompt(diagnosisResult, userData);

    const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 8192,
          thinkingConfig: {
            thinkingBudget: 0
          }
        }
      })
    });

    if (response.status === 429) {
      return res.status(429).json({ success: false, message: '本日の上限に達しました。時間をおいて再度お試しください。' });
    }
    if (!response.ok) {
      return res.status(500).json({ success: false, message: '自己PRの生成に失敗しました。時間をおいて再度お試しください。' });
    }

    const data = await response.json();
    const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) {
      return res.status(500).json({ success: false, message: '自己PRの取得に失敗しました。' });
    }

    let result;
    try {
      result = robustJsonParse(rawText);
    } catch (e) {
      return res.status(500).json({ success: false, message: '自己PRの解析に失敗しました。時間をおいて再度お試しください。' });
    }

    result.prText       = result.prText       || '';
    result.keyStrengths = result.keyStrengths || [];
    result.interviewTips = result.interviewTips || '';

    return res.json({ success: true, result });

  } catch (error) {
    console.error('PR generation error:', error);
    return res.status(500).json({ success: false, message: '自己PRの生成に失敗しました。時間をおいて再度お試しください。' });
  }
});

app.listen(PORT, () => {
  console.log(`Career Compass AI running on port ${PORT}`);
});
