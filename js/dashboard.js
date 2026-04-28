const SUPABASE_URL = 'https://owgldsfxpmzpkipgeksr.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im93Z2xkc2Z4cG16cGtpcGdla3NyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY4MDM2NTYsImV4cCI6MjA5MjM3OTY1Nn0.bD5dNHcQfjjq29DprTnVafxuZeCvt30zu0qQItq6AXY'
const { createClient } = supabase
const db = createClient(SUPABASE_URL, SUPABASE_KEY)

const EMOJIS = ['🗺️','🔍','🏆','🎯','🌍','🧭','🏫','🎓','📚','🔬','🎨','🧩','⚡','🌟','🚀','🦁','🐉','🌊']
let selectedEmoji = EMOJIS[0]
let allQuizzes    = []
let currentUser   = null
let activeQrQuizId = null

// ── INIT ──
async function init() {
  const { data } = await db.auth.getSession()
  if (!data.session) { window.location.href = 'index.html'; return }

  currentUser = data.session.user
  document.getElementById('userEmail').textContent   = currentUser.email.split('@')[0]
  document.getElementById('userInitial').textContent = currentUser.email[0].toUpperCase()

  buildEmojiGrid()
  loadQuizzes()
}

// ── EMOJI GRID ──
function buildEmojiGrid() {
  const grid = document.getElementById('emojiGrid')
  EMOJIS.forEach((e, i) => {
    const btn = document.createElement('button')
    btn.className = 'emoji-btn' + (i === 0 ? ' selected' : '')
    btn.textContent = e
    btn.onclick = () => {
      document.querySelectorAll('.emoji-btn').forEach(b => b.classList.remove('selected'))
      btn.classList.add('selected')
      selectedEmoji = e
    }
    grid.appendChild(btn)
  })
}

// ── LOAD QUIZZES ──
async function loadQuizzes() {
  try {
    const { data, error } = await db
      .from('quizzes')
      .select('*')
      .eq('teacher_id', currentUser.id)
      .order('created_at', { ascending: false })
    if (error) throw error
    allQuizzes = data || []
  } catch {
    allQuizzes = []
  }
  renderQuizzes(allQuizzes)
  updateStats(allQuizzes)
}

