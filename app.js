// =========================================
// Native IndexedDB Wrapper
// =========================================
const DB_NAME = "MohasebDB";
const STORE_NAME = "appData";
const DB_VERSION = 1;

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      e.target.result.createObjectStore(STORE_NAME);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function loadData() {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const req = tx.objectStore(STORE_NAME).get("state");
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.error("DB Load Error", err);
    return null;
  }
}

async function saveData(state) {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).put(state, "state");
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.error("DB Save Error", err);
  }
}

// =========================================
// State Management
// =========================================
const defaultServices = [
  { id: 1, text: "خلافی", extraLabel: "استعلام", hasExtra: true, defaultMain: 0, defaultExtra: 0 },
  { id: 2, text: "مالیات نقل و انتقال", extraLabel: "استعلام", hasExtra: true, defaultMain: 0, defaultExtra: 0 },
  { id: 3, text: "مالیات مشاغل", extraLabel: "مفاصاحساب", hasExtra: true, defaultMain: 0, defaultExtra: 0 },
  { id: 4, text: "عوارض شهرداری", extraLabel: "مفاصاحساب", hasExtra: true, defaultMain: 0, defaultExtra: 0 },
  { id: 5, text: "عوارض آزادراهی", hasExtra: false, defaultMain: 0, defaultExtra: 0 },
  { id: 6, text: "طرح ترافیک", hasExtra: false, defaultMain: 0, defaultExtra: 0 },
  { id: 7, text: "کارمزد", hasExtra: false, defaultMain: 0, defaultExtra: 0 },
  { id: 8, text: "سایر (دلخواه)", hasExtra: false, defaultMain: 0, defaultExtra: 0 },
];

let appState = {
  services: [...defaultServices],
  customers: [], // { id, name, phone, date }
  invoices: [], // { id, customerId, date, items, total, description }
  documents: [] // { id, customerId, name, data, date }
};

async function initApp() {
  const saved = await loadData();
  if (saved && saved.services) {
    appState = saved;
  } else {
    await saveData(appState); // save defaults
  }
  
  document.documentElement.dataset.theme = appState.theme || "dark";
  initRouter();
  renderCustomersDropdown();
  renderServicesDropdown();
  renderSettingsServices();
  renderCustomersList();
  renderInvoicesList();
}

const persist = () => saveData(appState);

// =========================================
// Routing (SPA)
// =========================================
function showView(viewId) {
  document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
  document.getElementById(viewId).classList.add("active");
  
  document.querySelectorAll(".nav-link").forEach(l => l.classList.remove("active"));
  const link = document.querySelector(`.nav-link[data-target="${viewId}"]`);
  if (link) link.classList.add("active");

  // Re-renders for specific views
  if (viewId === "view-new-invoice") {
    renderCustomersDropdown();
    renderServicesDropdown();
  } else if (viewId === "view-customers") {
    renderCustomersList();
  } else if (viewId === "view-invoices") {
    renderInvoicesList();
  } else if (viewId === "view-settings") {
    renderSettingsServices();
  }
}

function initRouter() {
  document.querySelectorAll(".nav-link").forEach(link => {
    link.addEventListener("click", (e) => {
      e.preventDefault();
      showView(e.currentTarget.dataset.target);
    });
  });
}

// =========================================
// Number Formatting & Persian Utils
// =========================================
function formatNumber(num) {
  return parseInt(num, 10).toLocaleString('en-US');
}

