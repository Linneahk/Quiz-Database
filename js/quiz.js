const SUPABASE_URL = 'https://owgldsfxpmzpkipgeksr.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im93Z2xkc2Z4cG16cGtpcGdla3NyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY4MDM2NTYsImV4cCI6MjA5MjM3OTY1Nn0.bD5dNHcQfjjq29DprTnVafxuZeCvt30zu0qQItq6AXY'
const { createClient } = supabase
const db = createClient(SUPABASE_URL, SUPABASE_KEY)

const params   = new URLSearchParams(location.search)
const quizId   = params.get('id')
const BASE_URL = `${location.origin}${location.pathname.replace('quiz.html','question.html')}`

let currentUser    = null
let questions      = []
let localIdCounter = 0

// ── INIT ──
async function init() {
  const { data } = await db.auth.getSession()
  if (!data.session) { window.location.href = 'index.html'; return }
  currentUser = data.session.user

  document.getElementById('userEmail').textContent = currentUser.email.split('@')[0]
  document.getElementById('userInitial').textContent = currentUser.email[0].toUpperCase()

  if (!quizId) {
    document.getElementById('quizTitle').innerHTML = 'Ugyldig <span>quiz</span>'
    return
  }

  const { data: quiz } = await db.from('quizzes').select('*').eq('id', quizId).single()
  if (quiz) {
    document.getElementById('quizTitle').innerHTML = `${quiz.emoji || ''} <span>${quiz.name}</span>`
  }

  const { data: qs } = await db
    .from('questions')
    .select('*')
    .eq('major_id', quizId)
    .order('order', { ascending: true })

  if (qs && qs.length > 0) {
    questions = qs.map(q => ({
      ...q,
      options: Array.isArray(q.options) ? q.options : JSON.parse(q.options || '[]'),
      _localId: ++localIdCounter,
      _saved: true
    }))
    renderList()
  }
}

// ── ADD QUESTION ──
function addQuestion() {
  const q = {
    _localId: ++localIdCounter,
    question_text: '',
    options: ['', '', '', ''],
    answer: '',
    points: 10,
    emoji: '',
    image_url: '',
    _saved: false
  }
  questions.push(q)
  renderList()
  setTimeout(() => {
    const el = document.querySelector(`[data-lid="${q._localId}"]`)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
      toggleItem(el, true)
    }
  }, 50)
}

// ── RENDER LIST ──
function renderList() {
  const list = document.getElementById('qList')

  if (questions.length === 0) {
    list.innerHTML = `
      <div class="empty-qs">
        <div class="empty-icon">📝</div>
        <div class="empty-title">Ingen spørsmål enno</div>
        <div class="empty-desc">Trykk «Nytt spørsmål» for å kome i gang.</div>
      </div>`
    return
  }

  list.innerHTML = ''
  questions.forEach((q, idx) => {
    const item = document.createElement('div')
    item.className = 'q-item'
    item.dataset.lid = q._localId

    const preview = (q.question_text || '').trim() || 'Nytt spørsmål…'
    const previewCls = (q.question_text || '').trim() ? '' : 'empty'

    item.innerHTML = `
      <div class="q-item-header" onclick="toggleItem(this.closest('.q-item'))">
        <div class="q-item-left">
          <div class="q-num">${idx + 1}</div>
          <div class="q-preview ${previewCls}">${esc(preview)}</div>
        </div>
        <div class="q-item-right">
          ${q._saved ? '<span class="q-saved-badge">✓ Lagra</span>' : ''}
          <button class="btn-delete" onclick="deleteQuestion(event, ${q._localId})" title="Slett">✕</button>
          <span class="chevron">▼</span>
        </div>
      </div>
      <div class="q-body">
        <div class="form-row full">
          <div>
            <label class="field-label">Spørsmål</label>
            <input class="field-input" type="text" placeholder="Skriv spørsmålet her…"
              value="${esc(q.question_text || '')}"
              oninput="updateField(${q._localId}, 'question_text', this.value)" />
          </div>
        </div>

        <div class="form-row">
          <div>
            <label class="field-label">Emoji (valfritt)</label>
            <input class="field-input" type="text" placeholder="t.d. 🗺️"
              value="${esc(q.emoji || '')}"
              oninput="updateField(${q._localId}, 'emoji', this.value)" />
          </div>
          <div>
            <label class="field-label">Poeng</label>
            <input class="points-input field-input" type="number" min="1" max="100"
              value="${q.points || 10}"
              oninput="updateField(${q._localId}, 'points', parseInt(this.value)||10)" />
          </div>
        </div>

        <div class="form-row full">
          <div>
            <label class="field-label">Bilete-URL (valfritt)</label>
            <input class="field-input" type="url" placeholder="https://example.com/bilete.jpg"
              value="${esc(q.image_url || '')}"
              oninput="updateField(${q._localId}, 'image_url', this.value)" />
          </div>
        </div>

        <div class="options-grid">
          ${['A','B','C','D'].map((letter, i) => `
            <div class="opt-field">
              <span class="opt-label-letter">${letter}</span>
              <input class="opt-input" type="text" placeholder="Alternativ ${letter}"
                value="${esc(q.options[i] || '')}"
                oninput="updateOption(${q._localId}, ${i}, this.value)" />
            </div>
          `).join('')}
        </div>

        <div class="correct-row">
          <label class="field-label" style="margin:0">Riktig svar:</label>
          <select class="correct-select" onchange="updateField(${q._localId}, 'answer', this.value)">
            <option value="">– vel riktig svar –</option>
            ${['A','B','C','D'].map((letter, i) => `
              <option value="${esc(q.options[i] || '')}" ${q.answer === q.options[i] ? 'selected' : ''}>
                ${letter}: ${q.options[i] || '(tomt)'}
              </option>
            `).join('')}
          </select>
        </div>

        <button class="btn-save-q" onclick="saveQuestion(${q._localId})">
          Lagre spørsmål
        </button>

        ${q._saved && q.id ? qrPreviewHtml(q) : ''}
      </div>`

    list.appendChild(item)
  })
}

