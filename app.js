// ============================================================
//  CONFIGURAÇÃO — preencha com seus dados do Supabase
// ============================================================
const SUPABASE_URL = 'https://hsxvstbhvrkaevlgtens._sb.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhzeHZzdGJodnJrYWV2bGd0ZW5zIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg4MzgxMDAsImV4cCI6MjA5NDQxNDEwMH0.v1x8z5_TFFPSBm2P2nOLcIYpTa13TI9jsJmhPTqOBew';
const RESEND_API_KEY = 'COLE_SUA_CHAVE_RESEND_AQUI';
// ============================================================

const _sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const _sb = _sb; // alias para compatibilidade

// ====== CONSTANTES ======

const MONTHLY_INCOME = 38420.50;
const SAVINGS_GOAL_PCT = 0.10;
const SAVINGS_GOAL_ABS = MONTHLY_INCOME * SAVINGS_GOAL_PCT; // R$ 3.842,05

const CATEGORIES = [
  'Moradia', 'Alimentação', 'Restaurantes', 'Transporte',
  'Saúde', 'Educação', 'Assinaturas', 'Lazer',
  'Casa', 'Investimentos', 'Receita', 'Outros'
];

const CATEGORY_ICONS = {
  'Moradia': '🏠', 'Alimentação': '🛒', 'Restaurantes': '🍽️',
  'Transporte': '🚗', 'Saúde': '💊', 'Educação': '📚',
  'Assinaturas': '📱', 'Lazer': '🎭', 'Casa': '🏡',
  'Investimentos': '📈', 'Receita': '💰', 'Outros': '📦'
};

const CATEGORY_COLORS = [
  '#2563EB','#16A34A','#D97706','#DC2626','#7C3AED','#0891B2',
  '#BE185D','#065F46','#92400E','#1D4ED8','#15803D','#6B7280'
];

const DEFAULT_RULES = [
  { patterns: ['CONDOMINIO'], category: 'Moradia' },
  { patterns: ['FINANCIAMENTO IMOB', 'FINANCIAMENTO'], category: 'Moradia' },
  { patterns: ['PAO DE ACUCAR', 'CARREFOUR', 'PADARIA', 'BELLA PAULISTA'], category: 'Alimentação' },
  { patterns: ['IFOOD', 'RESTAURANTE', 'FASANO', 'MOCOTO', 'MANI', 'OUTBACK', 'FIGUEIRA', 'TORDESILHAS', 'DOM '], category: 'Restaurantes' },
  { patterns: ['UBER', '99APP', 'POSTO SHELL', 'POSTO IPIRANGA', 'POSTO '], category: 'Transporte' },
  { patterns: ['BRADESCO SAUDE', 'SAUDE FAMILIAR', 'DROGASIL'], category: 'Saúde' },
  { patterns: ['ESCOLA BILINGUE', 'ESCOLA'], category: 'Educação' },
  { patterns: ['NETFLIX', 'SPOTIFY', 'DISNEY', 'HBO MAX', 'GLOBOPLAY', 'CLARO NET', 'VIVO CELULAR', 'SMART FIT', 'DISNEYPLUS'], category: 'Assinaturas' },
  { patterns: ['CINEMARK', 'SEPHORA', 'MAGAZINE LUIZA', 'CENTAURO', 'FLORICULTURA'], category: 'Lazer' },
  { patterns: ['AMAZON', 'DIARISTA', 'CLEUSA'], category: 'Casa' },
  { patterns: ['XP INVESTIMENTOS', 'TESOURO DIRETO'], category: 'Investimentos' },
  { patterns: ['CREDITO SALARIO', 'CREDITO PLR', 'PIX RECEBIDO', 'SALARIO'], category: 'Receita' },
];

// ====== STATE ======

let currentUser = null;
let pendingTransactions = [];
let allTransactions = [];
let dashChart = null;
let userGoal = null;
let userCategoryRules = [];
let userBudgets = {};

// ====== UTILS ======

function fmtBRL(value) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

