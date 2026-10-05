/**
 * Mohaseb Pro Chrome Extension — Quick Invoice Creator
 * ✅ Auto-saves form to storage (survives popup close)
 * ✅ Professional UI with glass-card design
 */

const API = 'http://localhost:8000/api/';
const fmt = (n) => new Intl.NumberFormat('fa-IR').format(Number(n) || 0);
const DRAFT_KEY = 'invoice_draft';

// ═══════════════════════════════════════════
// Storage helpers
// ═══════════════════════════════════════════
const storage = {
  get: (key) => new Promise(resolve => {
    chrome.storage.local.get([key], (r) => resolve(r[key]));
  }),
  set: (key, val) => new Promise(resolve => {
    chrome.storage.local.set({ [key]: val }, resolve);
  }),
  remove: (key) => new Promise(resolve => {
    chrome.storage.local.remove([key], resolve);
  }),
};

// ═══════════════════════════════════════════
// API helpers
// ═══════════════════════════════════════════
async function apiRequest(endpoint, options = {}) {
  const token = await storage.get('access_token');
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const resp = await fetch(API + endpoint, { ...options, headers });

  if (resp.status === 401) {
    const refresh = await storage.get('refresh_token');
    if (refresh) {
      const refreshResp = await fetch(API + 'token/refresh/', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh }),
      });
      if (refreshResp.ok) {
        const data = await refreshResp.json();
        await storage.set('access_token', data.access);
        headers['Authorization'] = `Bearer ${data.access}`;
        return fetch(API + endpoint, { ...options, headers }).then(r => r.json());
      }
    }
    throw new Error('AUTH_EXPIRED');
  }

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.error || err.detail || JSON.stringify(err));
  }
  return resp.json();
}

// ═══════════════════════════════════════════
// State
// ═══════════════════════════════════════════
let services = [];
let currentStatus = 'pending';
let searchTimeout = null;
let svcSearchTimeout = null;
let saveTimeout = null;

const $ = (id) => document.getElementById(id);

// ═══════════════════════════════════════════
// Draft auto-save / restore
// ═══════════════════════════════════════════
function collectFormData() {
  const items = [];
  document.querySelectorAll('.item-row').forEach((row, idx) => {
    items.push({
      title: row.querySelector('.item-title')?.value || '',
      serviceId: row.querySelector('.item-title')?.dataset?.serviceId || null,
      mainPrice: row.querySelector('.item-main-price')?.value || '',
      extraPrice: row.querySelector('.item-extra-price')?.value || '',
      qty: row.querySelector('.item-qty')?.value || '1',
    });
  });
  return {
    customerName: $('customer-name').value,
    customerPhone: $('customer-phone').value,
    description: $('description').value,
    commissionTotal: $('commission-total').value,
    status: currentStatus,
    items: items,
    savedAt: Date.now(),
  };
}

function scheduleSave() {
  clearTimeout(saveTimeout);
  saveTimeout = setTimeout(async () => {
    const data = collectFormData();
    await storage.set(DRAFT_KEY, data);
    // Show draft indicator
    $('draft-badge').style.display = 'inline-flex';
  }, 500);
}

async function restoreDraft() {
  const draft = await storage.get(DRAFT_KEY);
  if (!draft) return false;

  // Check if draft has any meaningful data
  const hasData = draft.customerName || draft.customerPhone || draft.description ||
    (draft.items && draft.items.some(it => it.title || it.mainPrice));
  if (!hasData) return false;

  $('customer-name').value = draft.customerName || '';
  $('customer-phone').value = draft.customerPhone || '';
  $('description').value = draft.description || '';
  $('commission-total').value = draft.commissionTotal || '';
  currentStatus = draft.status || 'pending';
  updateStatusButtons();

  // Restore items
  clearItems();
  if (draft.items && draft.items.length > 0) {
    draft.items.forEach(it => addItemRow(it));
  } else {
    addItemRow();
  }

  updateTotal();
  $('draft-badge').style.display = 'inline-flex';
  return true;
}

async function clearDraft() {
  await storage.remove(DRAFT_KEY);
  $('draft-badge').style.display = 'none';
}