const Num2persian = (function() {
  const letters = [
    ["", "یک", "دو", "سه", "چهار", "پنج", "شش", "هفت", "هشت", "نه"],
    ["ده", "یازده", "دوازده", "سیزده", "چهارده", "پانزده", "شانزده", "هفده", "هجده", "نوزده"],
    ["", "", "بیست", "سی", "چهل", "پنجاه", "شصت", "هفتاد", "هشتاد", "نود"],
    ["", "صد", "دویست", "سیصد", "چهارصد", "پانصد", "ششصد", "هفتصد", "هشتصد", "نهصد"],
    ["", " هزار", " میلیون", " میلیارد", " تریلیون"]
  ];

  // تبدیل اعداد فارسی/عربی و تمیزکاری ورودی
  function normalizeInput(input) {
    if (typeof input === 'number') return Math.floor(input);
    if (!input) return 0;
    const str = String(input)
      .replace(/[۰-۹]/g, d => "۰۱۲۳۴۵۶۷۸۹".indexOf(d))
      .replace(/[٠-٩]/g, d => "٠١٢٣٤٥٦٧٨٩".indexOf(d))
      .replace(/[^0-9-]/g, '');
    return parseInt(str, 10) || 0;
  }

  return function(num) {
    let parsed = normalizeInput(num);
    if (parsed === 0) return "صفر";

    let isNegative = parsed < 0;
    if (isNegative) parsed = Math.abs(parsed);

    // تفکیک ۳ رقم ۳ رقم به صورت ریاضی (بدون دستکاری رشته‌ای منسوخ)
    let groups = [];
    while (parsed > 0) {
      groups.push(parsed % 1000);
      parsed = Math.floor(parsed / 1000);
    }

    let out = [];
    for (let i = groups.length - 1; i >= 0; i--) {
      let n3 = groups[i];
      if (n3 === 0) continue;

      let part = [];
      let n100 = Math.floor(n3 / 100);
      let n10 = n3 % 100;
      let n1 = n3 % 10;

      if (n100 > 0) part.push(letters[3][n100]);

      if (n10 >= 10 && n10 <= 19) {
        part.push(letters[1][n10 - 10]);
      } else {
        let n10t = Math.floor(n10 / 10);
        if (n10t > 0) part.push(letters[2][n10t]);
        if (n1 > 0) part.push(letters[0][n1]);
      }

      let suffix = letters[4][i] || "";
      out.push(part.join(" و ") + suffix);
    }

    let result = out.join(" و ");
    return isNegative ? "منفی " + result : result;
  };
})();


function setupPriceInput(input) {
  input.addEventListener("input", (e) => {
    let val = e.target.value.replace(/\D/g, '');
    if (val) {
      e.target.value = formatNumber(val);
      e.target.dataset.trueValue = parseInt(val, 10) * 1000;
    } else {
      e.target.value = '';
      e.target.dataset.trueValue = 0;
    }
    updateInvoiceTotal();
  });
  input.addEventListener("focus", (e) => {
    const tv = parseInt(e.target.dataset.trueValue, 10) || 0;
    e.target.value = tv > 0 ? formatNumber(tv / 1000) : '';
  });
  input.addEventListener("blur", (e) => {
    const tv = parseInt(e.target.dataset.trueValue, 10) || 0;
    e.target.value = tv > 0 ? formatNumber(tv) : '';
  });
}

// =========================================
// View: New Invoice Logic
// =========================================
const invoiceTableBody = document.getElementById("table-body");
let currentInvoiceItems = [];

function renderServicesDropdown() {
  const sel = document.getElementById("service-select");
  sel.innerHTML = '<option value="">انتخاب کنید...</option>';
  appState.services.forEach(s => {
    sel.innerHTML += `<option value="${s.id}">${s.text}</option>`;
  });
}

function renderCustomersDropdown() {
  const sel = document.getElementById("invoice-customer");
  sel.innerHTML = '<option value="">مشتری عمومی (بدون ثبت نام)</option>';
  appState.customers.forEach(c => {
    sel.innerHTML += `<option value="${c.id}">${c.name} (${c.phone})</option>`;
  });
}

function addServiceToInvoice(service) {
  if (currentInvoiceItems.find(i => i.serviceId === service.id)) return; // prevent duplicate
  
  const itemId = Date.now() + Math.random();
  currentInvoiceItems.push({ id: itemId, serviceId: service.id });
  
  const tr = document.createElement("tr");
  tr.dataset.id = itemId;
  tr.dataset.serviceId = service.id;

  let extraHtml = '<span class="text-muted">-</span>';
  if (service.hasExtra) {
    extraHtml = `
      <div class="input-with-label" style="display:flex; align-items:center; gap:5px;">
        <span class="text-sm text-muted">${service.extraLabel || 'هزینه'}:</span>
        <input type="text" class="input price-input extra-price" placeholder="0" 
               data-true-value="${service.defaultExtra}" 
               value="${service.defaultExtra > 0 ? formatNumber(service.defaultExtra) : ''}">
      </div>
    `;
  }

  tr.innerHTML = `
    <td class="text-center row-num"></td>
    <td class="font-bold">${service.text}</td>
    <td>
      <input type="text" class="input price-input main-price" placeholder="0"
             data-true-value="${service.defaultMain}"
             value="${service.defaultMain > 0 ? formatNumber(service.defaultMain) : ''}">
    </td>
    <td>${extraHtml}</td>
    <td class="text-center no-print">
      <button class="action-btn delete" onclick="removeInvoiceItem('${itemId}')">
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
      </button>
    </td>
  `;
  
  invoiceTableBody.appendChild(tr);
  tr.querySelectorAll('.price-input').forEach(setupPriceInput);
  updateInvoiceItems();
}