function qrPreviewHtml(q) {
  return `
    <div class="qr-preview" id="qrprev-${q._localId}">
      <div id="qrcode-${q._localId}"></div>
      <div class="qr-info">
        <strong>QR-kode klar! 🎉</strong>
        Skriv ut og heng opp denne lappen.<br>
        Elevar skannar og kjem rett til spørsmålet.
      </div>
    </div>`
}

// ── TOGGLE ──
function toggleItem(el, forceOpen) {
  if (forceOpen) el.classList.add('open')
  else el.classList.toggle('open')

  const lid = parseInt(el.dataset.lid)
  const q   = questions.find(x => x._localId === lid)
  if (q && q._saved && q.id) generateQR(q)
}

// ── UPDATE FIELDS ──
function updateField(lid, field, value) {
  const q = questions.find(x => x._localId === lid)
  if (!q) return
  q[field] = value
  q._saved = false

  if (field === 'question_text') {
    const item = document.querySelector(`[data-lid="${lid}"]`)
    if (item) {
      const preview = item.querySelector('.q-preview')
      preview.textContent = value.trim() || 'Nytt spørsmål…'
      preview.className = 'q-preview' + (value.trim() ? '' : ' empty')
    }
  }
  if (field !== 'answer') refreshCorrectSelect(lid)
}

function updateOption(lid, idx, value) {
  const q = questions.find(x => x._localId === lid)
  if (!q) return
  q.options[idx] = value
  q._saved = false
  refreshCorrectSelect(lid)
}

function refreshCorrectSelect(lid) {
  const q    = questions.find(x => x._localId === lid)
  const item = document.querySelector(`[data-lid="${lid}"]`)
  if (!q || !item) return
  const sel = item.querySelector('.correct-select')
  if (!sel) return
  sel.innerHTML = `<option value="">– vel riktig svar –</option>` +
    ['A','B','C','D'].map((letter, i) => `
      <option value="${esc(q.options[i]||'')}" ${q.answer === q.options[i] ? 'selected':''}>
        ${letter}: ${q.options[i] || '(tomt)'}
      </option>`).join('')
}

