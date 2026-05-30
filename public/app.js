/* =========================================
   Career Compass AI — app.js  (fixed)
   ========================================= */

'use strict';

// ─── Data ───────────────────────────────────
const QUESTIONS = [
  { text: '問題の原因を論理的に分析することが好きだ', category: '論理思考' },
  { text: '初対面の人とでもすぐに打ち解けることができる', category: 'コミュニケーション' },
  { text: '指示を待たず、自分から積極的に行動する', category: '主体性' },
  { text: '新しいアイデアや独自の方法を考えることが楽しい', category: '創造性' },
  { text: 'プレッシャーのかかる状況でも冷静さを保てる', category: 'ストレス耐性' },
  { text: '新しい知識やスキルを習得することに強い意欲を感じる', category: '学習意欲' },
  { text: 'チームをまとめてプロジェクトをリードすることが得意だ', category: 'リーダーシップ' },
  { text: 'チームメンバーの意見を尊重し、協力して物事を進められる', category: '協調性' },
  { text: 'データや情報を整理・分析して結論を導き出すことが得意だ', category: '分析力' },
  { text: 'リスクがあっても新しいことに挑戦することが好きだ', category: '挑戦意欲' },
  { text: '細かい作業を丁寧に、ミスなくこなすことができる', category: '慎重性' },
  { text: '相手の気持ちや状況を理解して共感することが得意だ', category: 'コミュニケーション' },
  { text: '複数のタスクを同時に管理して優先順位をつけることが得意だ', category: '主体性' },
  { text: '自分の意見をわかりやすく相手に伝えることができる', category: 'コミュニケーション' },
  { text: '長期的な目標に向かって継続して努力することができる', category: '学習意欲' },
  { text: '変化や新しい環境にも柔軟に適応することができる', category: '挑戦意欲' },
  { text: '専門的な知識を深く追求することに興味がある', category: '分析力' },
  { text: '人の役に立ったり、社会に貢献することにやりがいを感じる', category: '協調性' },
  { text: '数字や論理的な思考を使った問題解決が得意だ', category: '論理思考' },
  { text: 'クリエイティブな表現や制作活動に喜びを感じる', category: '創造性' },
];

// ─── State ──────────────────────────────────
let state = {
  currentStep: 0,
  currentQuestion: 0,
  answers: [],
  basicInfo: {},
  freeText: {},
  diagnosisResult: null,
  _loadingInterval: null,
};

// ─── $ helper (always live lookup) ──────────
const $ = (id) => document.getElementById(id);

// ─── Init: wait for DOM ──────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initHeader();
  initHero();
  initStep1();
  initStep2();
  initStep3();
  initResultActions();
  addShakeKeyframes();
});

// ─── Header ──────────────────────────────────
function initHeader() {
  window.addEventListener('scroll', () => {
    $('header').classList.toggle('scrolled', window.scrollY > 20);
  }, { passive: true });
}

