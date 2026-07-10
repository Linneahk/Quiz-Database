import { supabase as db } from './supabaseClient.js'

// ── GJØR FUNKSJONENE TILGJENGELIGE FOR HTML ──
window.login = login;
window.forgotPassword = forgotPassword;

// ── Meldingar ──
function showMsg(text, type) {
  const el = document.getElementById('msg')
  if (!el) return
  el.textContent = text
  el.className = 'msg ' + type
}

function clearMsg() {
  const el = document.getElementById('msg')
  if (!el) return
  el.className = 'msg'
  el.textContent = ''
}

// ── Loading-tilstand ──
function setLoading(btnId, loading) {
  const btn = document.getElementById(btnId)
  if (!btn) return
  btn.disabled = loading
  btn.innerHTML = loading
    ? '<span class="spinner"></span>Ventar...'
    : 'Logg inn'
}

// ── LOGIN ──
async function login() {
  const email    = document.getElementById('loginEmail').value.trim()
  const password = document.getElementById('loginPassword').value

  if (!email || !password) return showMsg('Fyll inn e-post og passord.', 'error')

  setLoading('loginBtn', true)
  clearMsg()

  const { error } = await db.auth.signInWithPassword({ email, password })

  setLoading('loginBtn', false)

  if (error) {
    showMsg('Feil e-post eller passord.', 'error')
  } else {
    showMsg('Loggar inn...', 'success')
    setTimeout(() => { window.location.href = 'dashboard.html' }, 800)
  }
}

// ── GLØYMT PASSORD ──
async function forgotPassword() {
  const email = document.getElementById('loginEmail').value.trim()
  if (!email) return showMsg('Skriv inn e-postadressa di fyrst i feltet over.', 'error')

  const { error } = await db.auth.resetPasswordForEmail(email)
  if (error) {
    showMsg('Noko gjekk gale. Prøv igjen.', 'error')
  } else {
    showMsg('✅ Tilbakestillingslenke sendt til ' + email, 'success')
  }
}

// ── Allereie innlogga? ──
db.auth.getSession().then(({ data }) => {
  if (data.session) {
    window.location.href = 'dashboard.html'   // allereie innlogga → hopp rett til dashboard (skjema aldri vist)
  } else {
    document.body.classList.add('app-ready')  // ikkje innlogga → vis login-skjemaet
  }
})

// ── Enter-tast ──
document.addEventListener('keydown', e => {
  if (e.key === 'Enter') login()
})