// ═══════════════════════════════════════════
// Login
// ═══════════════════════════════════════════
$('login-btn').addEventListener('click', async () => {
  const username = $('login-username').value.trim();
  const password = $('login-password').value.trim();
  if (!username || !password) return;

  $('login-btn').disabled = true;
  $('login-btn').innerHTML = '<span class="spinner"></span> در حال ورود...';
  $('login-error').style.display = 'none';

  try {
    const data = await fetch(API + 'token/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    }).then(r => {
      if (!r.ok) throw new Error('نام کاربری یا رمز عبور اشتباه است');
      return r.json();
    });

    await storage.set('access_token', data.access);
    await storage.set('refresh_token', data.refresh);
    showInvoiceView();
  } catch (e) {
    $('login-error').textContent = '⚠️ ' + e.message;
    $('login-error').style.display = 'block';
  } finally {
    $('login-btn').disabled = false;
    $('login-btn').textContent = 'ورود به حساب';
  }
});

// Enter key for login
$('login-password').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') $('login-btn').click();
});

// ═══════════════════════════════════════════
// Logout
// ═══════════════════════════════════════════
$('logout-btn').addEventListener('click', async () => {
  await storage.remove('access_token');
  await storage.remove('refresh_token');
  showLoginView();
});

// ═══════════════════════════════════════════
// View Switching
// ═══════════════════════════════════════════
function showLoginView() {
  $('login-view').style.display = 'block';
  $('invoice-view').style.display = 'none';
  $('success-view').style.display = 'none';
}

async function showInvoiceView() {
  $('login-view').style.display = 'none';
  $('invoice-view').style.display = 'block';
  $('success-view').style.display = 'none';

  // Load services
  try {
    const data = await apiRequest('services/');
    services = data.results || data;
  } catch (e) {
    if (e.message === 'AUTH_EXPIRED') { showLoginView(); return; }
  }

  // Try to restore draft first
  const hasDraft = await restoreDraft();
  if (!hasDraft) {
    // Fresh form
    $('customer-name').value = '';
    $('customer-phone').value = '';
    $('description').value = '';
    $('commission-total').value = '';
    $('invoice-error').style.display = 'none';
    currentStatus = 'pending';
    updateStatusButtons();
    clearItems();
    addItemRow();
    updateTotal();
    $('draft-badge').style.display = 'none';
  }

  // Attach change listeners for auto-save
  attachAutoSaveListeners();
}

function attachAutoSaveListeners() {
  ['customer-name', 'customer-phone', 'description', 'commission-total'].forEach(id => {
    $(id).addEventListener('input', scheduleSave);
  });
}

function showSuccessView(data) {
  $('login-view').style.display = 'none';
  $('invoice-view').style.display = 'none';
  $('success-view').style.display = 'block';

  $('success-msg').textContent = data.message || 'فاکتور با موفقیت صادر شد';
  $('success-number').textContent = data.invoice?.invoice_number || '';
  $('success-customer').textContent = data.customer?.name || '';
  $('success-amount').textContent = fmt(data.invoice?.total_amount || 0) + ' تومان';

  $('success-new-badge').style.display = data.customer?.is_new ? 'block' : 'none';
}

// ═══════════════════════════════════════════
// Customer Autocomplete
// ═══════════════════════════════════════════
$('customer-name').addEventListener('input', (e) => {
  const q = e.target.value.trim();
  clearTimeout(searchTimeout);

  if (q.length < 2) {
    $('customer-suggestions').style.display = 'none';
    $('new-badge').style.display = q.length > 0 ? 'inline' : 'none';
    return;
  }

  searchTimeout = setTimeout(async () => {
    try {
      const data = await apiRequest(`customers/?search=${encodeURIComponent(q)}`);
      const list = data.results || data;
      const container = $('customer-suggestions');
      container.innerHTML = '';

      if (list.length > 0) {
        list.slice(0, 5).forEach(c => {
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'suggestion-item';
          btn.innerHTML = `<span>${c.name}</span><span class="suggestion-phone">${c.phone || ''}</span>`;
          btn.addEventListener('click', () => {
            $('customer-name').value = c.name;
            if (c.phone) $('customer-phone').value = c.phone;
            container.style.display = 'none';
            $('new-badge').style.display = 'none';
            scheduleSave();
          });
          container.appendChild(btn);
        });
        container.style.display = 'block';
        $('new-badge').style.display = list.some(c => c.name.toLowerCase() === q.toLowerCase()) ? 'none' : 'inline';
      } else {
        container.style.display = 'none';
        $('new-badge').style.display = 'inline';
      }
    } catch {}
  }, 350);
});

