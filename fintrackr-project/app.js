/* ---------------- STATE ---------------- */
const DEFAULT_CATEGORIES = [
  {name:'Food & Dining', icon:'🍴', color:'#FF7A1A', bg:'#FFE9D6'},
  {name:'Transport', icon:'🚌', color:'#2563EB', bg:'#DCE8FF'},
  {name:'Education', icon:'🎓', color:'#8B5CF6', bg:'#EAE2FB'},
  {name:'Entertainment', icon:'🎮', color:'#EC4899', bg:'#FCE1EF'},
  {name:'Shopping', icon:'🛍️', color:'#F59E0B', bg:'#FEF0D2'},
  {name:'Health', icon:'❤️', color:'#EF4444', bg:'#FDE1E1'},
  {name:'Housing', icon:'🏠', color:'#10B981', bg:'#D6F5E7'},
  {name:'Utilities', icon:'⚡', color:'#14B8A6', bg:'#CFF5EE'},
  {name:'Salary', icon:'💼', color:'#7C3AED', bg:'#EAE2FB'},
  {name:'Freelance', icon:'💻', color:'#2563EB', bg:'#DCE8FF'},
  {name:'Gifts', icon:'🎁', color:'#EC4899', bg:'#FCE1EF'},
  {name:'Other', icon:'⋯', color:'#6B7280', bg:'#EDEDED'},
];

let state = {
  userName: 'Sunny',
  transactions: [
    {id:'seed1', description:'gym expenses', category:'Food & Dining', type:'income', amount:30000, date: fmtISO(new Date(new Date().getFullYear(),3,1))}
  ],
  customCategories: [],
  budgets: [],
  goals: []
};

let currentPage = 'dashboard';
let chatMessages = [
  {role:'bot', text:"Hi! I'm FinBot, your AI financial advisor 🤖\n\nI've analyzed your spending patterns and I'm ready to give you personalized advice. Ask me anything about your finances, budgets, or savings goals!\n\nWhat would you like to know?", time: nowTime()}
];
let botTyping = false;
let receiptResult = null;
let receiptImageData = null;
let receiptLoading = false;