function fmtMonthYear(monthYear) {
  const [y, m] = monthYear.split('-');
  const months = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  return `${months[parseInt(m) - 1]}/${y}`;
}

function parseAmount(str) {
  return parseFloat(str.replace(/\./g, '').replace(',', '.'));
}

function formatDate(ddmmyyyy) {
  const [d, m, y] = ddmmyyyy.split('/');
  return `${y}-${m}-${d}`;
}

function getMonthYear(dateStr) {
  return dateStr.substring(0, 7);
}

function categorize(description, userRules) {
  const desc = description.toUpperCase();
  for (const rule of (userRules || [])) {
    if (desc.includes(rule.description_pattern.toUpperCase())) return rule.category_name;
  }
  for (const rule of DEFAULT_RULES) {
    if (rule.patterns.some(p => desc.includes(p.toUpperCase()))) return rule.category;
  }
  return 'Outros';
}

function showAlert(id, message, type = 'error') {
  const el = document.getElementById(id);
  el.textContent = message;
  el.className = `alert alert-${type}`;
  el.classList.remove('hidden');
}

function hideAlert(id) {
  document.getElementById(id).classList.add('hidden');
}

// ====== NAVIGATION ======

function showView(name) {
  document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));
  document.getElementById(`view-${name}`)?.classList.remove('hidden');
  document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
  document.getElementById(`nav-${name}`)?.classList.add('active');

  if (name === 'dashboard') loadDashboard();
  if (name === 'transactions') loadTransactions();
  if (name === 'limits') loadLimitsView();
  if (name === 'goal') loadGoalView();
}

// ====== AUTH ======

function switchTab(tab) {
  document.querySelectorAll('.tab').forEach((t, i) => {
    t.classList.toggle('active', (i === 0 && tab === 'login') || (i === 1 && tab === 'register'));
  });
  document.getElementById('form-login').classList.toggle('hidden', tab !== 'login');
  document.getElementById('form-register').classList.toggle('hidden', tab !== 'register');
  hideAlert('auth-error');
}

async function handleLogin(e) {
  e.preventDefault();
  const btn = document.getElementById('btn-login');
  btn.disabled = true;
  btn.textContent = 'Entrando...';
  hideAlert('auth-error');

  const email = document.getElementById('login-email').value;
  const password = document.getElementById('login-password').value;

  const { error } = await _sb.auth.signInWithPassword({ email, password });
  if (error) {
    showAlert('auth-error', 'E-mail ou senha incorretos.');
    btn.disabled = false;
    btn.textContent = 'Entrar';
  }
}

async function handleRegister(e) {
  e.preventDefault();
  const btn = document.getElementById('btn-register');
  btn.disabled = true;
  btn.textContent = 'Criando conta...';
  hideAlert('auth-error');

  const email = document.getElementById('reg-email').value;
  const password = document.getElementById('reg-password').value;

  const { error } = await _sb.auth.signUp({ email, password });
  if (error) {
    showAlert('auth-error', error.message);
    btn.disabled = false;
    btn.textContent = 'Criar conta';
  } else {
    showAlert('auth-error', 'Conta criada! Verifique seu e-mail para confirmar.', 'success');
    btn.disabled = false;
    btn.textContent = 'Criar conta';
  }
}

async function handleLogout() {
  await _sb.auth.signOut();
}

_sb.auth.onAuthStateChange((event, session) => {
  currentUser = session?.user ?? null;
  if (currentUser) {
    document.getElementById('view-auth').classList.add('hidden');
    document.getElementById('app-shell').classList.remove('hidden');
    Promise.all([loadUserRules(), loadBudgets()]).then(() => loadDashboard());
    loadGoalData();
  } else {
    document.getElementById('view-auth').classList.remove('hidden');
    document.getElementById('app-shell').classList.add('hidden');
  }
});

// ====== USER CATEGORY RULES ======

async function loadUserRules() {
  const { data } = await _sb
    .from('category_rules')
    .select('*')
    .eq('user_id', currentUser.id);
  userCategoryRules = data || [];
}

