// question.js — scavenger hunt QR scan landing page
// URL format: question.html?id=QUESTION_ID
// Player identity stored in localStorage by index.html when they joined

const SUPABASE_URL = 'https://owgldsfxpmzpkipgeksr.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im93Z2xkc2Z4cG16cGtpcGdla3NyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY4MDM2NTYsImV4cCI6MjA5MjM3OTY1Nn0.bD5dNHcQfjjq29DprTnVafxuZeCvt30zu0qQItq6AXY'
const { createClient } = supabase
const db = createClient(SUPABASE_URL, SUPABASE_KEY)

const LETTERS = ['A', 'B', 'C', 'D']

// Get player identity from localStorage (set when they joined in index.html)
const identity   = JSON.parse(localStorage.getItem('quiz_identity') || 'null')
const questionId = new URLSearchParams(location.search).get('id')

// ── INIT ──
async function init() {
  if (!questionId) return showError('Ingen spørsmål-ID i URL-en. Skann QR-koden på nytt.')

  // No identity = not joined a quiz
  if (!identity || !identity.playerId || !identity.sessionId) {
    return showNoSession()
  }

  // Fetch the question
  const { data: q, error } = await db
    .from('questions')
    .select('*')
    .eq('id', questionId)
    .single()

  if (error || !q) return showError('Fann ikkje spørsmålet. Er QR-koden riktig?')

  // Check if already answered this question in this session
  const { data: existing } = await db
    .from('session_answers')
    .select('id, selected_option, is_correct, points_earned')
    .eq('player_id', identity.playerId)
    .eq('question_id', questionId)
    .maybeSingle()

  // Fetch player's current score and total questions in this quiz
  const { data: player } = await db
    .from('session_players')
    .select('total_score, nickname')
    .eq('id', identity.playerId)
    .single()

  const { data: allQs } = await db
    .from('questions')
    .select('id')
    .eq('major_id', identity.quizId)

  const totalQs    = allQs?.length || 0
  const totalScore = player?.total_score || 0

  updateHeader(totalScore, totalQs)
  renderQuestion(q, existing)
}

function updateHeader(score, total) {
  const el = document.getElementById('totalPoints')
  if (el) el.textContent = score
  const tot = document.getElementById('totalQs')
  if (tot) tot.textContent = total
}

// ── RENDER QUESTION ──
function renderQuestion(q, existing) {
  const options = Array.isArray(q.options) ? q.options : JSON.parse(q.options || '[]')
  const alreadyAnswered = !!existing

  let html = `
    <div class="q-card">
      <div class="q-meta">
        <span class="q-badge">Spørsmål</span>
        <span class="q-points-badge">⭐ 1 poeng</span>
      </div>
      ${q.image_url ? `<img class="q-image" src="${q.image_url}" alt="Bilete til spørsmålet" />` : ''}
      <div class="q-text">${esc(q.question_text)}</div>
    </div>
    <div class="options" id="options">`

  options.forEach((opt, i) => {
    let cls = ''
    if (alreadyAnswered) {
      if (opt === q.answer)                  cls = 'correct'
      else if (opt === existing.selected_option) cls = 'wrong'
    }
    html += `
      <button class="opt-btn ${cls}" ${alreadyAnswered ? 'disabled' : ''}
        onclick="answer(${i}, '${escAttr(q.answer)}', '${q.id}')">
        <span class="opt-letter">${LETTERS[i]}</span>
        <div>${esc(opt)}</div>
      </button>`
  })

  html += `</div>`

  if (alreadyAnswered) {
    html += resultBannerHtml(existing.is_correct, existing.points_earned, q.answer)
    html += backButtonHtml()
  }

  document.getElementById('content').innerHTML = html
}

