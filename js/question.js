const SUPABASE_URL = 'https://owgldsfxpmzpkipgeksr.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im93Z2xkc2Z4cG16cGtpcGdla3NyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY4MDM2NTYsImV4cCI6MjA5MjM3OTY1Nn0.bD5dNHcQfjjq29DprTnVafxuZeCvt30zu0qQItq6AXY'
const { createClient } = supabase
const db = createClient(SUPABASE_URL, SUPABASE_KEY)

const STORAGE_KEY  = 'quizapp_points'
const ANSWERED_KEY = 'quizapp_answered'
const LETTERS      = ['A', 'B', 'C', 'D']

let totalPoints = parseInt(sessionStorage.getItem(STORAGE_KEY) || '0')
let answered    = JSON.parse(sessionStorage.getItem(ANSWERED_KEY) || '{}')

document.getElementById('totalPoints').textContent = totalPoints

const params     = new URLSearchParams(location.search)
const questionId = params.get('id')

// ── INIT ──
async function init() {
  if (!questionId) return showError('Ingen spørsmål-ID i URL-en.')

  const { data, error } = await db
    .from('questions')
    .select('*')
    .eq('id', questionId)
    .single()

  if (error || !data) return showError('Fann ikkje spørsmålet. Sjekk at QR-koden er riktig.')
  renderQuestion(data)
}

// ── RENDER QUESTION ──
function renderQuestion(q) {
  const alreadyAnswered = answered[q.id]
  const options = Array.isArray(q.options) ? q.options : JSON.parse(q.options || '[]')
  const pts = q.points || 10

  let html = `
    <div class="q-card">
      <div class="q-meta">
        <span class="q-badge">Spørsmål</span>
        <span class="q-points-badge">⭐ ${pts} poeng</span>
      </div>
      ${q.emoji ? `<span class="q-emoji">${q.emoji}</span>` : ''}
      ${q.image_url ? `<img class="q-image" src="${q.image_url}" alt="Bilete til spørsmålet" />` : ''}
      <div class="q-text">${q.question_text}</div>
    </div>
    <div class="options" id="options">`

  options.forEach((opt, i) => {
    let cls = ''
    if (alreadyAnswered) {
      if (opt === q.answer)             cls = 'correct'
      else if (opt === alreadyAnswered) cls = 'wrong'
    }
    html += `
      <button class="opt-btn ${cls}" ${alreadyAnswered ? 'disabled' : ''}
        onclick="answer('${esc(opt)}','${esc(q.answer)}',${pts},'${q.id}')">
        <span class="opt-letter">${LETTERS[i]}</span>
        <div>${opt}</div>
      </button>`
  })

  html += `</div>`
  if (alreadyAnswered) {
    html += resultBannerHtml(alreadyAnswered === q.answer, alreadyAnswered === q.answer ? pts : 0, q.answer)
  }

  document.getElementById('content').innerHTML = html
}

// ── ANSWER ──
function answer(chosen, correct, points, qId) {
  document.querySelectorAll('.opt-btn').forEach(b => b.disabled = true)
  const isCorrect = chosen === correct

  document.querySelectorAll('.opt-btn').forEach(b => {
    const label = b.querySelector('div').textContent.trim()
    if (label === correct)     b.classList.add('correct')
    else if (label === chosen) b.classList.add('wrong')
  })

  answered[qId] = chosen
  sessionStorage.setItem(ANSWERED_KEY, JSON.stringify(answered))

  if (isCorrect) {
    totalPoints += points
    sessionStorage.setItem(STORAGE_KEY, totalPoints)
    document.getElementById('totalPoints').textContent = totalPoints
    const pill = document.getElementById('pointsPill')
    pill.classList.remove('bump')
    void pill.offsetWidth
    pill.classList.add('bump')
  }

  const div = document.createElement('div')
  div.innerHTML = resultBannerHtml(isCorrect, isCorrect ? points : 0, correct)
  document.getElementById('content').appendChild(div.firstElementChild)
}

// ── RESULT BANNER ──
function resultBannerHtml(isCorrect, earned, correct) {
  return isCorrect
    ? `<div class="result-banner correct-banner">
         <div class="result-icon">🎉</div>
         <div>
           <div class="result-title">Riktig svar!</div>
           <div class="result-desc">Du fekk +${earned} poeng. Totalt: ${totalPoints} poeng.</div>
         </div>
       </div>`
    : `<div class="result-banner wrong-banner">
         <div class="result-icon">❌</div>
         <div>
           <div class="result-title">Feil svar</div>
           <div class="result-desc">Riktig svar var: <strong style="color:var(--ink)">${correct}</strong></div>
         </div>
       </div>`
}

// ── ERROR ──
function showError(msg) {
  document.getElementById('content').innerHTML = `
    <div class="center-msg">
      <div style="font-size:2.5rem">🤔</div>
      <div style="font-size:0.95rem;color:var(--ink)">${msg}</div>
    </div>`
}

// ── ESCAPE ──
function esc(str) {
  return String(str).replace(/\\/g, '\\\\').replace(/'/g, "\\'")
}

init()