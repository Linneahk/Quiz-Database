const SUPABASE_URL = 'https://owgldsfxpmzpkipgeksr.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im93Z2xkc2Z4cG16cGtpcGdla3NyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY4MDM2NTYsImV4cCI6MjA5MjM3OTY1Nn0.bD5dNHcQfjjq29DprTnVafxuZeCvt30zu0qQItq6AXY'
const { createClient } = supabase
const db = createClient(SUPABASE_URL, SUPABASE_KEY)

// ── FARGEPALETT ──
// Kvar farge har bg (bakgrunn) og ink (skriftfarge med god kontrast)
const COLORS = [
  { name: 'Lime',    bg: '#c8f050', ink: '#111118' },
  { name: 'Grøn',    bg: '#22c55e', ink: '#ffffff' },
  { name: 'Mint',    bg: '#a7f3d0', ink: '#064e3b' },
  { name: 'Blå',     bg: '#3b82f6', ink: '#ffffff' },
  { name: 'Himmel',  bg: '#7dd3fc', ink: '#0c4a6e' },
  { name: 'Indigo',  bg: '#6366f1', ink: '#ffffff' },
  { name: 'Lilla',   bg: '#a855f7', ink: '#ffffff' },
  { name: 'Rosa',    bg: '#ec4899', ink: '#ffffff' },
  { name: 'Fersken', bg: '#fdba74', ink: '#7c2d12' },
  { name: 'Oransje', bg: '#f97316', ink: '#ffffff' },
  { name: 'Raud',    bg: '#ef4444', ink: '#ffffff' },
  { name: 'Vinrød',  bg: '#991b1b', ink: '#ffffff' },
  { name: 'Gul',     bg: '#fde047', ink: '#111118' },
  { name: 'Sand',    bg: '#fef3c7', ink: '#78350f' },
  { name: 'Grå',     bg: '#9ca3af', ink: '#ffffff' },
  { name: 'Svart',   bg: '#1f2937', ink: '#ffffff' }
]

let selectedColor   = COLORS[0]
let allQuizzes      = []
let teachersById    = {}
let currentUser     = null
let isAdmin         = false
let activeQrQuizId  = null
let pendingDeleteId = null

// Hjelp: finn farge-objekt frå lagra bg-verdi
function findColor(bg) {
  return COLORS.find(c => c.bg === bg) || COLORS[0]
}

// ── INIT ──
async function init() {
  const { data } = await db.auth.getSession()
  if (!data.session) { window.location.href = 'login.html'; return }

  currentUser = data.session.user
  document.getElementById('userEmail').textContent   = currentUser.email.split('@')[0]
  document.getElementById('userInitial').textContent = currentUser.email[0].toUpperCase()

  // Sjekk om brukaren er admin (men IKKJE vis merke)
  const { data: me } = await db
    .from('teachers')
    .select('is_admin')
    .eq('id', currentUser.id)
    .single()
  isAdmin = !!(me && me.is_admin)

  buildColorGrid()
  loadQuizzes()
}

// ── COLOR GRID ──
function buildColorGrid() {
  const grid = document.getElementById('colorGrid')
  grid.innerHTML = ''
  COLORS.forEach((c, i) => {
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.className = 'color-btn' + (i === 0 ? ' selected' : '')
    btn.style.background = c.bg
    btn.title = c.name
    btn.setAttribute('aria-label', c.name)
    btn.onclick = () => {
      document.querySelectorAll('.color-btn').forEach(b => b.classList.remove('selected'))
      btn.classList.add('selected')
      selectedColor = c
    }
    grid.appendChild(btn)
  })
}