// ── ANSWER ──
async function answer(chosenIdx, correctAnswer, qId) {
  // Disable all buttons immediately
  document.querySelectorAll('.opt-btn').forEach(b => b.disabled = true)

  const buttons  = document.querySelectorAll('.opt-btn')
  const chosenEl = buttons[chosenIdx]
  const chosenText = chosenEl.querySelector('div').textContent.trim()
  const isCorrect  = chosenText === correctAnswer

  // Highlight
  buttons.forEach(b => {
    const txt = b.querySelector('div').textContent.trim()
    if (txt === correctAnswer)  b.classList.add('correct')
    else if (b === chosenEl)    b.classList.add('wrong')
  })

  // Points: 1 point for single correct, up to 2 if multiple correct answers exist
  // (for now questions have one correct answer, so always 1 point)
  const pts = isCorrect ? 1 : 0

  // Save to DB
  try {
    await db.from('session_answers').insert({
      session_id:      identity.sessionId,
      player_id:       identity.playerId,
      question_id:     qId,
      selected_option: chosenText,
      is_correct:      isCorrect,
      points_earned:   pts,
      response_time_ms: null
    })

    if (isCorrect) {
      // Update player total score
      const { data: player } = await db
        .from('session_players')
        .select('total_score')
        .eq('id', identity.playerId)
        .single()
      const newScore = (player?.total_score || 0) + pts
      await db.from('session_players').update({ total_score: newScore }).eq('id', identity.playerId)
      updateHeader(newScore, null)

      // Check if all questions answered → mark hunt_finished_at
      const { data: answered } = await db
        .from('session_answers')
        .select('id')
        .eq('player_id', identity.playerId)
        .eq('session_id', identity.sessionId)
      const { data: allQs } = await db
        .from('questions')
        .select('id')
        .eq('major_id', identity.quizId)
      if (answered?.length >= allQs?.length) {
        await db.from('session_players')
          .update({ hunt_finished_at: new Date().toISOString() })
          .eq('id', identity.playerId)
      }
    }
  } catch (err) {
    console.error('Kunne ikkje lagre svar:', err)
  }

  const content = document.getElementById('content')
  const div = document.createElement('div')
  div.innerHTML = resultBannerHtml(isCorrect, pts, correctAnswer)
  content.appendChild(div.firstElementChild)
  content.appendChild(document.createRange().createContextualFragment(backButtonHtml()))
}

// ── UI HELPERS ──
function resultBannerHtml(isCorrect, pts, correct) {
  return isCorrect
    ? `<div class="result-banner correct-banner">
         <div class="result-icon">🎉</div>
         <div>
           <div class="result-title">Riktig svar!</div>
           <div class="result-desc">+${pts} poeng! Hald fram jakta!</div>
         </div>
       </div>`
    : `<div class="result-banner wrong-banner">
         <div class="result-icon">❌</div>
         <div>
           <div class="result-title">Feil svar</div>
           <div class="result-desc">Riktig svar var: <strong>${esc(correct)}</strong></div>
         </div>
       </div>`
}

function backButtonHtml() {
  return `<a href="index.html" class="btn-back">← Tilbake til oversikt</a>`
}

function showNoSession() {
  document.getElementById('content').innerHTML = `
    <div class="center-msg">
      <div style="font-size:2.5rem">🔒</div>
      <div style="font-size:1rem;font-weight:700;margin-bottom:.5rem;">Ikkje med i ein quiz</div>
      <div style="font-size:.9rem;color:var(--muted);margin-bottom:1.5rem;">Du må bli med i ein quiz fyrst ved å skrive inn PIN-koden frå læraren.</div>
      <a href="index.html" class="btn-back">Bli med i quiz →</a>
    </div>`
}

function showError(msg) {
  document.getElementById('content').innerHTML = `
    <div class="center-msg">
      <div style="font-size:2.5rem">🤔</div>
      <div style="font-size:.95rem;color:var(--ink)">${msg}</div>
    </div>`
}

function esc(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')
}
function escAttr(str) {
  return String(str).replace(/\\/g,'\\\\').replace(/'/g,"\\'")
}

init()