function fmtISO(d){ return d.toISOString().slice(0,10); }
function nowTime(){ return new Date().toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit'}).toLowerCase(); }
function uid(){ return 'id'+Math.random().toString(36).slice(2,10); }

/* ---------------- PERSISTENCE ---------------- */
async function loadState(){
  try{
    const res = await window.storage.get('fintrackr-state');
    if(res && res.value){
      const parsed = JSON.parse(res.value);
      state = Object.assign(state, parsed);
    }
  }catch(e){ /* no saved state yet, use defaults */ }
  try{
    const chat = await window.storage.get('fintrackr-chat');
    if(chat && chat.value){ chatMessages = JSON.parse(chat.value); }
  }catch(e){}
  render();
}
async function saveState(){
  try{ await window.storage.set('fintrackr-state', JSON.stringify(state)); }
  catch(e){ console.error('save failed', e); }
}
async function saveChat(){
  try{ await window.storage.set('fintrackr-chat', JSON.stringify(chatMessages)); }
  catch(e){ console.error('save chat failed', e); }
}

/* ---------------- HELPERS ---------------- */
function allCategories(){ return DEFAULT_CATEGORIES.concat(state.customCategories); }
function catInfo(name){
  return allCategories().find(c=>c.name===name) || {name, icon:'⋯', color:'#6B7280', bg:'#EDEDED'};
}
function fmtMoney(n){
  const sign = n<0 ? '-' : '';
  return sign + '₹' + Math.abs(Math.round(n)).toLocaleString('en-IN');
}
function fmtDateShort(iso){
  const d = new Date(iso+'T00:00:00');
  return d.getDate()+' '+d.toLocaleString('en-US',{month:'short'})+' '+d.getFullYear();
}
function fmtDateLong(iso){
  const d = new Date(iso+'T00:00:00');
  return d.toLocaleString('en-US',{weekday:'long'})+', '+d.getDate()+' '+d.toLocaleString('en-US',{month:'long'})+' '+d.getFullYear();
}
function monthKey(iso){ return iso.slice(0,7); }
function currentMonthKey(){ const d=new Date(); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0'); }
function currentMonthLabel(){ const d=new Date(); return d.toLocaleString('en-US',{month:'long'})+' '+d.getFullYear(); }
function currentMonthShort(){ const d=new Date(); return d.toLocaleString('en-US',{month:'short'})+' '+d.getFullYear(); }

function computeStats(){
  const mk = currentMonthKey();
  let totalBalance=0, monthlyIncome=0, monthlyExpenses=0;
  state.transactions.forEach(t=>{
    const amt = Number(t.amount)||0;
    totalBalance += (t.type==='income' ? amt : -amt);
    if(monthKey(t.date)===mk){
      if(t.type==='income') monthlyIncome+=amt; else monthlyExpenses+=amt;
    }
  });
  return {totalBalance, monthlyIncome, monthlyExpenses, monthlySavings: monthlyIncome-monthlyExpenses};
}

function last6Months(){
  const arr=[];
  const d=new Date();
  d.setDate(1);
  for(let i=5;i>=0;i--){
    const dd = new Date(d.getFullYear(), d.getMonth()-i, 1);
    arr.push({key: dd.getFullYear()+'-'+String(dd.getMonth()+1).padStart(2,'0'), label: dd.toLocaleString('en-US',{month:'short'})});
  }
  return arr;
}

function categorySpend(){
  const map = {};
  state.transactions.forEach(t=>{
    if(t.type==='expense'){
      map[t.category] = (map[t.category]||0) + Number(t.amount);
    }
  });
  return map;
}

/* ---------------- RENDER: SIDEBAR ---------------- */
const NAV = [
  {id:'dashboard', label:'Dashboard', icon:'📊'},
  {id:'transactions', label:'Transactions', icon:'💳'},
  {id:'budgets', label:'Budgets', icon:'📈'},
  {id:'goals', label:'Savings Goals', icon:'🎯'},
  {id:'categories', label:'Categories', icon:'🏷️'},
  {id:'history', label:'Transaction History', icon:'🕘'},
  {id:'receipt', label:'Receipt Scanner', icon:'🧾'},
  {id:'finbot', label:'FinBot AI Advisor', icon:'🤖'},
];

function renderSidebar(){
  const el = document.getElementById('sidebar');
  el.innerHTML = `
    <div class="logo"><div class="logo-badge">💰</div> FinTrackr</div>
    ${NAV.map(n=>`<div class="navitem ${currentPage===n.id?'active':''}" data-nav="${n.id}"><span class="ic">${n.icon}</span>${n.label}</div>`).join('')}
    <div class="sidebar-foot">Signed in as ${state.userName}</div>
  `;
  el.querySelectorAll('[data-nav]').forEach(elm=>{
    elm.addEventListener('click', ()=>{ currentPage = elm.dataset.nav; render(); });
  });
}

/* ---------------- PAGE: DASHBOARD ---------------- */
function pageDashboard(){
  const s = computeStats();
  const recent = state.transactions.slice().sort((a,b)=>b.date.localeCompare(a.date)).slice(0,5);
  const catSpend = categorySpend();
  const hasExpenses = Object.keys(catSpend).length>0;

  return `
    <div class="pagehead">
      <div>
        <h1>Dashboard</h1>
        <p>${currentMonthShort()} · Welcome back, <b>${state.userName}</b>!</p>
      </div>
      <button class="btn" id="btnAddTx">+ Add Transaction</button>
    </div>

    <div class="statgrid">
      <div class="statcard">
        <div class="statcard-top">
          <div class="icon-circle" style="background:#FFE7D3;">💼</div>
          <span class="pill plain">—</span>
        </div>
        <div class="stat-label">Total Balance</div>
        <div class="stat-value">${fmtMoney(s.totalBalance)}</div>
      </div>
      <div class="statcard">
        <div class="statcard-top">
          <div class="icon-circle" style="background:var(--green-bg);">↗</div>
          <span class="pill" style="background:var(--green-bg);color:var(--green);">↗ Income</span>
        </div>
        <div class="stat-label">Monthly Income</div>
        <div class="stat-value">${fmtMoney(s.monthlyIncome)}</div>
      </div>
      <div class="statcard">
        <div class="statcard-top">
          <div class="icon-circle" style="background:var(--red-bg);">↘</div>
          <span class="pill" style="background:var(--red-bg);color:var(--red);">↘ Expense</span>
        </div>
        <div class="stat-label">Monthly Expenses</div>
        <div class="stat-value">${fmtMoney(s.monthlyExpenses)}</div>
      </div>
      <div class="statcard">
        <div class="statcard-top">
          <div class="icon-circle" style="background:var(--purple-bg);">🐷</div>
          <span class="pill plain">—</span>
        </div>
        <div class="stat-label">Monthly Savings</div>
        <div class="stat-value">${fmtMoney(s.monthlySavings)}</div>
      </div>
    </div>

    <div class="grid2">
      <div class="card">
        <h3>📈 Monthly Trends</h3>
        <canvas id="trendsChart" height="230"></canvas>
      </div>
      <div class="card">
        <h3>🔶 Spending By Category</h3>
        ${hasExpenses ? '<canvas id="catChart" height="230"></canvas>' : `
          <div class="empty">
            <div class="eicon" style="background:#f2f2f2;">🐷</div>
            <h4>No Expenses Yet</h4>
            <p>Add an expense to see the breakdown</p>
          </div>`}
      </div>
    </div>

    <div class="grid2">
      <div class="card">
        <h3>🐷 Monthly Savings</h3>
        <canvas id="savingsChart" height="230"></canvas>
      </div>
      <div class="card">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:18px;">
          <h3 style="margin:0;">🔴 Recent Transactions</h3>
          <span class="viewall" data-nav2="history">View All</span>
        </div>
        ${recent.length ? recent.map(txHTML).join('') : `
          <div class="empty"><div class="eicon" style="background:#f2f2f2;">🧾</div><h4>No Transactions</h4><p>Add your first transaction to get started</p></div>`}
      </div>
    </div>
  `;
}

function txHTML(t){
  const c = catInfo(t.category);
  const isIncome = t.type==='income';
  return `
    <div class="txrow" data-txid="${t.id}">
      <div class="txleft">
        <div class="avatar">${(t.description||'?').charAt(0).toUpperCase()}</div>
        <div>
          <div class="txname">${escapeHTML(t.description)}</div>
          <div class="txmeta"><span class="catchip">${c.name}</span><span class="txdate">${fmtDateShort(t.date)}</span></div>
        </div>
      </div>
      <div class="amt ${isIncome?'pos':'neg'}">${isIncome?'+':'-'}${fmtMoney(Math.abs(t.amount))}</div>
    </div>
  `;
}

function escapeHTML(s){ const d=document.createElement('div'); d.textContent=s; return d.innerHTML; }

function drawCharts(){
  const months = last6Months();
  const incomeByMonth = months.map(m=>state.transactions.filter(t=>t.type==='income'&&monthKey(t.date)===m.key).reduce((a,b)=>a+Number(b.amount),0));
  const expenseByMonth = months.map(m=>state.transactions.filter(t=>t.type==='expense'&&monthKey(t.date)===m.key).reduce((a,b)=>a+Number(b.amount),0));

  const trendsEl = document.getElementById('trendsChart');
  if(trendsEl){
    new Chart(trendsEl, {
      type:'line',
      data:{ labels: months.map(m=>m.label),
        datasets:[
          {label:'Income', data:incomeByMonth, borderColor:'#15803D', backgroundColor:'rgba(21,128,61,0.08)', fill:true, tension:0.35, pointRadius:3},
          {label:'Expenses', data:expenseByMonth, borderColor:'#FF6A1A', backgroundColor:'rgba(255,106,26,0.08)', fill:true, tension:0.35, pointRadius:3},
        ]},
      options:{ plugins:{legend:{position:'bottom', labels:{usePointStyle:true, font:{weight:700}}}},
        scales:{ y:{ ticks:{callback:v=>'₹'+(v/1000)+'k'}, grid:{color:'#f0e6da'} }, x:{grid:{display:false}} } }
    });
  }
  const savingsEl = document.getElementById('savingsChart');
  if(savingsEl){
    const savingsByMonth = months.map((m,i)=>incomeByMonth[i]-expenseByMonth[i]);
    new Chart(savingsEl, {
      type:'bar',
      data:{ labels: months.map(m=>m.label), datasets:[{label:'Savings', data:savingsByMonth, backgroundColor:'#7C3AED', borderRadius:6, maxBarThickness:46}] },
      options:{ plugins:{legend:{display:false}}, scales:{ y:{ticks:{callback:v=>'₹'+(v/1000)+'k'}, grid:{color:'#f0e6da'}}, x:{grid:{display:false}} } }
    });
  }
  const catEl = document.getElementById('catChart');
  if(catEl){
    const spend = categorySpend();
    const labels = Object.keys(spend);
    const data = labels.map(l=>spend[l]);
    const colors = labels.map(l=>catInfo(l).color);
    new Chart(catEl, { type:'doughnut', data:{labels, datasets:[{data, backgroundColor:colors, borderWidth:2, borderColor:'#fff'}]},
      options:{ plugins:{legend:{position:'bottom', labels:{font:{weight:700}}}} } });
  }
}

/* ---------------- PAGE: TRANSACTIONS ---------------- */
function pageTransactions(){
  const list = state.transactions.slice().sort((a,b)=>b.date.localeCompare(a.date));
  return `
    <div class="pagehead">
      <div><h1>Transactions</h1><p>Manage your income and expenses</p></div>
      <button class="btn" id="btnAddTx">+ Add Transaction</button>
    </div>
    <div class="card">
      ${list.length ? list.map(txHTML).join('') : `<div class="empty"><div class="eicon" style="background:#f2f2f2;">🧾</div><h4>No Transactions</h4><p>Add your first transaction to get started</p></div>`}
    </div>
  `;
}

/* ---------------- PAGE: BUDGETS ---------------- */
function pageBudgets(){
  const spend = categorySpend();
  return `
    <div class="pagehead">
      <div><h1>Budgets</h1><p>${currentMonthLabel()} · Set limits per category</p></div>
      <button class="btn" id="btnSetBudget">+ Set Budget</button>
    </div>
    <div class="card">
      ${state.budgets.length ? state.budgets.map(b=>{
        const spent = spend[b.category]||0;
        const pct = Math.min(100, Math.round((spent/b.limit)*100));
        const over = spent>b.limit;
        const c = catInfo(b.category);
        return `<div class="budgetrow">
          <div class="budgethead">
            <span>${c.icon} ${b.category}</span>
            <span class="smallmuted" style="color:${over?'var(--red)':'inherit'}">${fmtMoney(spent)} / ${fmtMoney(b.limit)}</span>
          </div>
          <div class="progress-outer"><div class="progress-inner" style="width:${pct}%;background:${over?'var(--red)':'var(--orange)'}"></div></div>
          <div class="smallmuted">${pct}% used</div>
        </div>`;
      }).join('') : `<div class="empty"><div class="eicon" style="background:#DCE8FF;">📊</div><h4>No Budgets Set</h4><p>Set monthly limits for your spending categories</p></div>`}
    </div>
  `;
}

/* ---------------- PAGE: GOALS ---------------- */
function pageGoals(){
  return `
    <div class="pagehead">
      <div><h1>Savings Goals</h1><p>Set targets and track your progress</p></div>
      <button class="btn" id="btnNewGoal">+ New Goal</button>
    </div>
    <div class="card">
      ${state.goals.length ? state.goals.map(g=>{
        const pct = Math.min(100, Math.round((g.current/g.target)*100));
        return `<div class="goalrow">
          <div class="budgethead"><span>🎯 ${escapeHTML(g.name)}</span><span class="smallmuted">${fmtMoney(g.current)} / ${fmtMoney(g.target)}</span></div>
          <div class="progress-outer"><div class="progress-inner" style="width:${pct}%;background:var(--green);"></div></div>
          <div class="smallmuted">${pct}% ${g.deadline ? '· due '+fmtDateShort(g.deadline) : ''}</div>
        </div>`;
      }).join('') : `<div class="empty"><div class="eicon" style="background:var(--green-bg);">🎯</div><h4>No Goals Yet</h4><p>Create your first savings goal above</p></div>`}
    </div>
  `;
}

/* ---------------- PAGE: CATEGORIES ---------------- */
function pageCategories(){
  return `
    <div class="pagehead">
      <div><h1>Categories</h1><p>Manage your spending categories</p></div>
      <button class="btn" id="btnAddCat">+ Add Category</button>
    </div>
    <div class="sectionlabel"><span class="dot"></span> Default Categories <span class="smallmuted">(${DEFAULT_CATEGORIES.length})</span></div>
    <div class="catgrid">
      ${DEFAULT_CATEGORIES.map(c=>`
        <div class="catcard" style="--accent:${c.color};--accent-bg:${c.bg};">
          <div class="cicon">${c.icon}</div><div class="cname">${c.name}</div>
        </div>`).join('')}
    </div>
    <div class="sectionlabel"><span class="dot purple"></span> Custom Categories <span class="smallmuted">(${state.customCategories.length})</span></div>
    <div class="card" style="padding:${state.customCategories.length?'22px':'0'};">
      ${state.customCategories.length ? `<div class="catgrid">${state.customCategories.map(c=>`
        <div class="catcard" style="--accent:${c.color};--accent-bg:${c.bg};">
          <span class="del" data-delcat="${c.name}">✕</span>
          <div class="cicon">${c.icon}</div><div class="cname">${c.name}</div>
        </div>`).join('')}</div>` :
        `<div class="empty"><div class="eicon" style="background:#f2f2f2;">📁</div><h4>No Custom Categories Yet</h4><p>Create your own spending categories above</p></div>`}
    </div>
  `;
}

/* ---------------- PAGE: HISTORY ---------------- */
let historyFilters = {q:'', type:'all', category:'all', from:'', to:''};
function pageHistory(){
  let list = state.transactions.slice();
  if(historyFilters.q) list = list.filter(t=>t.description.toLowerCase().includes(historyFilters.q.toLowerCase()));
  if(historyFilters.type!=='all') list = list.filter(t=>t.type===historyFilters.type);
  if(historyFilters.category!=='all') list = list.filter(t=>t.category===historyFilters.category);
  if(historyFilters.from) list = list.filter(t=>t.date>=historyFilters.from);
  if(historyFilters.to) list = list.filter(t=>t.date<=historyFilters.to);
  list.sort((a,b)=>b.date.localeCompare(a.date));

  const totalIncome = list.filter(t=>t.type==='income').reduce((a,b)=>a+Number(b.amount),0);
  const totalExpense = list.filter(t=>t.type==='expense').reduce((a,b)=>a+Number(b.amount),0);

  const groups = {};
  list.forEach(t=>{ (groups[t.date] = groups[t.date]||[]).push(t); });
  const dateKeys = Object.keys(groups).sort((a,b)=>b.localeCompare(a));

  return `
    <div class="pagehead"><div><h1>Transaction History</h1><p>Filter and search all your transactions</p></div></div>
    <div class="card" style="margin-bottom:18px;">
      <div class="sectionlabel" style="margin:0 0 14px;">🔻 Filters</div>
      <div class="filterrow">
        <input type="text" id="fSearch" placeholder="Search transactions..." value="${historyFilters.q}">
        <select id="fType">
          <option value="all" ${historyFilters.type==='all'?'selected':''}>All Types</option>
          <option value="income" ${historyFilters.type==='income'?'selected':''}>Income</option>
          <option value="expense" ${historyFilters.type==='expense'?'selected':''}>Expense</option>
        </select>
        <select id="fCat">
          <option value="all">All Categories</option>
          ${allCategories().map(c=>`<option value="${c.name}" ${historyFilters.category===c.name?'selected':''}>${c.name}</option>`).join('')}
        </select>
        <input type="date" id="fFrom" value="${historyFilters.from}">
        <input type="date" id="fTo" value="${historyFilters.to}">
      </div>
    </div>
    <div class="statgrid" style="grid-template-columns:repeat(3,1fr);">
      <div class="statcard"><div class="stat-label">Transactions</div><div class="stat-value">${list.length}</div></div>
      <div class="statcard" style="border-color:var(--green);"><div class="stat-label">Total Income</div><div class="stat-value" style="color:var(--green);">${fmtMoney(totalIncome)}</div></div>
      <div class="statcard" style="border-color:var(--red);"><div class="stat-label">Total Expenses</div><div class="stat-value" style="color:var(--red);">${fmtMoney(totalExpense)}</div></div>
    </div>
    ${dateKeys.length ? dateKeys.map(dk=>`
      <div class="histgroup">
        <div class="histday"><span>${fmtDateLong(dk)}</span><span style="color:${groups[dk].reduce((a,b)=>a+(b.type==='income'?b.amount:-b.amount),0)>=0?'#15803D':'#DC2626'}">${fmtMoney(groups[dk].reduce((a,b)=>a+(b.type==='income'?b.amount:-b.amount),0))}</span></div>
        ${groups[dk].map(txHTML).join('')}
      </div>`).join('') : `<div class="card"><div class="empty"><div class="eicon" style="background:#f2f2f2;">🧾</div><h4>No Transactions Found</h4><p>Try adjusting your filters</p></div></div>`}
  `;
}

/* ---------------- PAGE: RECEIPT SCANNER ---------------- */
function pageReceipt(){
  return `
    <div class="pagehead"><div><h1>Receipt Scanner</h1><p>Upload a receipt and AI will extract the transaction details</p></div></div>
    <div class="dropzone" id="dropzone">
      <div class="dz-icon">🧾</div>
      <h4>Drop Receipt Here</h4>
      <p>or click to browse files</p>
      <div class="dz-btns">
        <button class="btn teal" id="btnUploadImg" type="button">⬆ Upload Image</button>
        <button class="btn secondary" id="btnTakePhoto" type="button">📷 Take Photo</button>
      </div>
      <p style="margin-top:14px;font-size:12px;">Supports JPG, PNG, WebP · Max 10MB</p>
      <input type="file" id="fileInput" accept="image/*" style="display:none;">
      <input type="file" id="cameraInput" accept="image/*" capture="environment" style="display:none;">
    </div>

    ${receiptLoading ? `
      <div class="card" style="margin-top:20px;display:flex;align-items:center;gap:14px;">
        <div class="typing"><span></span><span></span><span></span></div>
        <span style="font-weight:700;">FinBot is reading your receipt…</span>
      </div>` : ''}

    ${receiptResult ? `
      <div class="card" style="margin-top:20px;">
        <h3>✅ Extracted Details</h3>
        <div class="receipt-preview">
          ${receiptImageData ? `<img src="${receiptImageData}">` : ''}
          <div style="flex:1;">
            <div class="field"><label>Merchant / Description</label><input id="rDesc" value="${escapeHTML(receiptResult.description||'')}"></div>
            <div class="field"><label>Amount (₹)</label><input id="rAmount" type="number" value="${receiptResult.amount||''}"></div>
            <div class="field"><label>Category</label>
              <select id="rCategory">${allCategories().map(c=>`<option value="${c.name}" ${c.name===receiptResult.category?'selected':''}>${c.name}</option>`).join('')}</select>
            </div>
            <div class="field"><label>Date</label><input id="rDate" type="date" value="${receiptResult.date||fmtISO(new Date())}"></div>
            <button class="btn" id="btnConfirmReceipt">+ Add as Transaction</button>
          </div>
        </div>
      </div>` : ''}

    <div class="tipsbox">
      <h4>💡 Tips For Best Results</h4>
      <div class="tipitem"><span class="tipnum">1</span> Ensure the receipt is well-lit and clearly visible</div>
      <div class="tipitem"><span class="tipnum">2</span> Include the full receipt — total amount, date, and merchant name</div>
      <div class="tipitem"><span class="tipnum">3</span> Flatten crumpled receipts before scanning</div>
      <div class="tipitem"><span class="tipnum">4</span> Digital receipts (screenshots) work great too</div>
    </div>
  `;
}

async function handleReceiptFile(file){
  if(!file) return;
  const reader = new FileReader();
  reader.onload = async (e)=>{
    receiptImageData = e.target.result;
    receiptResult = null;
    receiptLoading = true;
    render();
    try{
      const base64 = receiptImageData.split(',')[1];
      const mediaType = file.type || 'image/jpeg';
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body: JSON.stringify({
          model:"claude-sonnet-4-6",
          max_tokens:1000,
          messages:[{
            role:"user",
            content:[
              {type:"image", source:{type:"base64", media_type: mediaType, data: base64}},
              {type:"text", text:`Look at this receipt image and extract the transaction details. Respond ONLY with raw JSON (no markdown, no code fences, no preamble) in exactly this shape:
{"description": "short merchant or purchase name", "amount": number (total amount, no currency symbol), "date": "YYYY-MM-DD", "category": "best matching category name from this list: ${allCategories().map(c=>c.name).join(', ')}"}
If you cannot read a value confidently, make a reasonable best guess. Today's date is ${fmtISO(new Date())}.`}
            ]
          }]
        })
      });
      const data = await response.json();
      const text = (data.content||[]).map(b=>b.text||'').join('');
      const clean = text.replace(/```json|```/g,'').trim();
      const parsed = JSON.parse(clean);
      receiptResult = parsed;
    }catch(err){
      console.error('Receipt scan error', err);
      receiptResult = {description:'', amount:'', category: allCategories()[0].name, date: fmtISO(new Date())};
      alert("Couldn't fully read that receipt automatically — please fill in / correct the details below.");
    }
    receiptLoading = false;
    render();
  };
  reader.readAsDataURL(file);
}