// ── SAVE QUESTION ──
async function saveQuestion(lid) {
  const q = questions.find(x => x._localId === lid)
  if (!q) return

  if (!(q.question_text || '').trim()) return showToast('⚠️ Skriv inn spørsmålet')
  if (q.options.some(o => !o.trim())) return showToast('⚠️ Fyll inn alle 4 alternativ')
  if (!q.answer) return showToast('⚠️ Vel riktig svar')

  const item = document.querySelector(`[data-lid="${lid}"]`)
  const btn  = item.querySelector('.btn-save-q')
  btn.disabled = true
  btn.innerHTML = '<span class="spinner-sm"></span>Lagrar…'

  const payload = {
    major_id:      quizId,
    created_by:    currentUser.id,
    question_text: q.question_text.trim(),
    options:       q.options,
    answer:        q.answer,
    points:        q.points || 10,
    emoji:         q.emoji || null,
    image_url:     q.image_url || null,
    is_active:     true,
    "order":       questions.indexOf(q),
    updated_at:    new Date().toISOString()
  }

  let saved
  if (q.id) {
    const { data, error } = await db.from('questions').update(payload).eq('id', q.id).select().single()
    if (error) { showToast('❌ Noko gjekk gale: ' + error.message); btn.disabled = false; btn.textContent = 'Lagre spørsmål'; return }
    saved = data
  } else {
    const { data, error } = await db.from('questions').insert(payload).select().single()
    if (error) { showToast('❌ Noko gjekk gale: ' + error.message); btn.disabled = false; btn.textContent = 'Lagre spørsmål'; return }
    saved = data

    await db.from('quizzes').update({
      question_count: questions.filter(x => x.id || x._localId === lid).length
    }).eq('id', quizId)
  }

  q.id     = saved.id
  q._saved = true

  btn.disabled = false
  btn.textContent = 'Lagre spørsmål'

  if (!item.querySelector('.qr-preview')) {
    const div = document.createElement('div')
    div.innerHTML = qrPreviewHtml(q)
    item.querySelector('.q-body').appendChild(div.firstElementChild)
  }
  generateQR(q)

  const badge = item.querySelector('.q-saved-badge')
  if (!badge) {
    const right = item.querySelector('.q-item-right')
    const span  = document.createElement('span')
    span.className = 'q-saved-badge'
    span.textContent = '✓ Lagra'
    right.insertBefore(span, right.firstChild)
  }

  showToast('✅ Spørsmål lagra!')
}

// ── DELETE ──
async function deleteQuestion(e, lid) {
  e.stopPropagation()
  if (!confirm('Slett dette spørsmålet?')) return

  const q   = questions.find(x => x._localId === lid)
  const idx = questions.indexOf(q)

  if (q && q.id) {
    await db.from('questions').delete().eq('id', q.id)
  }

  questions.splice(idx, 1)
  renderList()
  showToast('🗑️ Spørsmål sletta')
}

// ── QR CODE ──
function generateQR(q) {
  const container = document.getElementById(`qrcode-${q._localId}`)
  if (!container) return
  container.innerHTML = ''
  new QRCode(container, {
    text:         `${BASE_URL}?id=${q.id}`,
    width:        100,
    height:       100,
    colorDark:    '#111118',
    colorLight:   '#ffffff',
    correctLevel: QRCode.CorrectLevel.M
  })
}

// ── PRINT ──
function printQR() {
  const saved = questions.filter(q => q._saved && q.id)
  if (saved.length === 0) return showToast('⚠️ Lagre minst eitt spørsmål fyrst')

  const printArea = document.getElementById('printArea')
  printArea.style.display = 'block'
  printArea.innerHTML = `
    <div class="print-grid">
      ${saved.map((q, i) => `
        <div class="print-card">
          <div class="print-card-num">Spørsmål ${i + 1} ${q.emoji || ''}</div>
          <div class="print-card-q">${q.question_text}</div>
          <div class="print-card-qr" id="print-qr-${q.id}"></div>
          <div class="print-card-hint">Skann QR-koden for å svare</div>
        </div>
      `).join('')}
    </div>`

  saved.forEach(q => {
    new QRCode(document.getElementById(`print-qr-${q.id}`), {
      text:         `${BASE_URL}?id=${q.id}`,
      width:        120,
      height:       120,
      colorDark:    '#000000',
      colorLight:   '#ffffff',
      correctLevel: QRCode.CorrectLevel.M
    })
  })

  setTimeout(() => { window.print(); printArea.style.display = 'none' }, 400)
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

// ── ESCAPE HTML ──
function esc(str) {
  return String(str).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/'/g,'&#39;').replace(/</g,'&lt;')
}

init()