// ── RENDER QUIZ CARDS ──
function renderQuizzes(list) {
  const grid = document.getElementById('quizGrid')
  grid.innerHTML = ''

  if (list.length === 0) {
    grid.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🗺️</div>
        <div class="empty-title">Ingen quizzar enno</div>
        <div class="empty-desc">Trykk «Ny quiz» for å kome i gang med ditt første rebusløp.</div>
      </div>`
    return
  }

  list.forEach(q => {
    const card = document.createElement('div')
    card.className = 'quiz-card'

    const badgeClass = q.status === 'active' ? 'badge-active' : 'badge-draft'
    const badgeLabel = q.status === 'active' ? 'Aktiv' : 'Kladd'
    const date = new Date(q.created_at).toLocaleDateString('no', {
      day: 'numeric', month: 'short', year: 'numeric'
    })
    const nameEsc = q.name.replace(/'/g, "\\'")

    card.innerHTML = `
      <div class="quiz-card-top">
        <div class="quiz-emoji">${q.emoji || '🎯'}</div>
        <span class="quiz-badge ${badgeClass}">${badgeLabel}</span>
      </div>
      <div>
        <div class="quiz-name">${q.name}</div>
        <div class="quiz-meta">Oppretta ${date}</div>
      </div>
      <div class="quiz-card-footer">
        <div class="quiz-stats">
          <div class="quiz-stat">📝 ${q.question_count || 0} spørsmål</div>
          <div class="quiz-stat">👥 ${q.session_count  || 0} økter</div>
        </div>
        <div class="quiz-card-actions">
          <button class="btn-qr"
            onclick="event.stopPropagation(); openQrModal('${q.id}','${nameEsc}','${q.emoji || '🎯'}')"
            title="Vis QR-kode">
            <svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <rect x="3" y="3" width="7" height="7" rx="1"/>
              <rect x="14" y="3" width="7" height="7" rx="1"/>
              <rect x="3" y="14" width="7" height="7" rx="1"/>
              <path d="M14 14h2v2h-2zM18 14h3M14 18h2M18 18h3M14 22h3M18 22h2"/>
            </svg>
          </button>
          <a class="btn-open" href="quiz.html?id=${q.id}" onclick="event.stopPropagation()">Opne →</a>
        </div>
      </div>`

    card.addEventListener('click', (e) => {
      if (!e.target.closest('.quiz-card-actions')) {
        window.location.href = `quiz.html?id=${q.id}`
      }
    })

    grid.appendChild(card)
  })
}

// ── STATS ──
function updateStats(list) {
  document.getElementById('statTotal').textContent  = list.length
  document.getElementById('statActive').textContent = list.filter(q => q.status === 'active').length
  document.getElementById('statDraft').textContent  = list.filter(q => !q.status || q.status === 'draft').length
}

// ── SEARCH ──
function filterQuizzes(q) {
  const term = q.toLowerCase()
  renderQuizzes(allQuizzes.filter(quiz => quiz.name.toLowerCase().includes(term)))
}

// ── CREATE MODAL ──
function openModal() {
  document.getElementById('modalOverlay').classList.add('open')
  setTimeout(() => document.getElementById('newName').focus(), 150)
}
function closeModal() {
  document.getElementById('modalOverlay').classList.remove('open')
  document.getElementById('newName').value = ''
}
function closeModalIfBg(e) {
  if (e.target === document.getElementById('modalOverlay')) closeModal()
}

// ── QR MODAL ──
function openQrModal(quizId, quizName, emoji) {
  activeQrQuizId = quizId

  document.getElementById('qrModalTitle').textContent = emoji + ' ' + quizName

  // URL som QR-koden peikar på: QR-scan.html?id=<quizId>
  const base  = window.location.origin + window.location.pathname.replace('dashboard.html', '')
  const qrUrl = `${base}QR-scan.html?id=${quizId}`
  document.getElementById('qrUrl').textContent = qrUrl

  const canvas = document.getElementById('qrCanvas')
  QRCode.toCanvas(canvas, qrUrl, {
    width: 200,
    margin: 2,
    color: { dark: '#111118', light: '#ffffff' }
  }, err => { if (err) console.error(err) })

  document.getElementById('qrModalOverlay').classList.add('open')
}
function closeQrModal() {
  document.getElementById('qrModalOverlay').classList.remove('open')
  activeQrQuizId = null
}
function closeQrModalIfBg(e) {
  if (e.target === document.getElementById('qrModalOverlay')) closeQrModal()
}
function downloadQr() {
  const canvas = document.getElementById('qrCanvas')
  const quiz   = allQuizzes.find(q => q.id === activeQrQuizId)
  const name   = quiz ? quiz.name.replace(/\s+/g, '_') : 'quiz'
  const link   = document.createElement('a')
  link.download = `QR_${name}.png`
  link.href     = canvas.toDataURL('image/png')
  link.click()
  showToast('📥 QR-kode lasta ned!')
}

// ── CREATE QUIZ ──
async function createQuiz() {
  const name = document.getElementById('newName').value.trim()
  if (!name) { document.getElementById('newName').focus(); return }

  const btn = document.getElementById('submitBtn')
  btn.disabled = true
  btn.textContent = 'Oppretter…'

  const newQuiz = {
    name,
    emoji:          selectedEmoji,
    teacher_id:     currentUser.id,
    status:         'draft',
    created_at:     new Date().toISOString(),
    question_count: 0,
    session_count:  0
  }

  try {
    const { data, error } = await db.from('quizzes').insert(newQuiz).select().single()
    if (error) throw error
    allQuizzes.unshift(data)
    renderQuizzes(allQuizzes)
    updateStats(allQuizzes)
    closeModal()
    showToast('✅ Quiz oppretta!')
  } catch {
    newQuiz.id = 'local-' + Date.now()
    allQuizzes.unshift(newQuiz)
    renderQuizzes(allQuizzes)
    updateStats(allQuizzes)
    closeModal()
    showToast('Quiz lagt til lokalt – set opp quizzes-tabellen i Supabase')
  }

  btn.disabled = false
  btn.textContent = 'Opprett quiz'
}

// ── TOAST ──
function showToast(msg) {
  const t = document.getElementById('toast')
  t.textContent = msg
  t.classList.add('show')
  setTimeout(() => t.classList.remove('show'), 3000)
}

// ── LOGOUT ──
async function logout() {
  await db.auth.signOut()
  window.location.href = 'index.html'
}

// ── KEYBOARD ──
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { closeModal(); closeQrModal() }
  if (e.key === 'Enter' && document.getElementById('modalOverlay').classList.contains('open')) createQuiz()
})

init()
