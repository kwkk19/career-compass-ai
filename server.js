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

  const answerLabels = ['全く当てはまらない', 'あまり当てはまらない', 'どちらでもない', 'やや当てはまる', 'とても当てはまる'];

  const answersText = answers.map((ans, i) =>
    `Q${i + 1}. ${questionTexts[i]}: ${answerLabels[ans - 1]}（${ans}/5）`
  ).join('\n');

  return `あなたはプロのキャリアアドバイザー兼適職診断AIです。以下のユーザー情報と診断回答を元に、詳細で実用的な適職診断を行ってください。

【ユーザー基本情報】
・年齢: ${basicInfo.age}歳
・性別: ${basicInfo.gender || '未回答'}
・最終学歴: ${basicInfo.education}
・現在の職業: ${basicInfo.occupation}
・勤続年数: ${basicInfo.yearsOfService}

【適性診断回答 (1=全く当てはまらない 〜 5=とても当てはまる)】
${answersText}

【自由記述】
・得意なこと: ${freeText.strengths || '未記入'}
・苦手なこと: ${freeText.weaknesses || '未記入'}
・将来やりたいこと: ${freeText.futureGoals || '未記入'}
・働きたくない環境: ${freeText.avoidEnvironment || '未記入'}
・理想の働き方: ${freeText.idealWorkStyle || '未記入'}

上記の情報を総合的に分析して、以下のJSON形式で回答してください。JSONのみを返してください。マークダウンや追加テキストは不要です。

{
  "suitableJobs": [
    {
      "rank": 1,
      "title": "職業名",
      "score": 94,
      "reason": "この職業に向いている詳細な理由（100文字以上）"
    }
  ],
  "unsuitableJobs": [
    {
      "rank": 1,
      "title": "職業名",
      "reason": "この職業に向いていない理由（50文字以上）"
    }
  ],
  "strengths": ["強み1", "強み2", "強み3", "強み4", "強み5"],
  "weaknesses": ["弱み1", "弱み2", "弱み3"],
  "workStyles": ["向いている働き方1", "向いている働き方2", "向いている働き方3"],
  "careerAdvice": "学生向けまたは社会人向けの具体的なキャリアアドバイス（100文字以上）",
  "personalityType": "あなたのパーソナリティタイプ名（10文字以内）",
  "personalityDescription": "パーソナリティタイプの説明（80文字程度）"
}

注意事項:
- suitableJobsは必ずTOP3（3件）を返してください
- unsuitableJobsは必ずTOP3（3件）を返してください
- scoreは60〜99の範囲で、現実的な数値にしてください
- 理由は具体的で説得力のある内容にしてください
- ${basicInfo.occupation === '学生' || basicInfo.occupation === '大学生' || basicInfo.occupation === '専門学生' ? '学生向け' : '社会人向け'}のアドバイスを提供してください
reason・careerAdviceなどの文章内に "（ダブルクォート）を絶対に含めないでください
すべて自然な日本語で出力してください
- 出力は必ずJSONのみ
- ``は禁止
- 途中で文章を終わらせない
- JSONは必ず最後まで閉じる
- reasonは80文字以内
- 余計な説明は禁止
- もし長くなる場合は必ず短くしてでもJSONを完成させる`;
}

function buildPRPrompt(diagnosisResult, userData) {
  const { basicInfo, freeText } = userData;

  return `あなたはプロのキャリアコーチです。以下の適職診断結果と個人情報を元に、就職・転職活動で使える自己PRを生成してください。

【基本情報】
・年齢: ${basicInfo.age}歳
・職業: ${basicInfo.occupation}
・最終学歴: ${basicInfo.education}

【診断結果の強み】
${diagnosisResult.strengths.join('、')}

【得意なこと】
${freeText.strengths || '未記入'}

【将来やりたいこと】
${freeText.futureGoals || '未記入'}

【理想の働き方】
${freeText.idealWorkStyle || '未記入'}

【向いている職業TOP3】
${diagnosisResult.suitableJobs.slice(0, 3).map(j => j.title).join('、')}

以下のJSON形式のみで回答してください。マークダウンや追加テキストは不要です。

{
  "prText": "就職・転職活動で使える自己PR本文（300〜400文字）",
  "keyStrengths": ["アピールポイント1", "アピールポイント2", "アピールポイント3"],
  "interviewTips": "面接での効果的な伝え方のアドバイス（150文字以上）"
}
・JSONは必ず完全な形で出力すること
・途中で切れる場合は短くしてでも完全なJSONにすること
・改行・説明・コードブロックは禁止
・必ず { から } まで完結させること
・reasonは最大80文字以内
・careerAdviceは150文字以内
・JSON全体を短くすること`;
}