/* ---------------- PAGE: FINBOT ---------------- */
function pageFinbot(){
  return `
    <div class="botwrap">
      <div class="bothead">
        <div class="bothead-left">
          <div class="bot-avatar">🤖</div>
          <div><h3>FinBot AI Advisor</h3><div class="status"><span class="sdot"></span> Analyzing your financial data</div></div>
        </div>
        <div class="aibadge">✨ AI Powered</div>
      </div>
      <div class="chatscroll" id="chatscroll">
        ${chatMessages.map(m=>`
          <div class="msg ${m.role==='user'?'user':''}">
            ${m.role==='bot' ? '<div class="bavatar">🤖</div>' : ''}
            <div>
              <div class="bubble">${escapeHTML(m.text)}</div>
              <div class="msgtime">${m.time}</div>
            </div>
          </div>`).join('')}
        ${botTyping ? `<div class="msg"><div class="bavatar">🤖</div><div class="bubble"><div class="typing"><span></span><span></span><span></span></div></div></div>` : ''}
      </div>
      <div class="quicklabel">Quick Questions</div>
      <div class="quickrow">
        ${['How can I reduce my food expenses?','Am I saving enough this month?','Where am I overspending?','Give me a budget optimization plan','How do I build an emergency fund?','Tips for saving on student budget']
          .map(q=>`<div class="qchip" data-quick="${escapeHTML(q)}">${q}</div>`).join('')}
      </div>
      <div class="botinputrow">
        <input id="botInput" type="text" placeholder="Ask about your finances... (Enter to send)">
        <div class="sendbtn" id="botSend">➤</div>
      </div>
    </div>
  `;
}