document.addEventListener('click', (e) => {
  if (!e.target.closest('.autocomplete-wrap')) {
    $('customer-suggestions').style.display = 'none';
  }
});

// ═══════════════════════════════════════════
// Status Buttons
// ═══════════════════════════════════════════
document.querySelectorAll('.status-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    currentStatus = btn.dataset.status;
    updateStatusButtons();
    scheduleSave();
  });
});

function updateStatusButtons() {
  document.querySelectorAll('.status-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.status === currentStatus);
  });
}

// ═══════════════════════════════════════════
// Item Rows
// ═══════════════════════════════════════════
function clearItems() {
  $('items-container').innerHTML = '';
}

function addItemRow(data = {}) {
  const container = $('items-container');
  const idx = container.children.length;
  const row = document.createElement('div');
  row.className = 'item-row';

  row.innerHTML = `
    <span class="item-num">${idx + 1}</span>
    <button type="button" class="item-remove" data-action="remove-row">×</button>
    <div class="item-title-input">
      <input type="text" class="item-title" placeholder="عنوان خدمت (تایپ کنید برای جستجو)" value="${data.title || ''}" autocomplete="off" />
      <div class="svc-suggestions" style="display:none;"></div>
    </div>
    <div class="item-prices">
      <div>
        <span class="price-label">قیمت اصلی</span>
        <div class="price-wrap">
          <input type="number" class="item-main-price" placeholder="0" value="${data.mainPrice || ''}" />
          <span class="price-unit">هزار ت</span>
        </div>
      </div>
      <div>
        <span class="price-label">قیمت اضافی</span>
        <div class="price-wrap">
          <input type="number" class="item-extra-price" placeholder="0" value="${data.extraPrice || ''}" />
          <span class="price-unit">هزار ت</span>
        </div>
      </div>
      <div>
        <span class="price-label">تعداد</span>
        <input type="number" class="item-qty" min="1" placeholder="1" value="${data.qty || 1}" />
      </div>
    </div>
    <div class="item-line-total"></div>
  `;

  container.appendChild(row);

  // Set serviceId if restoring
  if (data.serviceId) {
    row.querySelector('.item-title').dataset.serviceId = data.serviceId;
  }

  // Remove button
  row.querySelector('[data-action="remove-row"]').addEventListener('click', function() {
    this.closest('.item-row').remove();
    renumberItems();
    updateTotal();
    scheduleSave();
  });

  // Service autocomplete
  const titleInput = row.querySelector('.item-title');
  const svcSuggestions = row.querySelector('.svc-suggestions');

  titleInput.addEventListener('input', (e) => {
    const q = e.target.value.trim().toLowerCase();
    clearTimeout(svcSearchTimeout);
    scheduleSave();
    if (!q) { svcSuggestions.style.display = 'none'; return; }
    svcSearchTimeout = setTimeout(() => {
      const filtered = services.filter(s => s.is_active && s.title.toLowerCase().includes(q));
      svcSuggestions.innerHTML = '';
      if (filtered.length > 0) {
        filtered.slice(0, 4).forEach(s => {
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'svc-item';
          btn.innerHTML = `<span>${s.title}</span><span class="svc-price">${fmt(s.default_main_price)} ت</span>`;
          btn.addEventListener('click', () => {
            titleInput.value = s.title;
            titleInput.dataset.serviceId = s.id;
            row.querySelector('.item-main-price').value = (s.default_main_price || 0) / 1000;
            row.querySelector('.item-extra-price').value = (s.default_extra_price || 0) / 1000;
            svcSuggestions.style.display = 'none';
            updateTotal();
            scheduleSave();
          });
          svcSuggestions.appendChild(btn);
        });
        svcSuggestions.style.display = 'block';
      } else {
        svcSuggestions.style.display = 'none';
      }
    }, 200);
  });

  titleInput.addEventListener('blur', () => {
    setTimeout(() => { svcSuggestions.style.display = 'none'; }, 200);
  });

  // Price change listeners — auto-save on any change
  row.querySelectorAll('input').forEach(inp => {
    inp.addEventListener('input', () => { updateTotal(); scheduleSave(); });
  });

  updateTotal();
}