async function saveUserRule(pattern, category) {
  const existing = userCategoryRules.find(r => r.description_pattern === pattern);
  if (existing) {
    await _sb.from('category_rules')
      .update({ category_name: category })
      .eq('id', existing.id);
    existing.category_name = category;
  } else {
    const { data } = await _sb.from('category_rules').insert({
      user_id: currentUser.id,
      description_pattern: pattern,
      category_name: category
    }).select().single();
    if (data) userCategoryRules.push(data);
  }
}

// ====== MONTH SELECTORS ======

async function populateMonthSelects() {
  const { data } = await _sb
    .from('transactions')
    .select('month_year')
    .eq('user_id', currentUser.id)
    .order('month_year', { ascending: false });

  const months = [...new Set((data || []).map(r => r.month_year))];

  ['dash-month-select', 'tx-month-select'].forEach(id => {
    const sel = document.getElementById(id);
    sel.innerHTML = months.map(m =>
      `<option value="${m}">${fmtMonthYear(m)}</option>`
    ).join('') || '<option value="">Sem dados</option>';
  });
}

// ====== CSV UPLOAD ======

const uploadZone = document.getElementById('upload-zone');
uploadZone.addEventListener('dragover', e => { e.preventDefault(); uploadZone.classList.add('drag-over'); });
uploadZone.addEventListener('dragleave', () => uploadZone.classList.remove('drag-over'));
uploadZone.addEventListener('drop', e => {
  e.preventDefault();
  uploadZone.classList.remove('drag-over');
  const file = e.dataTransfer.files[0];
  if (file) processFile(file);
});

function handleFileSelect(e) {
  const file = e.target.files[0];
  if (file) processFile(file);
}

function processFile(file) {
  if (!file.name.endsWith('.csv')) {
    alert('Por favor selecione um arquivo .csv');
    return;
  }
  const reader = new FileReader();
  reader.onload = e => parseCSV(e.target.result, file.name);
  reader.readAsText(file, 'latin1');
}

function parseCSV(text, filename) {
  const lines = text.trim().split('\n').filter(l => l.trim());
  if (lines.length < 2) { alert('Arquivo vazio ou inválido.'); return; }

  const header = lines[0].split(';').map(h => h.trim().toLowerCase());
  const dateIdx = header.findIndex(h => h.includes('data'));
  const descIdx = header.findIndex(h => h.includes('desc') || h.includes('historico') || h.includes('lancamento'));
  const valIdx  = header.findIndex(h => h.includes('valor') || h.includes('quantia'));

  if (dateIdx < 0 || valIdx < 0) {
    alert('Formato não reconhecido. O arquivo precisa ter colunas: Data, Descricao, Valor');
    return;
  }
  const dIdx = descIdx >= 0 ? descIdx : 1;

  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(';');
    if (cols.length < 3) continue;
    const dateRaw = cols[dateIdx]?.trim();
    const desc    = cols[dIdx]?.trim() || '';
    const valRaw  = cols[valIdx]?.trim();
    if (!dateRaw || !valRaw) continue;

    const dateISO = formatDate(dateRaw);
    if (!dateISO || isNaN(Date.parse(dateISO))) continue;

    const amount = parseAmount(valRaw);
    if (isNaN(amount)) continue;

    rows.push({
      date: dateISO,
      description: desc,
      amount,
      category: categorize(desc, userCategoryRules),
      month_year: getMonthYear(dateISO),
    });
  }

  if (rows.length === 0) { alert('Nenhum lançamento válido encontrado.'); return; }

  pendingTransactions = rows;
  showPreview(rows, filename);
}