async function sendBotMessage(text){
  if(!text || !text.trim()) return;
  chatMessages.push({role:'user', text: text.trim(), time: nowTime()});
  botTyping = true;
  saveChat();
  render();
  scrollChatBottom();

  const s = computeStats();
  const spend = categorySpend();
  const context = `User financial snapshot (currency INR):
Total balance: ₹${s.totalBalance}
This month income: ₹${s.monthlyIncome}
This month expenses: ₹${s.monthlyExpenses}
This month savings: ₹${s.monthlySavings}
Spending by category: ${JSON.stringify(spend)}
Budgets set: ${JSON.stringify(state.budgets)}
Savings goals: ${JSON.stringify(state.goals)}
Recent transactions: ${JSON.stringify(state.transactions.slice(-10))}
The user is a student. Keep replies concise (under 120 words), practical, warm, and specific to the numbers above where relevant.`;

  try{
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body: JSON.stringify({
        model:"claude-sonnet-4-6",
        max_tokens:500,
        messages:[
          {role:"user", content: context + "\n\nUser question: " + text}
        ]
      })
    });
    const data = await response.json();
    const reply = (data.content||[]).map(b=>b.text||'').join('') || "Sorry, I couldn't process that right now.";
    chatMessages.push({role:'bot', text: reply, time: nowTime()});
  }catch(err){
    console.error(err);
    chatMessages.push({role:'bot', text:"I'm having trouble connecting right now. Please try again in a moment.", time: nowTime()});
  }
  botTyping = false;
  saveChat();
  render();
  scrollChatBottom();
}
function scrollChatBottom(){
  const el = document.getElementById('chatscroll');
  if(el) el.scrollTop = el.scrollHeight;
}