function renumberItems() {
  document.querySelectorAll('.item-row').forEach((row, i) => {
    const numEl = row.querySelector('.item-num');
    if (numEl) numEl.textContent = i + 1;
  });
}

$('add-row-btn').addEventListener('click', () => { addItemRow(); scheduleSave(); });

// ═══════════════════════════════════════════
// Total Calculation
// ═══════════════════════════════════════════
function updateTotal() {
  let total = 0;
  document.querySelectorAll('.item-row').forEach(row => {
    const mp = Number(row.querySelector('.item-main-price')?.value || 0) * 1000;
    const ep = Number(row.querySelector('.item-extra-price')?.value || 0) * 1000;
    const qty = Math.max(1, Number(row.querySelector('.item-qty')?.value || 1));
    const lineTotal = (mp + ep) * qty;
    total += lineTotal;

    const ltEl = row.querySelector('.item-line-total');
    if (ltEl) ltEl.textContent = lineTotal > 0 ? `${fmt(lineTotal)} تومان` : '';
  });

  $('total-amount').textContent = `${fmt(total)} تومان`;
}

// ═══════════════════════════════════════════
// Submit Invoice
// ═══════════════════════════════════════════
$('submit-btn').addEventListener('click', async () => {
  const customerName = $('customer-name').value.trim();
  const customerPhone = $('customer-phone').value.trim();
  const description = $('description').value.trim();

  if (!customerName) {
    $('invoice-error').textContent = '⚠️ نام مشتری الزامی است';
    $('invoice-error').style.display = 'block';
    return;
  }

  const items = [];
  document.querySelectorAll('.item-row').forEach(row => {
    const title = row.querySelector('.item-title')?.value?.trim();
    const mp = Number(row.querySelector('.item-main-price')?.value || 0) * 1000;
    const ep = Number(row.querySelector('.item-extra-price')?.value || 0) * 1000;
    const qty = Math.max(1, Number(row.querySelector('.item-qty')?.value || 1));
    const svcId = row.querySelector('.item-title')?.dataset?.serviceId;

    if (title || mp > 0) {
      items.push({
        service: svcId ? Number(svcId) : null,
        service_title_snapshot: title || '',
        main_price: Math.round(mp),
        extra_price: Math.round(ep),
        quantity: qty,
        notes: '',
      });
    }
  });

  if (items.length === 0) {
    $('invoice-error').textContent = '⚠️ حداقل یک ردیف خدمت لازم است';
    $('invoice-error').style.display = 'block';
    return;
  }

  $('invoice-error').style.display = 'none';
  $('submit-btn').disabled = true;
  $('submit-btn').innerHTML = '<span class="spinner"></span> در حال صدور...';

  try {
    const result = await apiRequest('invoices/quick_create/', {
      method: 'POST',
      body: JSON.stringify({
        customer_name: customerName,
        customer_phone: customerPhone,
        status: currentStatus,
        description: description,
        commission_total: Math.round(Number($('commission-total').value || 0) * 1000),
        items: items,
      }),
    });

    // ✅ Clear draft on successful submission
    await clearDraft();
    showSuccessView(result);
  } catch (e) {
    $('invoice-error').textContent = '⚠️ ' + e.message;
    $('invoice-error').style.display = 'block';
  } finally {
    $('submit-btn').disabled = false;
    $('submit-btn').innerHTML = '⚡ صدور فاکتور';
  }
});

// ═══════════════════════════════════════════
// Success Actions
// ═══════════════════════════════════════════
$('new-invoice-btn').addEventListener('click', async () => {
  await clearDraft();
  showInvoiceView();
});
$('open-dashboard-btn').addEventListener('click', () => {
  chrome.runtime.sendMessage({ type: 'MINIMIZE_QUICK_INVOICE' });
});
$('minimize-btn').addEventListener('click', () => {
  chrome.runtime.sendMessage({ type: 'MINIMIZE_QUICK_INVOICE' });
});

// ═══════════════════════════════════════════
// Init — check if already logged in
// ═══════════════════════════════════════════
(async () => {
  const token = await storage.get('access_token');
  if (token) {
    try {
      await apiRequest('dashboard/stats/');
      showInvoiceView();
    } catch {
      showLoginView();
    }
  } else {
    showLoginView();
  }
})();
