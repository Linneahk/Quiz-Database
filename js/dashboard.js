const SUPABASE_URL = 'https://owgldsfxpmzpkipgeksr.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im93Z2xkc2Z4cG16cGtpcGdla3NyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY4MDM2NTYsImV4cCI6MjA5MjM3OTY1Nn0.bD5dNHcQfjjq29DprTnVafxuZeCvt30zu0qQItq6AXY'
const { createClient } = supabase
const db = createClient(SUPABASE_URL, SUPABASE_KEY)

const EMOJIS = ['🗺️','🔍','🏆','🎯','🌍','🧭','🏫','🎓','📚','🔬','🎨','🧩','⚡','🌟','🚀','🦁','🐉','🌊']
let selectedEmoji  = EMOJIS[0]
let allQuizzes     = []
let teachersById   = {}        // { teacher_id: { email, full_name } }
let currentUser    = null
let isAdmin        = false
let activeQrQuizId = null
let pendingDeleteId = null

// ── INIT ──
async function init() {
  const { data } = await db.auth.getSession()
  if (!data.session) { window.location.href = 'index.html'; return }

  currentUser = data.session.user
  document.getElementById('userEmail').textContent   = currentUser.email.split('@')[0]
  document.getElementById('userInitial').textContent = currentUser.email[0].toUpperCase()

  // Sjekk om brukaren er admin
  const { data: me } = await db
    .from('teachers')
    .select('is_admin')
    .eq('id', currentUser.id)
    .single()
  isAdmin = !!(me && me.is_admin)

  // Vis admin-merke om aktuelt
  if (isAdmin) {
    const chip = document.getElementById('userChip')
    if (chip && !chip.querySelector('.admin-badge')) {
      const badge = document.createElement('span')
      badge.className = 'admin-badge'
      badge.textContent = 'Admin'
      chip.appendChild(badge)
    }
  }

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
    let query = db.from('quizzes').select('*').order('created_at', { ascending: false })
    // Admin: hent alle. Vanleg lærar: berre sine eigne (RLS handterer dette uansett,
    // men vi sender ikkje filter slik at admin-policyen får sleppe alle gjennom).
    if (!isAdmin) query = query.eq('teacher_id', currentUser.id)

    const { data, error } = await query
    if (error) throw error
    allQuizzes = data || []

    // For admin: hent lærar-info så vi kan vise kven som eig kvar quiz
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

    const badgeClass = q.status === 'active' ? 'badge-active' : 'badge-draft'
    const badgeLabel = q.status === 'active' ? 'Aktiv' : 'Kladd'
    const date = new Date(q.created_at).toLocaleDateString('no', {
      day: 'numeric', month: 'short', year: 'numeric'
    })

    const nameEsc  = escAttr(q.name)
    const emojiEsc = escAttr(q.emoji || '🎯')

    // Eigar-line (berre admin ser dette, og berre når quizen ikkje er deira eiga)
    let ownerLine = ''
    if (isAdmin && q.teacher_id !== currentUser.id) {
      const t = teachersById[q.teacher_id]
      const ownerLabel = t
        ? (t.full_name || t.email || 'Ukjend lærar')
        : 'Ukjend lærar'
      ownerLine = `<div class="quiz-owner">👤 ${escHtml(ownerLabel)}</div>`
    }

    card.innerHTML = `
      <div class="quiz-card-top">
        <div class="quiz-emoji">${escHtml(q.emoji || '🎯')}</div>
        <span class="quiz-badge ${badgeClass}">${badgeLabel}</span>
      </div>
      <div>
        <div class="quiz-name">${escHtml(q.name)}</div>
        <div class="quiz-meta">Oppretta ${date}</div>
        ${ownerLine}
      </div>
      <div class="quiz-card-footer">
        <div class="quiz-stats">
          <div class="quiz-stat">📝 ${q.question_count || 0} spørsmål</div>
          <div class="quiz-stat">👥 ${q.session_count  || 0} økter</div>
        </div>
        <div class="quiz-card-actions">
          <button class="btn-qr"
            data-quiz-id="${q.id}"
            data-quiz-name="${nameEsc}"
            data-quiz-emoji="${emojiEsc}"
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
      openQrModal(b.dataset.quizId, b.dataset.quizName, b.dataset.quizEmoji)
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
  document.getElementById('statDraft').textContent  = list.filter(q => !q.status || q.status === 'draft').length
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
function openQrModal(quizId, quizName, emoji) {
  activeQrQuizId = quizId

  document.getElementById('qrModalTitle').textContent = (emoji || '🎯') + ' ' + quizName

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
    // Spørsmål og sesjonar har ON DELETE CASCADE, så desse vert rydda opp automatisk.
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
  } catch (err) {
    console.error(err)
    showToast('❌ Kunne ikkje opprette quiz')
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