function showPreview(rows, filename) {
  document.getElementById('upload-zone').classList.add('hidden');
  document.getElementById('upload-preview').classList.remove('hidden');
  document.getElementById('upload-success').classList.add('hidden');

  document.getElementById('upload-preview-title').textContent = filename;
  document.getElementById('upload-count').textContent = `${rows.length} lançamentos`;

  const tbody = document.getElementById('preview-body');
  tbody.innerHTML = rows.slice(0, 50).map(r => `
    <tr>
      <td>${r.date.split('-').reverse().join('/')}</td>
      <td style="max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${r.description}</td>
      <td class="${r.amount < 0 ? 'amount-neg' : 'amount-pos'}">${fmtBRL(r.amount)}</td>
      <td>${r.category}</td>
    </tr>
  `).join('');

  if (rows.length > 50) {
    tbody.innerHTML += `<tr><td colspan="4" style="text-align:center;color:#94A3B8;font-size:12px">... e mais ${rows.length - 50} lançamentos</td></tr>`;
  }
}

function cancelUpload() {
  pendingTransactions = [];
  document.getElementById('upload-zone').classList.remove('hidden');
  document.getElementById('upload-preview').classList.add('hidden');
  document.getElementById('file-input').value = '';
}

async function confirmImport() {
  if (!pendingTransactions.length) return;

  const btn = document.getElementById('btn-import');
  btn.disabled = true;
  btn.textContent = 'Importando...';

  const monthYear = pendingTransactions[0].month_year;

  // Remove existing for same month to allow re-import
  await _sb.from('transactions')
    .delete()
    .eq('user_id', currentUser.id)
    .eq('month_year', monthYear);

  const toInsert = pendingTransactions.map(r => ({
    user_id: currentUser.id,
    date: r.date,
    description: r.description,
    amount: r.amount,
    category: r.category,
    month_year: r.month_year,
  }));

  const { error } = await _sb.from('transactions').insert(toInsert);

  btn.disabled = false;
  btn.textContent = 'Importar tudo';

  if (error) {
    showAlert('upload-alert', 'Erro ao importar: ' + error.message, 'error');
    document.getElementById('upload-alert').classList.remove('hidden');
    return;
  }

  document.getElementById('upload-preview').classList.add('hidden');
  document.getElementById('upload-success').classList.remove('hidden');
  document.getElementById('upload-success-msg').textContent =
    `${pendingTransactions.length} lançamentos de ${fmtMonthYear(monthYear)} foram salvos com sucesso!`;

  pendingTransactions = [];
  document.getElementById('file-input').value = '';
  await populateMonthSelects();
}

// ====== DASHBOARD ======