app.post('/api/diagnose', async (req, res) => {
  try {
    console.log("🔥 diagnose START");

    const { userData } = req.body;

    console.log("📦 userData:", JSON.stringify(userData, null, 2));

    const apiKey = process.env.GEMINI_API_KEY;

    console.log("🔑 API KEY exists:", !!apiKey);

    if (!apiKey) {
      console.log("❌ API KEY missing");
      return res.status(500).json({
        success: false,
        error: "no_api_key"
      });
    }

    const prompt = buildDiagnosisPrompt(userData);

    console.log("📨 calling Gemini...");

    const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 8192
        }
      })
    });

    console.log("📡 Gemini status:", response.status);

    const data = await response.json();

    console.log("📩 Gemini raw response:", JSON.stringify(data, null, 2));

    const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    console.log("🧾 rawText:", rawText);

    if (!rawText) {
      console.log("❌ rawText empty");

      return res.status(500).json({
        success: false,
        error: "empty_response"
      });
    }

  let result;

  try {
    console.log("🧹 rawText BEFORE:", rawText);

    // 余計なコードブロック除去
    let cleaned = rawText;

    // 1. コードブロック削除
    cleaned = cleaned.replace(/```json/g, '').replace(/```/g, '').trim();

    // 2. JSON部分だけ抜き出す（超重要）
    const first = cleaned.indexOf('{');
    const last = cleaned.lastIndexOf('}');

    if (first === -1 || last === -1) {
      throw new Error('JSON not found');
    }

    cleaned = cleaned.slice(first, last + 1);

    // 3. parse
    result = JSON.parse(cleaned);

  } catch (e) {
    console.log("❌ JSON PARSE ERROR");
    console.log("RAW:", rawText);

    return res.status(500).json({
      success: false,
      error: "json_parse_error",
      raw: rawText
    });
  }

    console.log("✅ SUCCESS");

    return res.json({
      success: true,
      result
    });

  } catch (err) {
    console.error("💥 FATAL ERROR:", err);

    return res.status(500).json({
      success: false,
      error: "fatal_error",
      message: err.message
    });
  }
});

app.post('/api/generate-pr', async (req, res) => {
  try {
    const { diagnosisResult, userData } = req.body;

    if (!diagnosisResult || !userData) {
      return res.status(400).json({ error: 'invalid_data', message: '入力データが不正です。' });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'config_error', message: 'サーバー設定エラーが発生しました。' });
    }

    const prompt = buildPRPrompt(diagnosisResult, userData);

    const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.1,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 8192,
        }
      })
    });

    if (response.status === 429) {
      return res.status(429).json({ error: 'rate_limit', message: '本日の上限に達しました。時間をおいて再度お試しください。' });
    }

    if (!response.ok) {
      return res.status(500).json({ error: 'api_error', message: '自己PRの生成に失敗しました。時間をおいて再度お試しください。' });
    }

    const data = await response.json();
    const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!rawText) {
      return res.status(500).json({ error: 'parse_error', message: '自己PRの取得に失敗しました。' });
    }

    const cleaned = rawText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const result = JSON.parse(cleaned);

    res.json({ success: true, result });

  } catch (error) {
    console.error('PR generation error:', error);
    res.status(500).json({ error: 'server_error', message: '自己PRの生成に失敗しました。時間をおいて再度お試しください。' });
  }
});

app.listen(PORT, () => {
  console.log(`Career Compass AI server running on port ${PORT}`);
});