window.removeInvoiceItem = (id) => {
  currentInvoiceItems = currentInvoiceItems.filter(i => i.id != id);
  const row = invoiceTableBody.querySelector(`tr[data-id="${id}"]`);
  if (row) row.remove();
  updateInvoiceItems();
};

function updateInvoiceItems() {
  const rows = invoiceTableBody.querySelectorAll("tr");
  rows.forEach((r, idx) => r.querySelector(".row-num").textContent = idx + 1);
  updateInvoiceTotal();
}

function updateInvoiceTotal() {
  let total = 0, totalKhalafi = 0, totalMaliyat = 0, totalMashagel = 0, totalShahrdari = 0;

  invoiceTableBody.querySelectorAll("tr").forEach(row => {
    const sId = parseInt(row.dataset.serviceId, 10);
    const main = parseInt(row.querySelector(".main-price")?.dataset.trueValue) || 0;
    const extra = parseInt(row.querySelector(".extra-price")?.dataset.trueValue) || 0;
    const rowTotal = main + extra;
    total += rowTotal;

    const s = appState.services.find(x => x.id === sId);
    if (s && s.text.includes("خلافی")) totalKhalafi += rowTotal;
    if (s && s.text.includes("مالیات نقل و انتقال")) totalMaliyat += rowTotal;
    if (s && s.text.includes("مالیات مشاغل")) totalMashagel += rowTotal;
    if (s && s.text.includes("شهرداری")) totalShahrdari += rowTotal;
  });

  document.getElementById("total-amount").textContent = total.toLocaleString("fa-IR");
  document.getElementById("total-words").textContent = total > 0 ? Num2persian(total) + " تومان" : "صفر تومان";
  document.getElementById("total-khalafi").textContent = totalKhalafi.toLocaleString("fa-IR");
  document.getElementById("total-maliyat").textContent = totalMaliyat.toLocaleString("fa-IR");
  document.getElementById("total-mashagel").textContent = totalMashagel.toLocaleString("fa-IR");
  document.getElementById("total-shahrdari").textContent = totalShahrdari.toLocaleString("fa-IR");
}

document.getElementById("add-service").addEventListener("click", () => {
  const sId = document.getElementById("service-select").value;
  if (!sId) return;
  const s = appState.services.find(x => x.id == sId);
  if (s) {
    addServiceToInvoice(s);
    document.getElementById("service-select").value = "";
  }
});

document.getElementById("add-all-services").addEventListener("click", () => {
  appState.services.forEach(addServiceToInvoice);
});

document.getElementById("save-invoice-btn").addEventListener("click", () => {
  if (currentInvoiceItems.length === 0) return alert("فاکتور خالی است!");
  
  const customerId = document.getElementById("invoice-customer").value;
  const desc = document.getElementById("invoice-desc").value;
  
  let items = [];
  let total = 0;
  
  invoiceTableBody.querySelectorAll("tr").forEach(row => {
    const sId = parseInt(row.dataset.serviceId, 10);
    const main = parseInt(row.querySelector(".main-price")?.dataset.trueValue) || 0;
    const extra = parseInt(row.querySelector(".extra-price")?.dataset.trueValue) || 0;
    items.push({ serviceId: sId, mainPrice: main, extraPrice: extra });
    total += (main + extra);
  });

  const invoice = {
    id: "INV-" + Date.now(),
    customerId: customerId || null,
    date: new Date().toISOString(),
    description: desc,
    operator: document.getElementById("invoice-operator").value.trim(),
    items,
    total
  };

  appState.invoices.push(invoice);
  persist();
  alert("فاکتور با موفقیت ذخیره شد.");
  
  // Update print metadata
  const c = appState.customers.find(x => x.id == customerId);
  document.getElementById("print-customer-name").textContent = c ? `مشتری: ${c.name}` : "مشتری عمومی";
  document.getElementById("print-date").textContent = `تاریخ: ${new Date().toLocaleDateString('fa-IR')}`;
  
  // reset
  currentInvoiceItems = [];
  invoiceTableBody.innerHTML = "";
  document.getElementById("invoice-desc").value = "";
  updateInvoiceItems();
});

// =========================================
// View: Invoices List
// =========================================
function renderInvoicesList() {
  const tbody = document.getElementById("invoices-list-body");
  tbody.innerHTML = "";
  // Reverse chronological
  [...appState.invoices].reverse().forEach(inv => {
    const c = appState.customers.find(x => x.id == inv.customerId);
    const cName = c ? c.name : "مشتری عمومی";
    const d = new Date(inv.date).toLocaleDateString("fa-IR");
    
    tbody.innerHTML += `
      <tr>
        <td>${inv.id}</td>
        <td>${d}</td>
        <td>${cName}</td>
        <td class="text-accent">${formatNumber(inv.total)}</td>
        <td>${inv.description || '-'}</td>
        <td>${inv.operator || '-'}</td>
        <td>
          <button class="action-btn delete" onclick="deleteInvoice('${inv.id}')" title="حذف">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
          </button>
        </td>
      </tr>
    `;
  });
}