/* ---------------- MODALS ---------------- */
function closeModal(){ document.getElementById('modalRoot').innerHTML=''; }

function openAddTxModal(){
  let type = 'expense';
  const root = document.getElementById('modalRoot');
  root.innerHTML = `
    <div class="overlay" id="ovTx">
      <div class="modal">
        <h2>Add Transaction</h2>
        <div class="typetoggle">
          <div class="topt exp active" data-t="expense">↘ Expense</div>
          <div class="topt inc" data-t="income">↗ Income</div>
        </div>
        <div class="field" style="margin-top:16px;"><label>Description</label><input id="mDesc" placeholder="e.g. Groceries"></div>
        <div class="field"><label>Amount (₹)</label><input id="mAmount" type="number" placeholder="0"></div>
        <div class="field"><label>Category</label><select id="mCategory">${allCategories().map(c=>`<option value="${c.name}">${c.name}</option>`).join('')}</select></div>
        <div class="field"><label>Date</label><input id="mDate" type="date" value="${fmtISO(new Date())}"></div>
        <div class="modalbtns">
          <button class="btn secondary" id="mCancel">Cancel</button>
          <button class="btn" id="mSave">Save</button>
        </div>
      </div>
    </div>
  `;
  root.querySelectorAll('.topt').forEach(el=>{
    el.addEventListener('click', ()=>{
      type = el.dataset.t;
      root.querySelectorAll('.topt').forEach(x=>x.classList.remove('active'));
      el.classList.add('active');
    });
  });
  document.getElementById('mCancel').onclick = closeModal;
  document.getElementById('ovTx').addEventListener('click',(e)=>{ if(e.target.id==='ovTx') closeModal(); });
  document.getElementById('mSave').onclick = ()=>{
    const desc = document.getElementById('mDesc').value.trim();
    const amount = parseFloat(document.getElementById('mAmount').value);
    const category = document.getElementById('mCategory').value;
    const date = document.getElementById('mDate').value || fmtISO(new Date());
    if(!desc || !amount || amount<=0){ alert('Please enter a description and a valid amount.'); return; }
    state.transactions.push({id:uid(), description:desc, amount, category, type, date});
    saveState();
    closeModal();
    render();
  };
}