// ── LOAD QUIZZES ──
async function loadQuizzes() {
  try {
    let query = db.from('quizzes').select('*').order('created_at', { ascending: false })
    if (!isAdmin) query = query.eq('teacher_id', currentUser.id)

    const { data, error } = await query
    if (error) throw error
    allQuizzes = data || []

    if (isAdmin && allQuizzes.length > 0) {
      const ids = [...new Set(allQuizzes.map(q => q.teacher_id).filter(Boolean))]
      if (ids.length > 0) {
        const { data: teachers } = await db
          .from('teachers')
          .select('id, email, full_name')
          .in('id', ids)
        teachersById = {}
        ;(teachers || []).forEach(t => { teachersById[t.id] = t })
      }
    }
  } catch (err) {
    console.error('Kunne ikkje hente quizzar:', err)
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

    // Hent farge frå quiz (fallback til lime)
    const color    = findColor(q.color || COLORS[0].bg)
    const bgColor  = color.bg
    const inkColor = color.ink

    // Sett accent-farge på kortet via CSS-variabler
    card.style.setProperty('--quiz-bg',  bgColor)
    card.style.setProperty('--quiz-ink', inkColor)

    const date = new Date(q.created_at).toLocaleDateString('no', {
      day: 'numeric', month: 'short', year: 'numeric'
    })

    const nameEsc  = escAttr(q.name)
    const colorEsc = escAttr(bgColor)
    const inkEsc   = escAttr(inkColor)

    // Eigar-line (berre admin ser dette på andre sine quizzar)
    let ownerLine = ''
    if (isAdmin && q.teacher_id !== currentUser.id) {
      const t = teachersById[q.teacher_id]
      const ownerLabel = t
        ? (t.full_name || t.email || 'Ukjend lærar')
        : 'Ukjend lærar'
      ownerLine = `<div class="quiz-owner">👤 ${escHtml(ownerLabel)}</div>`
    }

    card.innerHTML = `
      <div class="quiz-color-band" style="background:${bgColor}; color:${inkColor}">
        <span class="quiz-color-name">${escHtml(q.name)}</span>
      </div>
      <div class="quiz-card-body">
        <div class="quiz-meta">Oppretta ${date}</div>
        ${ownerLine}
        <div class="quiz-card-footer">
          <div class="quiz-stats">
            <div class="quiz-stat">📝 ${q.question_count || 0} spørsmål</div>
            <div class="quiz-stat">👥 ${q.session_count  || 0} økter</div>
          </div>
          <div class="quiz-card-actions">
            <button class="btn-qr"
              data-quiz-id="${q.id}"
              data-quiz-name="${nameEsc}"
              data-quiz-color="${colorEsc}"
              data-quiz-ink="${inkEsc}"
              title="Vis QR-kode">
              <svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <rect x="3" y="3" width="7" height="7" rx="1"/>
                <rect x="14" y="3" width="7" height="7" rx="1"/>
                <rect x="3" y="14" width="7" height="7" rx="1"/>
                <path d="M14 14h2v2h-2zM18 14h3M14 18h2M18 18h3M14 22h3M18 22h2"/>
              </svg>
            </button>
            <button class="btn-delete-quiz"
              data-quiz-id="${q.id}"
              data-quiz-name="${nameEsc}"
              title="Slett quiz">
              <svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                <path d="M10 11v6M14 11v6"/>
                <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
              </svg>
            </button>
            <a class="btn-open" href="quiz.html?id=${q.id}">Opne →</a>
          </div>
        </div>
      </div>`

    // Klikk på korthovudet → opne quizen
    card.addEventListener('click', (e) => {
      if (!e.target.closest('.quiz-card-actions')) {
        window.location.href = `quiz.html?id=${q.id}`
      }
    })

    // Knappe-handlarar
    card.querySelector('.btn-qr').addEventListener('click', (e) => {
      e.stopPropagation()
      const b = e.currentTarget
      openQrModal(b.dataset.quizId, b.dataset.quizName, b.dataset.quizColor, b.dataset.quizInk)
    })
    card.querySelector('.btn-delete-quiz').addEventListener('click', (e) => {
      e.stopPropagation()
      const b = e.currentTarget
      askDeleteQuiz(b.dataset.quizId, b.dataset.quizName)
    })

    grid.appendChild(card)
  })
}