async function loadDashboard() {
  await populateMonthSelects();

  const monthYear = document.getElementById('dash-month-select').value;
  if (!monthYear) return;

  const { data } = await _sb
    .from('transactions')
    .select('*')
    .eq('user_id', currentUser.id)
    .eq('month_year', monthYear)
    .order('date');

  const txs = data || [];

  checkBudgetAlerts(txs, monthYear);

  const income    = txs.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0);
  const invested  = txs.filter(t => t.category === 'Investimentos').reduce((s, t) => s + Math.abs(t.amount), 0);
  const expenses  = txs.filter(t => t.amount < 0 && t.category !== 'Investimentos').reduce((s, t) => s + Math.abs(t.amount), 0);
  const saved     = invested + Math.max(0, income - expenses - invested);
  const pct       = income > 0 ? (saved / income) * 100 : 0;
  const goalPct   = Math.min(100, (saved / SAVINGS_GOAL_ABS) * 100);

  document.getElementById('dash-income').textContent   = fmtBRL(income);
  document.getElementById('dash-expenses').textContent = fmtBRL(expenses);
  document.getElementById('dash-saved').textContent    = fmtBRL(saved);
  document.getElementById('dash-pct').textContent      = `${pct.toFixed(1)}%`;

  const bar    = document.getElementById('dash-progress-bar');
  const label  = document.getElementById('dash-goal-label');
  const text   = document.getElementById('dash-progress-text');
  const target = document.getElementById('dash-goal-target');
  const alert  = document.getElementById('saving-alert');

  bar.style.width = `${goalPct}%`;
  bar.className = 'progress-bar-fill' + (goalPct >= 100 ? ' green' : '');
  text.textContent = `Poupado: ${fmtBRL(saved)}`;
  target.textContent = `Meta: ${fmtBRL(SAVINGS_GOAL_ABS)}`;

  if (pct >= 10) {
    label.textContent = '✅ Meta atingida!';
    label.className = 'badge badge-green';
    alert.className = 'saving-alert alert-success';
    alert.textContent = `Você poupou ${pct.toFixed(1)}% da renda em ${fmtMonthYear(monthYear)}. Ótimo trabalho!`;
    alert.classList.remove('hidden');
  } else {
    const falta = SAVINGS_GOAL_ABS - saved;
    label.textContent = `${pct.toFixed(1)}% de 10%`;
    label.className = 'badge badge-orange';
    alert.className = 'saving-alert alert-warning';
    alert.textContent = `Faltam ${fmtBRL(falta)} para atingir a meta de 10% este mês.`;
    alert.classList.remove('hidden');
  }

  // Chart
  const catMap = {};
  txs.filter(t => t.amount < 0 && t.category !== 'Receita').forEach(t => {
    catMap[t.category] = (catMap[t.category] || 0) + Math.abs(t.amount);
  });
  const sorted = Object.entries(catMap).sort((a, b) => b[1] - a[1]);
  renderChart(sorted);

  // Top expenses
  const topEl = document.getElementById('dash-top-expenses');
  const top10 = txs.filter(t => t.amount < 0 && t.category !== 'Receita')
    .sort((a, b) => a.amount - b.amount).slice(0, 10);

  if (top10.length === 0) {
    topEl.innerHTML = '<p class="empty-state">Nenhum dado ainda.</p>';
  } else {
    topEl.innerHTML = top10.map(t => `
      <div class="top-item">
        <span class="top-item-desc">${CATEGORY_ICONS[t.category] || '📦'} ${t.description}</span>
        <span class="top-item-value">${fmtBRL(t.amount)}</span>
      </div>
    `).join('');
  }
}

function renderChart(sorted) {
  const labels = sorted.map(([k]) => k);
  const values = sorted.map(([, v]) => v);
  const colors = labels.map((_, i) => CATEGORY_COLORS[i % CATEGORY_COLORS.length]);

  if (dashChart) dashChart.destroy();

  const ctx = document.getElementById('dash-chart').getContext('2d');
  dashChart = new Chart(ctx, {
    type: 'doughnut',
    data: { labels, datasets: [{ data: values, backgroundColor: colors, borderWidth: 2, borderColor: '#fff' }] },
    options: {
      responsive: true,
      cutout: '65%',
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => `${ctx.label}: ${fmtBRL(ctx.raw)}`
          }
        }
      }
    }
  });

  const total = values.reduce((s, v) => s + v, 0);
  document.getElementById('dash-legend').innerHTML = sorted.map(([cat, val], i) => `
    <div class="legend-item">
      <span class="legend-dot" style="background:${colors[i]}"></span>
      <span>${CATEGORY_ICONS[cat] || ''} ${cat} (${((val/total)*100).toFixed(0)}%)</span>
    </div>
  `).join('');
}

// ====== TRANSACTIONS ======

async function loadTransactions() {
  await populateMonthSelects();

  const monthYear = document.getElementById('tx-month-select').value;
  if (!monthYear) return;

  const { data } = await _sb
    .from('transactions')
    .select('*')
    .eq('user_id', currentUser.id)
    .eq('month_year', monthYear)
    .order('date', { ascending: false });

  allTransactions = data || [];

  // Populate category filter
  const cats = [...new Set(allTransactions.map(t => t.category))].sort();
  const filter = document.getElementById('tx-cat-filter');
  filter.innerHTML = '<option value="">Todas as categorias</option>' +
    cats.map(c => `<option value="${c}">${CATEGORY_ICONS[c] || ''} ${c}</option>`).join('');

  filterTransactions();
}