function openSetBudgetModal(){
  const root = document.getElementById('modalRoot');
  root.innerHTML = `
    <div class="overlay" id="ovB">
      <div class="modal">
        <h2>Set Budget</h2>
        <div class="field"><label>Category</label><select id="bCat">${allCategories().map(c=>`<option value="${c.name}">${c.name}</option>`).join('')}</select></div>
        <div class="field"><label>Monthly Limit (₹)</label><input id="bLimit" type="number" placeholder="0"></div>
        <div class="modalbtns">
          <button class="btn secondary" id="bCancel">Cancel</button>
          <button class="btn" id="bSave">Save</button>
        </div>
      </div>
    </div>`;
  document.getElementById('bCancel').onclick = closeModal;
  document.getElementById('ovB').addEventListener('click',(e)=>{ if(e.target.id==='ovB') closeModal(); });
  document.getElementById('bSave').onclick = ()=>{
    const category = document.getElementById('bCat').value;
    const limit = parseFloat(document.getElementById('bLimit').value);
    if(!limit || limit<=0){ alert('Enter a valid limit.'); return; }
    state.budgets = state.budgets.filter(b=>b.category!==category);
    state.budgets.push({category, limit});
    saveState(); closeModal(); render();
  };
}

function openNewGoalModal(){
  const root = document.getElementById('modalRoot');
  root.innerHTML = `
    <div class="overlay" id="ovG">
      <div class="modal">
        <h2>New Savings Goal</h2>
        <div class="field"><label>Goal Name</label><input id="gName" placeholder="e.g. New Laptop"></div>
        <div class="field"><label>Target Amount (₹)</label><input id="gTarget" type="number" placeholder="0"></div>
        <div class="field"><label>Already Saved (₹)</label><input id="gCurrent" type="number" placeholder="0" value="0"></div>
        <div class="field"><label>Target Date (optional)</label><input id="gDeadline" type="date"></div>
        <div class="modalbtns">
          <button class="btn secondary" id="gCancel">Cancel</button>
          <button class="btn" id="gSave">Save</button>
        </div>
      </div>
    </div>`;
  document.getElementById('gCancel').onclick = closeModal;
  document.getElementById('ovG').addEventListener('click',(e)=>{ if(e.target.id==='ovG') closeModal(); });
  document.getElementById('gSave').onclick = ()=>{
    const name = document.getElementById('gName').value.trim();
    const target = parseFloat(document.getElementById('gTarget').value);
    const current = parseFloat(document.getElementById('gCurrent').value)||0;
    const deadline = document.getElementById('gDeadline').value;
    if(!name || !target || target<=0){ alert('Enter a goal name and valid target.'); return; }
    state.goals.push({id:uid(), name, target, current, deadline});
    saveState(); closeModal(); render();
  };
}