window.deleteInvoice = (id) => {
  if (confirm("آیا از حذف این فاکتور مطمئن هستید؟")) {
    appState.invoices = appState.invoices.filter(i => i.id !== id);
    persist();
    renderInvoicesList();
  }
};

// =========================================
// View: Customers
// =========================================
document.getElementById("btn-show-add-customer").addEventListener("click", () => {
  const form = document.getElementById("add-customer-form");
  form.style.display = form.style.display === "none" ? "block" : "none";
});

document.getElementById("btn-save-customer").addEventListener("click", () => {
  const name = document.getElementById("new-cust-name").value.trim();
  const phone = document.getElementById("new-cust-phone").value.trim();
  if (!name) return alert("نام مشتری الزامی است.");
  
  const newC = {
    id: "CST-" + Date.now(),
    name,
    phone,
    date: new Date().toISOString()
  };
  appState.customers.push(newC);
  persist();
  
  document.getElementById("new-cust-name").value = "";
  document.getElementById("new-cust-phone").value = "";
  document.getElementById("add-customer-form").style.display = "none";
  renderCustomersList();
});

function renderCustomersList() {
  const tbody = document.getElementById("customers-list-body");
  tbody.innerHTML = "";
  appState.customers.forEach(c => {
    const d = new Date(c.date).toLocaleDateString("fa-IR");
    tbody.innerHTML += `
      <tr>
        <td class="text-muted text-sm">${c.id}</td>
        <td class="font-bold">${c.name}</td>
        <td>${c.phone || '-'}</td>
        <td>${d}</td>
        <td>
          <button class="btn btn-outline" style="padding:0.4rem 0.8rem; font-size:0.8rem" onclick="openCustomerProfile('${c.id}')">
            پروفایل
          </button>
        </td>
      </tr>
    `;
  });
}

// =========================================
// View: Customer Profile
// =========================================
let currentProfileId = null;

window.openCustomerProfile = (id) => {
  currentProfileId = id;
  const c = appState.customers.find(x => x.id === id);
  if (!c) return;
  
  document.getElementById("profile-name").textContent = c.name;
  document.getElementById("profile-phone").textContent = c.phone || "ندارد";
  
  // Invoices
  const tbody = document.getElementById("profile-invoices-body");
  tbody.innerHTML = "";
  const invs = appState.invoices.filter(i => i.customerId === id);
  invs.forEach(inv => {
    tbody.innerHTML += `
      <tr>
        <td>${new Date(inv.date).toLocaleDateString("fa-IR")}</td>
        <td class="text-accent">${formatNumber(inv.total)} تومان</td>
      </tr>
    `;
  });
  if(invs.length === 0) tbody.innerHTML = "<tr><td colspan='2' class='text-center text-muted'>فاکتوری یافت نشد</td></tr>";

  // Docs
  renderProfileDocs();
  showView("view-customer-profile");
};

function renderProfileDocs() {
  const grid = document.getElementById("profile-docs-grid");
  grid.innerHTML = "";
  const docs = appState.documents.filter(d => d.customerId === currentProfileId);
  docs.forEach(doc => {
    const isImg = doc.data.startsWith("data:image");
    const icon = isImg ? "🖼️" : "📄";
    grid.innerHTML += `
      <div class="doc-item" onclick="viewDoc('${doc.id}')">
        <div class="doc-icon">${icon}</div>
        <div class="doc-name" title="${doc.name}">${doc.name}</div>
        <div class="text-sm text-muted mt-1">${new Date(doc.date).toLocaleDateString("fa-IR")}</div>
      </div>
    `;
  });
}

window.viewDoc = (id) => {
  const doc = appState.documents.find(d => d.id === id);
  if(!doc) return;
  // Open in new tab/window
  const win = window.open();
  if (doc.data.startsWith("data:image")) {
    win.document.write(`<img src="${doc.data}" style="max-width:100%; display:block; margin:auto;" />`);
  } else {
    win.document.write(`<iframe src="${doc.data}" style="width:100%; height:100vh; border:none;"></iframe>`);
  }
};