// ─── Hero ────────────────────────────────────
function initHero() {
  $('start-btn').addEventListener('click', () => {
    $('page-hero').style.display = 'none';
    $('main-app').style.display = 'block';
    state.currentStep = 1;
    showStep(1);
    updateProgress(1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
}

// ─── Step 1: Basic Info ──────────────────────
function initStep1() {
  $('step1-next').addEventListener('click', () => {
    const age          = $('age').value;
    const gender       = $('gender').value;
    const education    = $('education').value;
    const occupation   = $('occupation').value;
    const yearsOfService = $('years-of-service').value;

    if (!age || !education || !occupation || !yearsOfService) {
      shakeElement($('step1-next'));
      highlightEmptyFields();
      return;
    }

    state.basicInfo = { age, gender, education, occupation, yearsOfService };
    state.currentStep = 2;
    showStep(2);
    updateProgress(2);
    renderQuestion(0);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
}

function highlightEmptyFields() {
  ['age', 'education', 'occupation', 'years-of-service'].forEach(id => {
    const el = $(id);
    if (!el.value) {
      el.style.borderColor = 'var(--red)';
      el.addEventListener('change', () => { el.style.borderColor = ''; }, { once: true });
    }
  });
}

// ─── Step 2: Questions ───────────────────────
function initStep2() {
  $('q-next').addEventListener('click', handleNext);
  $('q-prev').addEventListener('click', handlePrev);
}

function handleNext() {
  const selected = document.querySelector('input[name="answer"]:checked');
  if (!selected) {
    shakeElement(document.querySelector('.answer-options'));
    return;
  }

  state.answers[state.currentQuestion] = parseInt(selected.value);

  if (state.currentQuestion < QUESTIONS.length - 1) {
    state.currentQuestion++;
    renderQuestion(state.currentQuestion);
  } else {
    state.currentStep = 3;
    showStep(3);
    updateProgress(3);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}

function handlePrev() {
  if (state.currentQuestion > 0) {
    state.currentQuestion--;
    renderQuestion(state.currentQuestion);
  }
}

function renderQuestion(index) {
  const q = QUESTIONS[index];
  $('q-category').textContent = q.category;
  $('q-text').textContent     = q.text;
  $('q-current').textContent  = index + 1;
  $('q-total').textContent    = QUESTIONS.length;

  const pct = Math.round(((index + 1) / QUESTIONS.length) * 100);
  $('q-progress-fill').style.width = pct + '%';

  document.querySelectorAll('input[name="answer"]').forEach(r => r.checked = false);
  if (state.answers[index] !== undefined) {
    const r = document.querySelector(`input[name="answer"][value="${state.answers[index]}"]`);
    if (r) r.checked = true;
  }

  $('q-prev').disabled = index === 0;

  const isLast = index === QUESTIONS.length - 1;
  $('q-next').innerHTML = isLast
    ? `次のステップへ <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 8H13M13 8L9 4M13 8L9 12" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`
    : `次の質問 <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 8H13M13 8L9 4M13 8L9 12" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

  const card = $('question-card');
  card.style.animation = 'none';
  requestAnimationFrame(() => { card.style.animation = 'slide-in 0.3s ease-out'; });
}

// ─── Step 3: Free Text ───────────────────────
function initStep3() {
  $('step3-back').addEventListener('click', () => {
    state.currentStep = 2;
    showStep(2);
    updateProgress(2);
    renderQuestion(state.currentQuestion);
  });

  $('step3-next').addEventListener('click', handleDiagnosis);
}

// ─── Loading Animation ───────────────────────
function startLoadingAnimation() {
  const steps = ['ls-1', 'ls-2', 'ls-3', 'ls-4'];
  let current = 0;

  const advance = () => {
    if (current > 0) {
      const prev = $(steps[current - 1]);
      if (prev) { prev.classList.remove('active'); prev.classList.add('done'); }
    }
    if (current < steps.length) {
      const cur = $(steps[current]);
      if (cur) cur.classList.add('active');
      current++;
    }
  };

  advance();
  state._loadingInterval = setInterval(advance, 1500);
}

function stopLoadingAnimation() {
  if (state._loadingInterval) {
    clearInterval(state._loadingInterval);
    state._loadingInterval = null;
  }
}
async function handleDiagnosis() {
  state.freeText = {
    strengths: $('ft-strengths').value.trim(),
    weaknesses: $('ft-weaknesses').value.trim(),
    futureGoals: $('ft-future').value.trim(),
    avoidEnvironment: $('ft-avoid').value.trim(),
    idealWorkStyle: $('ft-ideal').value.trim(),
  };

  showStep('loading');
  updateProgress(4);
  window.scrollTo({ top: 0, behavior: 'smooth' });
  startLoadingAnimation();

  await runDiagnosis();
}
// ─── API Call ────────────────────────────────
async function runDiagnosis() {
  const userData = {
    basicInfo: state.basicInfo,
    answers:   state.answers,
    freeText:  state.freeText,
  };

  try {
    const res  = await fetch('/api/diagnose', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ userData }),
    });

    const data = await res.json();
    stopLoadingAnimation();

    if (!res.ok || !data.success) {
      showError(data.message || '診断の実行に失敗しました。時間をおいて再度お試しください。');
      showStep(3);
      updateProgress(3);
      return;
    }

    state.diagnosisResult = data.result;
    showStep('result');
    renderResult(data.result);
    window.scrollTo({ top: 0, behavior: 'smooth' });

  } catch (err) {
    stopLoadingAnimation();
    console.error('Diagnosis fetch error:', err);
    showError('ネットワークエラーが発生しました。通信環境を確認して再度お試しください。');
    showStep(3);
    updateProgress(3);
  }
}

// ─── Render Result ───────────────────────────
function renderResult(result) {
  $('result-personality-type').textContent = result.personalityType || 'あなたのタイプ';
  $('result-personality-desc').textContent = result.personalityDescription || '';

  const suitableContainer = $('suitable-jobs');
  suitableContainer.innerHTML = '';
  (result.suitableJobs || []).slice(0, 5).forEach((job, i) => {
    const card = document.createElement('div');
    card.className = `job-card${i === 0 ? ' job-card--top1' : ''}`;
    card.innerHTML = `
      <div class="job-card-header">
        <div class="job-rank-badge">
          <div class="job-rank-circle">${job.rank}</div>
        </div>
        <div class="job-info">
          <div class="job-title">${escHtml(job.title)}</div>
          <div class="job-score-area">
            <div>
              <div class="job-score-num">${job.score}<span style="font-size:16px;font-weight:600;">%</span></div>
              <div class="job-score-label">適性スコア</div>
            </div>
            <div class="job-score-bar-wrap">
              <div class="job-score-bar">
                <div class="job-score-fill" data-score="${job.score}" style="width:0%"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div class="job-reason">${escHtml(job.reason)}</div>
    `;
    suitableContainer.appendChild(card);
  });

  setTimeout(() => {
    document.querySelectorAll('.job-score-fill').forEach(el => {
      el.style.width = el.dataset.score + '%';
    });
  }, 300);

  const unsuitableContainer = $('unsuitable-jobs');
  unsuitableContainer.innerHTML = '';
  (result.unsuitableJobs || []).slice(0, 5).forEach((job) => {
    const item = document.createElement('div');
    item.className = 'unsuitable-item';
    item.innerHTML = `
      <div class="unsuitable-rank">${job.rank}</div>
      <div class="unsuitable-info">
        <div class="uj-title">${escHtml(job.title)}</div>
        <div class="uj-reason">${escHtml(job.reason)}</div>
      </div>
    `;
    unsuitableContainer.appendChild(item);
  });

  const strengthsList = $('strengths-list');
  strengthsList.innerHTML = '';
  (result.strengths || []).forEach(s => {
    const li = document.createElement('li');
    li.textContent = s;
    strengthsList.appendChild(li);
  });

  const weaknessesList = $('weaknesses-list');
  weaknessesList.innerHTML = '';
  (result.weaknesses || []).forEach(w => {
    const li = document.createElement('li');
    li.textContent = w;
    weaknessesList.appendChild(li);
  });

  const wsContainer = $('work-styles');
  wsContainer.innerHTML = '';
  (result.workStyles || []).forEach((ws, i) => {
    const chip = document.createElement('div');
    chip.className = 'workstyle-chip';
    chip.style.animationDelay = `${i * 0.08}s`;
    chip.textContent = ws;
    wsContainer.appendChild(chip);
  });

  $('career-advice').textContent = result.careerAdvice || '';
}

// ─── PR Generation ───────────────────────────
function initResultActions() {
  document.addEventListener('click', (e) => {
    if (e.target.closest('#generate-pr-btn')) generatePR();
    if (e.target.closest('#share-btn'))       shareResult();
    if (e.target.closest('#retry-btn'))       retryDiagnosis();
  });
}

async function generatePR() {
  const prResult  = $('pr-result');
  const prLoading = $('pr-loading');
  const prContent = $('pr-content');
  const genBtn    = $('generate-pr-btn');

  genBtn.disabled = true;
  genBtn.style.opacity = '0.7';
  prResult.style.display  = 'block';
  prLoading.style.display = 'flex';
  prContent.style.display = 'none';

  try {
    const res  = await fetch('/api/generate-pr', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        diagnosisResult: state.diagnosisResult,
        userData: { basicInfo: state.basicInfo, freeText: state.freeText },
      }),
    });

    const data = await res.json();
    prLoading.style.display = 'none';

    if (!res.ok || !data.success) {
      prResult.style.display = 'none';
      showError(data.message || '自己PRの生成に失敗しました。');
      genBtn.disabled = false;
      genBtn.style.opacity = '';
      return;
    }

    const pr = data.result;
    $('pr-text').textContent = pr.prText || '';

    const prStrengths = $('pr-strengths');
    prStrengths.innerHTML = '';
    (pr.keyStrengths || []).forEach(s => {
      const li = document.createElement('li');
      li.textContent = s;
      prStrengths.appendChild(li);
    });

    $('pr-interview').textContent = pr.interviewTips || '';
    prContent.style.display = 'block';
    genBtn.textContent = '✓ 自己PR生成済み';
    genBtn.disabled = true;

  } catch (err) {
    prLoading.style.display = 'none';
    prResult.style.display  = 'none';
    showError('ネットワークエラーが発生しました。');
    genBtn.disabled = false;
    genBtn.style.opacity = '';
  }
}

// ─── Share ───────────────────────────────────
function shareResult() {
  if (!state.diagnosisResult) return;
  const top1 = state.diagnosisResult.suitableJobs?.[0];
  const type = state.diagnosisResult.personalityType;
  const text =
    `Career Compass AIで適職診断をしました！\n\n` +
    `✨ パーソナリティタイプ: ${type}\n` +
    `🏆 適職1位: ${top1?.title}（適性 ${top1?.score}%）\n\n` +
    `#CareerCompassAI #適職診断 #キャリア`;

  if (navigator.share) {
    navigator.share({ title: 'Career Compass AI 診断結果', text }).catch(() => {});
  } else if (navigator.clipboard) {
    navigator.clipboard.writeText(text).then(() => showToast('クリップボードにコピーしました！'));
  } else {
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
  }
}

function showToast(msg) {
  const existing = document.querySelector('.toast-msg');
  if (existing) existing.remove();
  const toast = document.createElement('div');
  toast.className = 'toast-msg';
  toast.style.cssText = `
    position:fixed; bottom:32px; left:50%; transform:translateX(-50%);
    background:var(--gray-900); color:white;
    padding:12px 24px; border-radius:999px;
    font-size:14px; font-weight:500;
    box-shadow:0 8px 32px rgba(0,0,0,0.25);
    z-index:1000; animation:fade-up 0.3s ease-out;
  `;
  toast.textContent = msg;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

// ─── Retry ───────────────────────────────────
function retryDiagnosis() {
  state = {
    currentStep: 0, currentQuestion: 0,
    answers: [], basicInfo: {}, freeText: {},
    diagnosisResult: null, _loadingInterval: null,
  };

  ['age', 'gender', 'education', 'occupation', 'years-of-service'].forEach(id => {
    const el = $(id); if (el) el.value = '';
  });
  ['ft-strengths', 'ft-weaknesses', 'ft-future', 'ft-avoid', 'ft-ideal'].forEach(id => {
    const el = $(id); if (el) el.value = '';
  });
  ['ls-1', 'ls-2', 'ls-3', 'ls-4'].forEach((id, i) => {
    const el = $(id);
    if (el) { el.classList.remove('active', 'done'); if (i === 0) el.classList.add('active'); }
  });

  showStep(1);
  updateProgress(1);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ─── Step / Progress Helpers ─────────────────
function showStep(step) {
  ['step1', 'step2', 'step3', 'step4-loading', 'step4-result'].forEach(id => {
    const el = $(id); if (el) el.style.display = 'none';
  });
  if      (step === 1)        $('step1').style.display        = 'block';
  else if (step === 2)        $('step2').style.display        = 'block';
  else if (step === 3)        $('step3').style.display        = 'block';
  else if (step === 'loading') $('step4-loading').style.display = 'block';
  else if (step === 'result')  $('step4-result').style.display  = 'block';
}

function updateProgress(activeStep) {
  document.querySelectorAll('.progress-step').forEach((el, i) => {
    const n = i + 1;
    el.classList.remove('active', 'completed');
    if (n < activeStep)      el.classList.add('completed');
    else if (n === activeStep) el.classList.add('active');
  });
  document.querySelectorAll('.progress-line').forEach((el, i) => {
    el.classList.toggle('active', i < activeStep - 1);
  });
}

// ─── Error Display ───────────────────────────
function showError(msg) {
  const toast = $('error-toast');
  if (!toast) return;
  $('error-message').textContent = msg;
  toast.style.display = 'flex';
  setTimeout(() => { toast.style.display = 'none'; }, 6000);
}

// ─── Utility ─────────────────────────────────
function escHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function shakeElement(el) {
  if (!el) return;
  el.style.animation = 'none';
  el.offsetHeight;
  el.style.animation = 'shake 0.4s ease-out';
}

function addShakeKeyframes() {
  const style = document.createElement('style');
  style.textContent = `
    @keyframes shake {
      0%, 100% { transform: translateX(0); }
      20%       { transform: translateX(-8px); }
      40%       { transform: translateX(8px); }
      60%       { transform: translateX(-5px); }
      80%       { transform: translateX(5px); }
    }
  `;
  document.head.appendChild(style);
}