function openAddCategoryModal(){
  const root = document.getElementById('modalRoot');
  const palette = ['#FF7A1A','#2563EB','#8B5CF6','#EC4899','#F59E0B','#EF4444','#10B981','#14B8A6'];
  root.innerHTML = `
    <div class="overlay" id="ovC">
      <div class="modal">
        <h2>Add Category</h2>
        <div class="field"><label>Name</label><input id="cName" placeholder="e.g. Pets"></div>
        <div class="field"><label>Emoji Icon</label><input id="cIcon" placeholder="e.g. 🐶" maxlength="4"></div>
        <div class="field"><label>Color</label>
          <div style="display:flex;gap:8px;flex-wrap:wrap;">
            ${palette.map((p,i)=>`<div class="colorpick" data-c="${p}" style="width:30px;height:30px;border-radius:50%;background:${p};border:3px solid ${i===0?'#000':'transparent'};cursor:pointer;"></div>`).join('')}
          </div>
        </div>
        <div class="modalbtns">
          <button class="btn secondary" id="cCancel">Cancel</button>
          <button class="btn" id="cSave">Save</button>
        </div>
      </div>
    </div>`;
  let chosenColor = palette[0];
  root.querySelectorAll('.colorpick').forEach(el=>{
    el.addEventListener('click', ()=>{
      chosenColor = el.dataset.c;
      root.querySelectorAll('.colorpick').forEach(x=>x.style.borderColor='transparent');
      el.style.borderColor = '#000';
    });
  });
  document.getElementById('cCancel').onclick = closeModal;
  document.getElementById('ovC').addEventListener('click',(e)=>{ if(e.target.id==='ovC') closeModal(); });
  document.getElementById('cSave').onclick = ()=>{
    const name = document.getElementById('cName').value.trim();
    const icon = document.getElementById('cIcon').value.trim() || '🔖';
    if(!name){ alert('Enter a category name.'); return; }
    state.customCategories.push({name, icon, color: chosenColor, bg: chosenColor+'22'});
    saveState(); closeModal(); render();
  };
}