document.getElementById("btn-upload-doc").addEventListener("click", () => {
  const fileInput = document.getElementById("doc-upload-input");
  const nameInput = document.getElementById("doc-upload-name");
  
  if (!fileInput.files.length) return alert("لطفاً یک فایل انتخاب کنید.");
  const file = fileInput.files[0];
  const name = nameInput.value.trim() || file.name;

  const reader = new FileReader();
  reader.onload = (e) => {
    const data = e.target.result;
    appState.documents.push({
      id: "DOC-" + Date.now(),
      customerId: currentProfileId,
      name,
      data,
      date: new Date().toISOString()
    });
    persist();
    renderProfileDocs();
    fileInput.value = "";
    nameInput.value = "";
  };
  reader.readAsDataURL(file);
});

// =========================================
// View: Settings
// =========================================
document.getElementById("set-srv-has-extra").addEventListener("change", (e) => {
  document.getElementById("set-srv-extra-group").style.display = e.target.checked ? "block" : "none";
});

document.getElementById("btn-add-service-setting").addEventListener("click", () => {
  const name = document.getElementById("set-srv-name").value.trim();
  const hasExtra = document.getElementById("set-srv-has-extra").checked;
  const extraLabel = document.getElementById("set-srv-extra-label").value.trim();
  const defMain = parseInt(document.getElementById("set-srv-def-main").value, 10) || 0;
  const defExtra = parseInt(document.getElementById("set-srv-def-extra").value, 10) || 0;

  if (!name) return alert("عنوان خدمت الزامی است.");

  appState.services.push({
    id: Date.now(),
    text: name,
    hasExtra,
    extraLabel,
    defaultMain: defMain,
    defaultExtra: defExtra
  });
  persist();
  
  document.getElementById("set-srv-name").value = "";
  document.getElementById("set-srv-extra-label").value = "";
  document.getElementById("set-srv-def-main").value = "0";
  document.getElementById("set-srv-def-extra").value = "0";
  document.getElementById("set-srv-has-extra").checked = false;
  document.getElementById("set-srv-extra-group").style.display = "none";
  
  renderSettingsServices();
});

function renderSettingsServices() {
  const tbody = document.getElementById("settings-services-body");
  tbody.innerHTML = "";
  appState.services.forEach(s => {
    const extraHtml = s.hasExtra ? s.extraLabel : '<span class="text-muted">ندارد</span>';
    tbody.innerHTML += `
      <tr>
        <td class="font-bold">${s.text}</td>
        <td>${extraHtml}</td>
        <td class="text-sm">
          اصلی: ${formatNumber(s.defaultMain)}<br>
          جانبی: ${formatNumber(s.defaultExtra)}
        </td>
        <td>
          <button class="action-btn delete" onclick="deleteService(${s.id})">حذف</button>
        </td>
      </tr>
    `;
  });
}

window.deleteService = (id) => {
  if(confirm("آیا از حذف این خدمت مطمئن هستید؟")) {
    appState.services = appState.services.filter(s => s.id !== id);
    persist();
    renderSettingsServices();
  }
};

// =========================================
// View: Backup
// =========================================
document.getElementById("btn-export-data").addEventListener("click", () => {
  const dataStr = JSON.stringify(appState);
  const blob = new Blob([dataStr], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `mohaseb_backup_${new Date().toISOString().slice(0,10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
});

document.getElementById("btn-trigger-import").addEventListener("click", () => {
  document.getElementById("import-file-input").click();
});

document.getElementById("import-file-input").addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;
  
  const reader = new FileReader();
  reader.onload = async (ev) => {
    try {
      const data = JSON.parse(ev.target.result);
      if (data && data.services) {
        appState = data;
        await persist();
        alert("اطلاعات با موفقیت بازیابی شد!");
        location.reload();
      } else {
        alert("فایل نامعتبر است.");
      }
    } catch(err) {
      alert("خطا در خواندن فایل: " + err.message);
    }
  };
  reader.readAsText(file);
});

// Boot
window.addEventListener("DOMContentLoaded", initApp);

const themeToggle = document.getElementById('theme-toggle');
themeToggle.addEventListener('click', () => { appState.theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'; document.documentElement.dataset.theme = appState.theme; themeToggle.textContent = appState.theme === 'dark' ? 'حالت روشن' : 'حالت تاریک'; persist(); });
document.querySelectorAll('[data-invoice-save]').forEach(button => button.addEventListener('click', () => document.getElementById('save-invoice-btn').click()));
document.querySelectorAll('[data-invoice-cancel]').forEach(button => button.addEventListener('click', () => { currentInvoiceItems = []; invoiceTableBody.innerHTML = ''; document.getElementById('invoice-desc').value = ''; document.getElementById('invoice-operator').value = ''; updateInvoiceItems(); }));