function filterTransactions() {
  const cat = document.getElementById('tx-cat-filter').value;
  const filtered = cat ? allTransactions.filter(t => t.category === cat) : allTransactions;

  const total = filtered.reduce((s, t) => s + t.amount, 0);
  document.getElementById('tx-total-label').textContent = `Total: ${fmtBRL(total)}`;

  const list = document.getElementById('tx-list');
  if (filtered.length === 0) {
    list.innerHTML = '<p class="empty-state">Nenhum lançamento. Importe um extrato.</p>';
    return;
  }

  list.innerHTML = filtered.map(t => `
    <div class="tx-item">
      <div class="tx-left">
        <div class="tx-date">${t.date.split('-').reverse().join('/')}</div>
        <div class="tx-desc" title="${t.description}">${t.description}</div>
        <select class="tx-cat-select" onchange="updateCategory('${t.id}', '${t.description}', this.value)">
          ${CATEGORIES.map(c => `<option value="${c}" ${c === t.category ? 'selected' : ''}>${CATEGORY_ICONS[c] || ''} ${c}</option>`).join('')}
        </select>
      </div>
      <div class="tx-right">
        <div class="tx-amount ${t.amount < 0 ? 'neg' : 'pos'}">${fmtBRL(t.amount)}</div>
      </div>
    </div>
  `).join('');
}

async function updateCategory(id, description, category) {
  await _sb.from('transactions').update({ category }).eq('id', id);

  const tx = allTransactions.find(t => t.id === id);
  if (tx) tx.category = category;

  await saveUserRule(description, category);
}

// ====== GOAL ======

async function loadGoalData() {
  const { data } = await _sb
    .from('goals')
    .select('*')
    .eq('user_id', currentUser.id)
    .single();
  userGoal = data;
}

async function saveGoal() {
  const raw = document.getElementById('goal-target-input').value.replace(/\D/g, '');
  const amount = parseFloat(raw);
  if (!amount || amount <= 0) {
    showAlert('goal-save-msg', 'Digite um valor válido.', 'error');
    document.getElementById('goal-save-msg').classList.remove('hidden');
    return;
  }

  if (userGoal) {
    await _sb.from('goals').update({ target_amount: amount }).eq('id', userGoal.id);
    userGoal.target_amount = amount;
  } else {
    const { data } = await _sb.from('goals').insert({
      user_id: currentUser.id,
      target_amount: amount,
      label: 'Independência Financeira'
    }).select().single();
    userGoal = data;
  }

  showAlert('goal-save-msg', 'Meta salva!', 'success');
  document.getElementById('goal-save-msg').classList.remove('hidden');
  setTimeout(() => document.getElementById('goal-save-msg').classList.add('hidden'), 2500);
  loadGoalView();
}