/* ---------------- MAIN RENDER ---------------- */
function render(){
  renderSidebar();
  const main = document.getElementById('main');
  let html = '';
  if(currentPage==='dashboard') html = pageDashboard();
  else if(currentPage==='transactions') html = pageTransactions();
  else if(currentPage==='budgets') html = pageBudgets();
  else if(currentPage==='goals') html = pageGoals();
  else if(currentPage==='categories') html = pageCategories();
  else if(currentPage==='history') html = pageHistory();
  else if(currentPage==='receipt') html = pageReceipt();
  else if(currentPage==='finbot') html = pageFinbot();
  main.innerHTML = html;
  attachPageEvents();
  if(currentPage==='dashboard') drawCharts();
  if(currentPage==='finbot') scrollChatBottom();
}

function attachPageEvents(){
  const btnAdd = document.getElementById('btnAddTx');
  if(btnAdd) btnAdd.onclick = openAddTxModal;

  const btnBudget = document.getElementById('btnSetBudget');
  if(btnBudget) btnBudget.onclick = openSetBudgetModal;

  const btnGoal = document.getElementById('btnNewGoal');
  if(btnGoal) btnGoal.onclick = openNewGoalModal;

  const btnCat = document.getElementById('btnAddCat');
  if(btnCat) btnCat.onclick = openAddCategoryModal;

  document.querySelectorAll('[data-nav2]').forEach(el=>{
    el.addEventListener('click', ()=>{ currentPage = el.dataset.nav2; render(); });
  });

  document.querySelectorAll('[data-delcat]').forEach(el=>{
    el.addEventListener('click', ()=>{
      state.customCategories = state.customCategories.filter(c=>c.name!==el.dataset.delcat);
      saveState(); render();
    });
  });

  // History filters
  const fSearch = document.getElementById('fSearch');
  if(fSearch){
    fSearch.oninput = ()=>{ historyFilters.q = fSearch.value; render(); document.getElementById('fSearch').focus(); document.getElementById('fSearch').setSelectionRange(fSearch.value.length,fSearch.value.length); };
    document.getElementById('fType').onchange = (e)=>{ historyFilters.type = e.target.value; render(); };
    document.getElementById('fCat').onchange = (e)=>{ historyFilters.category = e.target.value; render(); };
    document.getElementById('fFrom').onchange = (e)=>{ historyFilters.from = e.target.value; render(); };
    document.getElementById('fTo').onchange = (e)=>{ historyFilters.to = e.target.value; render(); };
  }

  // Receipt scanner
  const dz = document.getElementById('dropzone');
  const fileInput = document.getElementById('fileInput');
  const cameraInput = document.getElementById('cameraInput');
  const btnUpload = document.getElementById('btnUploadImg');
  const btnPhoto = document.getElementById('btnTakePhoto');
  if(dz){
    dz.addEventListener('click', (e)=>{ if(e.target===dz || e.target.tagName==='H4' || e.target.tagName==='P') fileInput.click(); });
    dz.addEventListener('dragover', (e)=>{ e.preventDefault(); });
    dz.addEventListener('drop', (e)=>{ e.preventDefault(); if(e.dataTransfer.files[0]) handleReceiptFile(e.dataTransfer.files[0]); });
  }
  if(btnUpload) btnUpload.onclick = ()=>fileInput.click();
  if(btnPhoto) btnPhoto.onclick = ()=>cameraInput.click();
  if(fileInput) fileInput.onchange = (e)=>handleReceiptFile(e.target.files[0]);
  if(cameraInput) cameraInput.onchange = (e)=>handleReceiptFile(e.target.files[0]);
  const btnConfirmReceipt = document.getElementById('btnConfirmReceipt');
  if(btnConfirmReceipt){
    btnConfirmReceipt.onclick = ()=>{
      const desc = document.getElementById('rDesc').value.trim();
      const amount = parseFloat(document.getElementById('rAmount').value);
      const category = document.getElementById('rCategory').value;
      const date = document.getElementById('rDate').value || fmtISO(new Date());
      if(!desc || !amount || amount<=0){ alert('Please check description and amount.'); return; }
      state.transactions.push({id:uid(), description:desc, amount, category, type:'expense', date});
      saveState();
      receiptResult = null; receiptImageData = null;
      currentPage = 'transactions';
      render();
    };
  }

  // FinBot
  const botInput = document.getElementById('botInput');
  const botSend = document.getElementById('botSend');
  if(botInput){
    botInput.addEventListener('keydown', (e)=>{ if(e.key==='Enter'){ const v=botInput.value; botInput.value=''; sendBotMessage(v); } });
  }
  if(botSend){ botSend.onclick = ()=>{ const v=botInput.value; botInput.value=''; sendBotMessage(v); }; }
  document.querySelectorAll('[data-quick]').forEach(el=>{
    el.addEventListener('click', ()=>sendBotMessage(el.dataset.quick));
  });
}

/* ---------------- INIT ---------------- */
loadState();
