// question.js — scavenger hunt QR landing page
const SUPABASE_URL = 'https://owgldsfxpmzpkipgeksr.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im93Z2xkc2Z4cG16cGtpcGdla3NyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY4MDM2NTYsImV4cCI6MjA5MjM3OTY1Nn0.bD5dNHcQfjjq29DprTnVafxuZeCvt30zu0qQItq6AXY'
const { createClient } = supabase
const db = createClient(SUPABASE_URL, SUPABASE_KEY)

const LETTERS   = ['A','B','C','D']
const identity  = JSON.parse(localStorage.getItem('quiz_identity') || 'null')
const questionId = new URLSearchParams(location.search).get('id')

async function init() {
  if (!questionId)                               return showError('Ingen spørsmål-ID. Skann QR-koden på nytt.')
  if (!identity?.playerId || !identity?.sessionId) return showNoSession()

  const { data: q, error } = await db.from('questions').select('*').eq('id', questionId).single()
  if (error || !q) return showError('Fann ikkje spørsmålet. Er QR-koden riktig?')

  const [existingRes, playerRes, allQsRes] = await Promise.all([
    db.from('session_answers').select('id,selected_option,is_correct,points_earned')
      .eq('player_id', identity.playerId).eq('question_id', questionId).maybeSingle(),
    db.from('session_players').select('total_score').eq('id', identity.playerId).single(),
    db.from('questions').select('id').eq('major_id', identity.quizId)
  ])

  updateHeader(playerRes.data?.total_score || 0, allQsRes.data?.length || 0)
  renderQuestion(q, existingRes.data)
}

function updateHeader(score, total) {
  const s = document.getElementById('totalPoints'); if (s) s.textContent = score
  const t = document.getElementById('totalQs');     if (t && total) t.textContent = total
  const pill = document.getElementById('pointsPill')
  if (pill) { pill.classList.remove('bump'); void pill.offsetWidth; pill.classList.add('bump') }
}

function renderQuestion(q, existing) {
  const options = Array.isArray(q.options) ? q.options : JSON.parse(q.options || '[]')
  const answered = !!existing
  const content  = document.getElementById('content')
  content.innerHTML = ''

  // Question card
  const card = document.createElement('div')
  card.className = 'q-card'
  card.innerHTML = `
    <div class="q-meta">
      <span class="q-badge">Spørsmål</span>
      <span class="q-points-badge">⭐ 1 poeng</span>
    </div>
    ${q.image_url ? `<img class="q-image" src="${esc(q.image_url)}" alt="Bilete">` : ''}
    <div class="q-text">${esc(q.question_text)}</div>`
  content.appendChild(card)

  // Options
  const grid = document.createElement('div')
  grid.className = 'options'
  options.forEach((opt, i) => {
    const btn = document.createElement('button')
    btn.className = 'opt-btn'
    if (answered) {
      if (opt === q.answer)                      btn.classList.add('correct')
      else if (opt === existing.selected_option) btn.classList.add('wrong')
      btn.disabled = true
    }
    btn.innerHTML = `<span class="opt-letter">${LETTERS[i]}</span><span>${esc(opt)}</span>`
    // Event listener — never inline onclick — so special chars can't break it
    btn.addEventListener('click', () => submitAnswer(i, options, q))
    grid.appendChild(btn)
  })
  content.appendChild(grid)

  if (answered) {
    content.appendChild(makeBanner(existing.is_correct, existing.points_earned, q.answer))
    content.appendChild(makeBackBtn())
  }
}

async function submitAnswer(chosenIdx, options, q) {
  // Lock immediately
  document.querySelectorAll('.opt-btn').forEach(b => b.disabled = true)

  const chosenText = options[chosenIdx]
  const isCorrect  = chosenText === q.answer
  const pts        = isCorrect ? 1 : 0

  // Highlight
  document.querySelectorAll('.opt-btn').forEach((btn, i) => {
    if (options[i] === q.answer) btn.classList.add('correct')
    else if (i === chosenIdx)    btn.classList.add('wrong')
  })

  try {
    await db.from('session_answers').insert({
      session_id:       identity.sessionId,
      player_id:        identity.playerId,
      question_id:      q.id,
      selected_option:  chosenText,
      is_correct:       isCorrect,
      points_earned:    pts,
      response_time_ms: null
    })

    if (isCorrect) {
      const { data: player } = await db.from('session_players')
        .select('total_score').eq('id', identity.playerId).single()
      const newScore = (player?.total_score || 0) + pts
      await db.from('session_players').update({ total_score: newScore }).eq('id', identity.playerId)
      updateHeader(newScore, null)
    }

    // Check if all questions answered
    const [answeredRes, allQsRes] = await Promise.all([
      db.from('session_answers').select('id')
        .eq('player_id', identity.playerId).eq('session_id', identity.sessionId),
      db.from('questions').select('id').eq('major_id', identity.quizId)
    ])
    if ((answeredRes.data?.length || 0) >= (allQsRes.data?.length || 0)) {
      await db.from('session_players')
        .update({ hunt_finished_at: new Date().toISOString() })
        .eq('id', identity.playerId)
    }
  } catch (err) {
    console.error('Kunne ikkje lagre svar:', err)
  }

  const content = document.getElementById('content')
  content.appendChild(makeBanner(isCorrect, pts, q.answer))
  content.appendChild(makeBackBtn())
}

function makeBanner(isCorrect, pts, correct) {
  const d = document.createElement('div')
  d.className = `result-banner ${isCorrect ? 'correct-banner' : 'wrong-banner'}`
  d.innerHTML = isCorrect
    ? `<div class="result-icon">🎉</div><div><div class="result-title">Riktig svar!</div><div class="result-desc">+${pts} poeng! Hald fram jakta!</div></div>`
    : `<div class="result-icon">❌</div><div><div class="result-title">Feil svar</div><div class="result-desc">Riktig svar var: <strong style="color:var(--text)">${esc(correct)}</strong></div></div>`
  return d
}

function makeBackBtn() {
  const a = document.createElement('a')
  a.href = 'index.html'
  a.className = 'btn-back'
  a.textContent = '← Tilbake til jakta'
  return a
}

function showNoSession() {
  document.getElementById('content').innerHTML = `
    <div class="center-msg">
      <div style="font-size:2.5rem">🔒</div>
      <div style="font-weight:700;margin-bottom:.5rem;color:var(--text)">Ikkje med i ein quiz</div>
      <div style="font-size:.9rem;color:var(--muted);margin-bottom:1.5rem;">Skriv inn PIN-koden frå læraren fyrst.</div>
      <a href="index.html" class="btn-back">Bli med →</a>
    </div>`
}

function showError(msg) {
  document.getElementById('content').innerHTML = `
    <div class="center-msg">
      <div style="font-size:2.5rem">🤔</div>
      <div style="font-size:.9rem;color:var(--muted)">${esc(msg)}</div>
      <a href="index.html" class="btn-back" style="margin-top:1rem;max-width:240px;">← Tilbake</a>
    </div>`
}

function esc(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')
}

init()