async function loadGoalView() {
  await loadGoalData();

  if (userGoal) {
    document.getElementById('goal-target-input').value = userGoal.target_amount;
    document.getElementById('goal-target-display').textContent = fmtBRL(userGoal.target_amount);
  }

  // Get all investment transactions grouped by month
  const { data } = await _sb
    .from('transactions')
    .select('month_year, amount, category')
    .eq('user_id', currentUser.id)
    .order('month_year', { ascending: true });

  const txs = data || [];

  // Group by month, calculate savings per month
  const monthMap = {};
  txs.forEach(t => {
    if (!monthMap[t.month_year]) {
      monthMap[t.month_year] = { income: 0, expenses: 0, invested: 0 };
    }
    if (t.amount > 0) monthMap[t.month_year].income += t.amount;
    else if (t.category === 'Investimentos') monthMap[t.month_year].invested += Math.abs(t.amount);
    else monthMap[t.month_year].expenses += Math.abs(t.amount);
  });

  const monthSavings = Object.entries(monthMap).map(([m, v]) => ({
    month: m,
    saved: v.invested + Math.max(0, v.income - v.expenses - v.invested)
  }));

  const totalSaved = monthSavings.reduce((s, m) => s + m.saved, 0);
  const target = userGoal?.target_amount || 0;
  const pct = target > 0 ? Math.min(100, (totalSaved / target) * 100) : 0;

  document.getElementById('goal-accumulated').textContent = fmtBRL(totalSaved);
  document.getElementById('goal-pct-label').textContent = `${pct.toFixed(1)}%`;

  const bar = document.getElementById('goal-progress-bar');
  bar.style.width = `${pct}%`;
  bar.className = 'progress-bar-fill' + (pct >= 100 ? ' green' : '');

  // Projection
  const proj = document.getElementById('goal-projection');
  if (monthSavings.length >= 1 && target > 0) {
    const avgMonthly = totalSaved / monthSavings.length;
    const remaining = Math.max(0, target - totalSaved);
    const months = avgMonthly > 0 ? Math.ceil(remaining / avgMonthly) : null;

    if (pct >= 100) {
      proj.textContent = '🎉 Meta atingida! Você alcançou sua independência financeira.';
    } else if (months) {
      const arr = new Date();
      arr.setMonth(arr.getMonth() + months);
      const years = Math.floor(months / 12);
      const remMonths = months % 12;
      const fmtDate = arr.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
      const tempoStr = years > 0
        ? `${years} ano${years > 1 ? 's' : ''}${remMonths > 0 ? ` e ${remMonths} mês${remMonths > 1 ? 'es' : ''}` : ''}`
        : `${months} mês${months > 1 ? 'es' : ''}`;
      proj.textContent = `No ritmo atual (${fmtBRL(avgMonthly)}/mês), você chega à meta em ${tempoStr} — por volta de ${fmtDate}.`;
    } else {
      proj.textContent = 'Continue importando seus extratos para calcular a projeção.';
    }
    proj.classList.remove('hidden');
  } else {
    proj.classList.add('hidden');
  }

  // History
  const hist = document.getElementById('goal-history');
  if (monthSavings.length === 0) {
    hist.innerHTML = '<p class="empty-state">Nenhum dado ainda.</p>';
  } else {
    hist.innerHTML = [...monthSavings].reverse().map(m => `
      <div class="goal-history-item">
        <span class="goal-history-month">${fmtMonthYear(m.month)}</span>
        <span class="goal-history-value">${fmtBRL(m.saved)}</span>
      </div>
    `).join('');
  }
}

// ====== BUDGET LIMITS ======

async function loadBudgets() {
  const { data } = await _sb
    .from('budget_limits')
    .select('*')
    .eq('user_id', currentUser.id);
  userBudgets = {};
  (data || []).forEach(r => { userBudgets[r.category_name] = parseFloat(r.monthly_limit); });
}

async function saveBudget(category, limitStr) {
  const limit = parseFloat(String(limitStr).replace(',', '.'));
  if (isNaN(limit) || limit <= 0) return false;

  const { data: existing } = await _sb
    .from('budget_limits')
    .select('id')
    .eq('user_id', currentUser.id)
    .eq('category_name', category)
    .maybeSingle();

  if (existing) {
    await _sb.from('budget_limits')
      .update({ monthly_limit: limit })
      .eq('id', existing.id);
  } else {
    await _sb.from('budget_limits').insert({
      user_id: currentUser.id,
      category_name: category,
      monthly_limit: limit
    });
  }
  userBudgets[category] = limit;
  return true;
}

async function sendBudgetAlertEmail(overages, monthYear) {
  if (!RESEND_API_KEY || RESEND_API_KEY === 'COLE_SUA_CHAVE_RESEND_AQUI') return;

  const listHtml = overages.map(o =>
    `<li><strong>${o.category}:</strong> gasto ${fmtBRL(o.spent)} / limite ${fmtBRL(o.limit)} (${o.pct.toFixed(0)}%)</li>`
  ).join('');

  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: 'Minhas Finanças <onboarding@resend.dev>',
      to: [currentUser.email],
      subject: `⚠️ Limite ultrapassado — ${fmtMonthYear(monthYear)}`,
      html: `
        <h2 style="color:#DC2626">Alerta de orçamento</h2>
        <p>As categorias abaixo ultrapassaram o limite em <strong>${fmtMonthYear(monthYear)}</strong>:</p>
        <ul style="line-height:1.8">${listHtml}</ul>
        <p style="color:#475569;font-size:13px">Acesse seu painel para ver o detalhe dos gastos.</p>
      `
    })
  }).catch(() => {});
}