// ── STATS ──
function updateStats(list) {
  document.getElementById('statTotal').textContent  = list.length
  document.getElementById('statActive').textContent = list.filter(q => q.status === 'active').length
}

// ── SEARCH ──
function filterQuizzes(q) {
  const term = (q || '').toLowerCase()
  renderQuizzes(allQuizzes.filter(quiz => (quiz.name || '').toLowerCase().includes(term)))
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
function openQrModal(quizId, quizName, bgColor, inkColor) {
  activeQrQuizId = quizId

  // Bruk farge i tittelen som ein liten fargeprikk
  const titleEl = document.getElementById('qrModalTitle')
  titleEl.innerHTML = `<span class="qr-modal-dot" style="background:${bgColor}"></span>${escHtml(quizName)}`

  const base  = window.location.origin + window.location.pathname.replace('dashboard.html', '')
  const qrUrl = `${base}QR-scan.html?id=${quizId}`
  document.getElementById('qrUrl').textContent = qrUrl

  // Set bakgrunn på QR-wrapen til quiz-fargen
  const wrap = document.getElementById('qrCanvasWrap')
  wrap.style.background = bgColor

  // Bestem QR-modulfarge ut frå kontrast (mørke fargar → lyse moduler funkar dårleg for skanning,
  // så vi held QR-koden alltid mørk på lys bakgrunn inni eit kvit-kort, og bruker quizfargen som ramme)
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

// ── DELETE QUIZ ──
function askDeleteQuiz(quizId, quizName) {
  pendingDeleteId = quizId
  document.getElementById('deleteQuizName').textContent = quizName
  document.getElementById('deleteOverlay').classList.add('open')
}
function closeDeleteModal() {
  document.getElementById('deleteOverlay').classList.remove('open')
  pendingDeleteId = null
}
function closeDeleteModalIfBg(e) {
  if (e.target === document.getElementById('deleteOverlay')) closeDeleteModal()
}

async function confirmDeleteQuiz() {
  if (!pendingDeleteId) return
  const id  = pendingDeleteId
  const btn = document.getElementById('deleteConfirmBtn')
  btn.disabled = true
  btn.textContent = 'Slettar…'

  try {
    const { error } = await db.from('quizzes').delete().eq('id', id)
    if (error) throw error

    allQuizzes = allQuizzes.filter(q => q.id !== id)
    renderQuizzes(allQuizzes)
    updateStats(allQuizzes)
    showToast('🗑️ Quiz sletta')
  } catch (err) {
    console.error(err)
    showToast('❌ Kunne ikkje slette: ' + (err.message || 'ukjend feil'))
  } finally {
    btn.disabled = false
    btn.textContent = 'Slett quiz'
    closeDeleteModal()
  }
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
    color:          selectedColor.bg,
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
  } catch (err) {
    console.error(err)
    showToast('❌ Kunne ikkje opprette quiz: ' + (err.message || ''))
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
  window.location.href = 'login.html'
}

// ── ESCAPE HELPERS ──
function escHtml(str) {
  return String(str)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;')
    .replace(/'/g,'&#39;')
}
function escAttr(str) {
  return escHtml(str)
}

// ── KEYBOARD ──
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    closeModal()
    closeQrModal()
    closeDeleteModal()
  }
  if (e.key === 'Enter' && document.getElementById('modalOverlay').classList.contains('open')) {
    createQuiz()
  }
})

// Eksponer for inline onclick i HTML
window.openModal              = openModal
window.closeModal             = closeModal
window.closeModalIfBg         = closeModalIfBg
window.closeQrModal           = closeQrModal
window.closeQrModalIfBg       = closeQrModalIfBg
window.downloadQr             = downloadQr
window.createQuiz             = createQuiz
window.filterQuizzes          = filterQuizzes
window.logout                 = logout
window.confirmDeleteQuiz      = confirmDeleteQuiz
window.closeDeleteModal       = closeDeleteModal
window.closeDeleteModalIfBg   = closeDeleteModalIfBg

init()
