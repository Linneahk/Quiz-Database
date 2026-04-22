// ── Tab-bytte ──
function switchTab(e, tab) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'))
  e.target.classList.add('active')
  document.getElementById('loginForm').style.display    = tab === 'login'    ? 'block' : 'none'
  document.getElementById('registerForm').style.display = tab === 'register' ? 'block' : 'none'
  clearMsg()
}

// ── Meldingar ──
function showMsg(text, type) {
  const el = document.getElementById('msg')
  el.textContent = text
  el.className = 'msg ' + type
}

function clearMsg() {
  const el = document.getElementById('msg')
  el.className = 'msg'
  el.textContent = ''
}

// ── Loading-tilstand ──
function setLoading(btnId, loading) {
  const btn = document.getElementById(btnId)
  btn.disabled = loading
  btn.innerHTML = loading
    ? '<span class="spinner"></span>Ventar...'
    : btnId === 'loginBtn' ? 'Logg inn' : 'Opprett konto'
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

// ── REGISTRER ──
async function register() {
  const name      = document.getElementById('regName').value.trim()
  const email     = document.getElementById('regEmail').value.trim()
  const password  = document.getElementById('regPassword').value
  const password2 = document.getElementById('regPassword2').value

  if (!name || !email || !password)
    return showMsg('Fyll inn alle felt.', 'error')
  if (password.length < 6)
    return showMsg('Passord må vere minst 6 teikn.', 'error')
  if (password !== password2)
    return showMsg('Passorda er ikkje like.', 'error')

  setLoading('registerBtn', true)
  clearMsg()

  const { data, error } = await db.auth.signUp({ email, password })

  if (error) {
    setLoading('registerBtn', false)
    return showMsg(error.message, 'error')
  }

  const userId = data.user?.id
  if (userId) {
    await db.from('teachers').insert({
      id:         userId,
      full_name:  name,
      email:      email,
      created_at: new Date().toISOString()
    })
  }

  setLoading('registerBtn', false)
  showMsg('✅ Konto oppretta! Sjekk e-posten din for å bekrefte.', 'success')
}

// ── GLØYMT PASSORD ──
async function forgotPassword() {
  const email = document.getElementById('loginEmail').value.trim()
  if (!email) return showMsg('Skriv inn e-postadressa di fyrst.', 'error')

  const { error } = await db.auth.resetPasswordForEmail(email)
  if (error) {
    showMsg('Noko gjekk gale. Prøv igjen.', 'error')
  } else {
    showMsg('✅ Tilbakestillingslenke sendt til ' + email, 'success')
  }
}

// ── Allereie innlogga? ──
db.auth.getSession().then(({ data }) => {
  if (data.session) window.location.href = 'dashboard.html'
})

// ── Enter-tast ──
document.addEventListener('keydown', e => {
  if (e.key !== 'Enter') return
  const loginVisible = document.getElementById('loginForm').style.display !== 'none'
  if (loginVisible) login()
  else register()
})