function checkBudgetAlerts(txs, monthYear) {
  if (!Object.keys(userBudgets).length) return;

  const alertKey = `budget_alert_${currentUser.id}_${monthYear}`;
  const lastSent = localStorage.getItem(alertKey);
  if (lastSent && (Date.now() - parseInt(lastSent)) < 86400000) return;

  const catSpend = {};
  txs
    .filter(t => t.amount < 0 && t.category !== 'Receita' && t.category !== 'Investimentos')
    .forEach(t => { catSpend[t.category] = (catSpend[t.category] || 0) + Math.abs(t.amount); });

  const overages = Object.entries(userBudgets)
    .filter(([cat, limit]) => catSpend[cat] && catSpend[cat] > limit)
    .map(([cat, limit]) => ({ category: cat, spent: catSpend[cat], limit, pct: (catSpend[cat] / limit) * 100 }));

  if (overages.length > 0) {
    sendBudgetAlertEmail(overages, monthYear);
    localStorage.setItem(alertKey, Date.now().toString());
  }
}

async function loadLimitsView() {
  await loadBudgets();

  const now = new Date();
  const monthYear = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const { data } = await _sb
    .from('transactions')
    .select('category, amount')
    .eq('user_id', currentUser.id)
    .eq('month_year', monthYear);

  const catSpend = {};
  (data || [])
    .filter(t => t.amount < 0 && t.category !== 'Receita')
    .forEach(t => { catSpend[t.category] = (catSpend[t.category] || 0) + Math.abs(t.amount); });

  const spendable = CATEGORIES.filter(c => c !== 'Receita' && c !== 'Investimentos');

  const listEl = document.getElementById('limits-list');
  listEl.innerHTML = `
    <div class="panel-header"><span>Categorias — ${fmtMonthYear(monthYear)}</span></div>
    ${spendable.map(cat => {
      const spent = catSpend[cat] || 0;
      const limit = userBudgets[cat] || 0;
      const pct = limit > 0 ? Math.min(100, (spent / limit) * 100) : 0;
      const statusClass = limit > 0 ? (pct >= 100 ? 'over' : pct >= 80 ? 'warn' : 'ok') : '';
      const barClass = pct >= 100 ? 'bar-red' : pct >= 80 ? 'bar-orange' : '';
      return `
        <div class="limit-item">
          <div class="limit-header">
            <span class="limit-cat-name">${CATEGORY_ICONS[cat] || ''} ${cat}</span>
            <span class="limit-spent ${statusClass}">${spent > 0 ? fmtBRL(spent) : '—'}</span>
          </div>
          ${limit > 0 ? `
            <div class="progress-bar-bg">
              <div class="progress-bar-fill ${barClass}" style="width:${pct}%"></div>
            </div>
          ` : ''}
          <div class="limit-input-row">
            <input type="text" class="limit-input" id="limit-input-${cat}"
              placeholder="Limite mensal (R$)"
              value="${limit > 0 ? limit.toFixed(2).replace('.', ',') : ''}">
            <button class="btn btn-secondary btn-sm" onclick="saveLimitAndRefresh('${cat}')">Salvar</button>
          </div>
        </div>
      `;
    }).join('')}
  `;
}

async function saveLimitAndRefresh(category) {
  const input = document.getElementById(`limit-input-${category}`);
  const ok = await saveBudget(category, input.value);
  if (ok) loadLimitsView();
}

// ====== INIT ======

(async () => {
  const { data: { session } } = await _sb.auth.getSession();
  if (session) {
    currentUser = session.user;
    document.getElementById('view-auth').classList.add('hidden');
    document.getElementById('app-shell').classList.remove('hidden');
    await Promise.all([loadUserRules(), loadBudgets()]);
    await populateMonthSelects();
    await loadGoalData();
    loadDashboard();
  }
})();
