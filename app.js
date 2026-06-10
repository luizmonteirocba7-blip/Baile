// ============================================
// CONFIGURAÇÕES E CONSTANTES
// ============================================
const CONFIG = {
    webAppUrl: 'https://script.google.com/macros/s/AKfycbyZPP_uF5VpQWYZZDzC-mrxDhjBpGbpHO_Twt7_mnWK71-yqTA7_4N8JjH2oAX7iiLIjQ/exec',
    password: 'baile2026',
    syncInterval: 5 * 60 * 1000,
    version: '3.1.0'
};

const STATUS_CONFIG = {
    livre:      { bg: 'rgba(34,197,94,0.80)',   border: '#4ade80', glow: '0 0 12px rgba(34,197,94,0.5)',    glowStrong: '0 0 22px rgba(34,197,94,0.8)',    wave: 'rgba(34,197,94,0.6)',   indicator: '#22c55e', label: 'Livre' },
    negociacao: { bg: 'rgba(168,85,247,0.80)',  border: '#c084fc', glow: '0 0 12px rgba(168,85,247,0.5)',   glowStrong: '0 0 22px rgba(168,85,247,0.8)',   wave: 'rgba(168,85,247,0.6)',  indicator: '#a855f7', label: 'Negociação' },
    reservada:  { bg: 'rgba(249,115,22,0.80)',  border: '#fb923c', glow: '0 0 12px rgba(249,115,22,0.5)',   glowStrong: '0 0 22px rgba(249,115,22,0.8)',   wave: 'rgba(249,115,22,0.6)',  indicator: '#f97316', label: 'Reservada' },
    patrocinio: { bg: 'rgba(6,182,212,0.80)',   border: '#22d3ee', glow: '0 0 12px rgba(6,182,212,0.5)',    glowStrong: '0 0 22px rgba(6,182,212,0.8)',    wave: 'rgba(6,182,212,0.6)',   indicator: '#06b6d4', label: 'Patrocínio' },
    bloqueada:  { bg: 'rgba(107,114,128,0.75)', border: '#9ca3af', glow: '0 0 8px rgba(107,114,128,0.3)',   glowStrong: '0 0 14px rgba(107,114,128,0.5)',  wave: 'rgba(107,114,128,0.4)', indicator: '#6b7280', label: 'Bloqueada' }
};

// Configuração de cor para mesa com parcela Atrasada
const STATUS_OVERDUE = { 
    bg: 'rgba(220,38,38,0.85)', 
    border: '#ef4444', 
    glow: '0 0 12px rgba(220,38,38,0.5)', 
    glowStrong: '0 0 22px rgba(220,38,38,0.8)', 
    wave: 'rgba(220,38,38,0.6)', 
    indicator: '#dc2626', 
    label: 'Atrasada' 
};

// ============================================
// LÓGICA DE VENCIMENTO DE PARCELAS
// ============================================
function isTableOverdue(table) {
    if (table.status === 'livre' || table.status === 'bloqueada') return false;
    if (table.paymentMethod !== 'pix' && table.paymentMethod !== 'parcelado') return false;
    if (!table.saleDate) return false;

    // Converter a data do formato YYYY-MM-DD com segurança de fuso horário
    const [year, month, day] = table.saleDate.split('-');
    const sale = new Date(year, month - 1, day);
    const today = new Date();
    
    // Diferença em dias desde a venda
    const diffTime = today - sale;
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    // Quantas parcelas JÁ DEVERIAM estar pagas? (A cada 30 dias vence uma)
    let expectedPaid = Math.floor(diffDays / 30);
    
    const totalInst = parseInt(table.installmentsCount) || 2;
    if (expectedPaid > totalInst) expectedPaid = totalInst;

    // Quantas estão marcadas como pagas manualmente pelo admin?
    let actualPaid = 0;
    for (let i = 0; i < totalInst; i++) {
        if (table.installmentsPaid && table.installmentsPaid[i] === true) {
            actualPaid++;
        }
    }

    // Se o esperado for maior que o que foi pago na vida real, está atrasado.
    return expectedPaid > actualPaid;
}


// ============================================
// LAYOUT DO MAPA — Matriz de posições
// ============================================
const GRID_TOP    = 0.250;
const GRID_LEFT   = 0.260;
const GRID_WIDTH  = 0.480;
const GRID_HEIGHT = 0.485;
const GRID_COLS   = 12;
const GRID_ROWS   = 8;
const PIN_SIZE    = 38;

const LAYOUT_MATRIX = [
    [78, 75, 69, 63, 57, 49, 41, 33, 25, 17,  9,  1],
    [79, 76, 70, 64, 58, 50, 42, 34, 26, 18, 10,  2],
    [80, 77, 71, 65, 59, 51, 43, 35, 27, 19, 11,  3],
    [ 0,  0, 72, 66, 60, 52, 44, 36, 28, 20, 12,  4],
    [ 0,  0, 73, 67, 61, 53, 45, 37, 29, 21, 13,  5],
    [ 0,  0, 74, 68, 62, 54, 46, 38, 30, 22, 14,  6],
    [ 0,  0,  0,  0,  0, 55, 47, 39, 31, 23, 15,  7],
    [ 0,  0,  0,  0,  0, 56, 48, 40, 32, 24, 16,  8],
];

function cellToPercent(row, col) {
    const cellW = GRID_WIDTH  / GRID_COLS;
    const cellH = GRID_HEIGHT / GRID_ROWS;

    let topBase, leftBase, rowCalculada;

    if (row <= 2) {
        topBase = 0.215; leftBase = 0.260; rowCalculada = row; 
    } else {
        topBase = 0.450; leftBase = 0.260; rowCalculada = row - 3; 
    }

    let topPercent = topBase + (cellH * rowCalculada);
    let leftPercent = leftBase + (cellW * col);

    if (col >= 5) leftPercent += 0.010; 
    if (row <= 2 && col <= 4) { topPercent += 0.000; leftPercent += 0.000; }
    if (row <= 2 && col >= 5) { topPercent += 0.000; leftPercent += 0.000; }
    if (row >= 3 && col >= 5) { topPercent += -0.010; leftPercent += 0.000; }
    if (row >= 6) { topPercent += 0.001; }
    if (row >= 3 && col <= 4) { topPercent += -0.010; leftPercent += 0.000; }

    return {
        top:  (topPercent + cellH / 2) * 100,
        left: (leftPercent + cellW / 2) * 100,
    };
}

// ============================================
// ESTADO GLOBAL
// ============================================
const State = {
    tables: {},
    currentTableId: null,
    isEditor: false,
    isSyncing: false,

    init() {
        this.tables = {};
        this.currentTableId = null;
        this.isEditor = localStorage.getItem('baile_editor') === 'true';
    }
};

// ============================================
// MÓDULO DE API
// ============================================
const API = {
    async fetch(endpoint = '', data = null) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);
        try {
            const options = {
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                signal: controller.signal
            };
            if (data) {
                options.method = 'POST';
                options.body = JSON.stringify(data);
            }
            const response = await fetch(CONFIG.webAppUrl + endpoint, options);
            clearTimeout(timeoutId);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return await response.json();
        } catch (error) {
            clearTimeout(timeoutId);
            console.error('Erro na API:', error);
            showToast('Usando dados offline.', 'warning');
            return null;
        }
    },

    async loadData() {
        const result = await this.fetch();
        if (result?.status === 'success' && result.data) return result.data;
        return {};
    },

    async saveTable(table) {
        return await this.fetch('', { ...table });
    }
};

// ============================================
// MÓDULO DE INICIALIZAÇÃO
// ============================================
const Initialize = {
    createTables() {
        for (let i = 1; i <= 80; i++) {
            State.tables[`T${i}`] = {
                id: `T${i}`,
                number: String(i).padStart(2, '0'),
                status: 'livre',
                identification: '',
                observation: '',
                paymentMethod: '',
                missingAmount: '',
                installmentsCount: '2',
                installmentsValues: Array(6).fill(''),
                installmentsPaid: Array(6).fill(false), // <--- CAMPO DE CONTROLE DE PARCELAS PAGAS
                guests: Array(10).fill(''),
                seller: '',
                sellerOther: '',
                saleDate: ''
            };
        }
    },

    async mergeWithServerData() {
        const serverData = await API.loadData();
        if (!serverData) return;
        Object.entries(serverData).forEach(([id, data]) => {
            if (State.tables[id]) {
                Object.assign(State.tables[id], data);
                if (!State.tables[id].installmentsValues) State.tables[id].installmentsValues = Array(6).fill('');
                if (!State.tables[id].installmentsPaid) State.tables[id].installmentsPaid = Array(6).fill(false);
                if (!State.tables[id].guests) State.tables[id].guests = Array(10).fill('');
            }
        });
    }
};

// ============================================
// MÓDULO DE RENDERIZAÇÃO
// ============================================
const Render = {
    all() {
        this.pins();
        this.list();
        this.stats();
    },

    pins() {
        const layer = document.getElementById('pins-layer');
        if (!layer) return;

        let html = '';
        LAYOUT_MATRIX.forEach((row, ri) => {
            row.forEach((num, ci) => {
                if (num === 0) return;
                const table = State.tables[`T${num}`];
                if (!table) return;

                // VERIFICA SE ESTÁ ATRASADO PARA SUBSTITUIR A COR
                let cfg = STATUS_CONFIG[table.status] || STATUS_CONFIG['livre'];
                if (isTableOverdue(table)) {
                    cfg = STATUS_OVERDUE;
                }

                const { top, left } = cellToPercent(ri, ci);
                const waveDelay = ((num * 137) % 2400) / 1000;
                const idHtml = table.identification ? `<span class="pin-id">${table.identification}</span>` : '';

                html += `
                <div class="table-pin" onclick="openSheet('T${num}')"
                    style="top:${top}%; left:${left}%;
                           width:${PIN_SIZE}px; height:${PIN_SIZE}px;
                           background:${cfg.bg}; border-color:${cfg.border};
                           --pin-glow:${cfg.glow}; --pin-glow-strong:${cfg.glowStrong};
                           animation-delay:${waveDelay}s; backdrop-filter:blur(2px);">
                    <span class="wave wave-1" style="border-color:${cfg.wave}; animation-delay:${waveDelay}s"></span>
                    <span class="wave wave-2" style="border-color:${cfg.wave}; animation-delay:${waveDelay + 0.6}s"></span>
                    <span class="wave wave-3" style="border-color:${cfg.wave}; animation-delay:${waveDelay + 1.2}s"></span>
                    <span class="pin-num">${table.number}</span>
                    ${idHtml}
                </div>`;
            });
        });
        layer.innerHTML = html;
    },

    stats() {
        const counts = { livre: 0, negociacao: 0, reservada: 0, patrocinio: 0, bloqueada: 0 };
        Object.values(State.tables).forEach(t => {
            if (counts[t.status] !== undefined) counts[t.status]++;
        });
        const el = id => document.getElementById(id);
        el('cnt-livre')      && (el('cnt-livre').textContent      = counts.livre);
        el('cnt-negociacao') && (el('cnt-negociacao').textContent = counts.negociacao);
        el('cnt-reservada')  && (el('cnt-reservada').textContent  = counts.reservada);
        el('cnt-patrocinio') && (el('cnt-patrocinio').textContent = counts.patrocinio);
        el('cnt-bloqueada')  && (el('cnt-bloqueada').textContent  = counts.bloqueada);
    },

    list(searchText = '') {
        const container = document.getElementById('list-container');
        if (!container) return;

        const lowerSearch = searchText.toLowerCase();
        const sorted = Object.values(State.tables).sort((a, b) => parseInt(a.number) - parseInt(b.number));

        const filtered = sorted.filter(table => {
            if (!searchText) return true;
            const ident = table.identification ? String(table.identification).toLowerCase() : '';
            return table.number.toString().includes(lowerSearch) || ident.includes(lowerSearch);
        });

        if (filtered.length === 0) {
            container.innerHTML = '<div class="col-span-full text-center text-gray-500 py-12 text-sm">Nenhuma mesa encontrada</div>';
            return;
        }

        container.innerHTML = filtered.map(table => this.createListCard(table)).join('');
    },

    createListCard(table) {
        let cfg = STATUS_CONFIG[table.status] || STATUS_CONFIG['livre'];
        if (isTableOverdue(table)) {
            cfg = STATUS_OVERDUE;
        }
        
        const name = table.identification || 'Sem responsável';

        return `
            <div onclick="openSheet('${table.id}')" class="bg-white/[0.04] border border-white/[0.08] p-4 rounded-2xl flex items-center justify-between hover:border-white/20 active:scale-[0.98] transition-all duration-200 cursor-pointer">
                <div class="flex items-center gap-3">
                    <div class="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 shadow-md border-2"
                         style="background:${cfg.bg}; border-color:${cfg.border}; box-shadow:${cfg.glow}">
                        <span class="text-white font-extrabold text-base">${table.number}</span>
                    </div>
                    <div class="flex flex-col min-w-0">
                        <span class="text-sm font-bold text-white truncate">${name}</span>
                        <span class="text-[11px] text-gray-400 mt-0.5 flex items-center gap-1.5">
                            <span class="w-2 h-2 rounded-full inline-block" style="background:${cfg.indicator}; box-shadow:0 0 5px ${cfg.indicator}"></span>
                            ${cfg.label}
                        </span>
                    </div>
                </div>
                <i class="ph ph-caret-right text-gray-600 flex-shrink-0"></i>
            </div>
        `;
    }
};

// ============================================
// MÓDULO DE AUTENTICAÇÃO
// ============================================
const Auth = {
    showModal() {
        if (State.isEditor) return;
        const modal = document.getElementById('auth-modal');
        modal.classList.add('active');
        document.getElementById('auth-password').value = '';
        document.getElementById('auth-password').focus();
        document.getElementById('auth-error').classList.add('hidden');
    },
    closeModal() {
        document.getElementById('auth-modal').classList.remove('active');
    },
    authenticate(password) {
        const error = document.getElementById('auth-error');
        error.classList.add('hidden');
        if (password !== CONFIG.password) {
            error.classList.remove('hidden');
            return false;
        }
        State.isEditor = true;
        localStorage.setItem('baile_editor', 'true');
        this.closeModal();
        this.updateUI();
        if (State.currentTableId) Sheet.open(State.currentTableId);
        showToast('Modo edição ativado.', 'success');
        return true;
    },
    updateUI() {
        const btnUnlock    = document.getElementById('btn-unlock');
        const badgeUnlocked = document.getElementById('badge-unlocked');
        if (!btnUnlock || !badgeUnlocked) return;
        if (State.isEditor) {
            btnUnlock.classList.add('hidden');
            badgeUnlocked.classList.remove('hidden');
            badgeUnlocked.classList.add('flex');
        } else {
            btnUnlock.classList.remove('hidden');
            badgeUnlocked.classList.add('hidden');
            badgeUnlocked.classList.remove('flex');
        }
    }
};

// ============================================
// BOTTOM SHEET
// ============================================
const Sheet = {
    open(tableId) {
        State.currentTableId = tableId;
        const table = State.tables[tableId];
        if (!table) return;
        this.updateHeader(table);
        this.fillForm(table);
        this.updateUI();
        document.getElementById('sheet-overlay').classList.add('active');
        document.getElementById('bottom-sheet').classList.add('active');
    },
    close() {
        document.getElementById('sheet-overlay').classList.remove('active');
        document.getElementById('bottom-sheet').classList.remove('active');
        setTimeout(() => { State.currentTableId = null; }, 300);
    },
    updateHeader(table) {
        let cfg = STATUS_CONFIG[table.status] || STATUS_CONFIG['livre'];
        if (isTableOverdue(table)) {
            cfg = STATUS_OVERDUE;
        }

        document.getElementById('sheet-title').textContent = `Mesa ${table.number}`;
        const indicator = document.getElementById('sheet-status-indicator');
        indicator.style.background  = cfg.indicator;
        indicator.style.boxShadow   = cfg.glow;
    },
    fillForm(table) {
        let statusKey = table.status || 'livre';
        if (!STATUS_CONFIG[statusKey]) statusKey = 'livre';

        document.getElementById('sheet-status').value           = statusKey;
        document.getElementById('sheet-identification').value   = table.identification || '';
        document.getElementById('sheet-observation').value      = table.observation || '';
        document.getElementById('sheet-seller').value           = table.seller || '';
        document.getElementById('sheet-seller-other').value     = table.sellerOther || '';
        document.getElementById('sheet-sale-date').value        = table.saleDate || '';
        document.getElementById('sheet-payment-method').value   = table.paymentMethod || '';
        document.getElementById('sheet-missing-amount').value   = table.missingAmount || '';
        document.getElementById('sheet-installments-count').value = table.installmentsCount || '2';

        const guestsList = document.getElementById('sheet-guests-list');
        guestsList.innerHTML = '';
        for (let i = 0; i < 10; i++) {
            const val = table.guests[i] || '';
            const readOnly = !State.isEditor;
            guestsList.innerHTML += `
                <div class="relative flex items-center gap-2">
                    <span class="text-[10px] font-bold text-gray-600 w-4 text-right flex-shrink-0">${i + 1}</span>
                    <input type="text" id="guest-${i}" value="${val}"
                        placeholder="${readOnly ? '— Vazio —' : 'Nome do convidado...'}"
                        class="w-full bg-[#121214] border border-gray-700 text-white text-sm rounded-xl p-3 focus:ring-2 focus:ring-blue-500 outline-none placeholder-gray-600 transition-all flex-1"
                        maxlength="40" ${readOnly ? 'readonly' : ''}>
                </div>`;
        }

        this.setFieldsDisabled(!State.isEditor);
        this.toggleSellerOther();
        this.togglePaymentFields();
    },
    setFieldsDisabled(disabled) {
        ['sheet-status', 'sheet-seller', 'sheet-payment-method', 'sheet-installments-count'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.disabled = disabled;
        });
        ['sheet-identification', 'sheet-seller-other', 'sheet-missing-amount', 'sheet-sale-date', 'sheet-observation'].forEach(id => {
            const el = document.getElementById(id);
            if (!el) return;
            if (disabled) el.setAttribute('readonly', 'true');
            else el.removeAttribute('readonly');
        });
    },
    updateUI() {
        const editBadge       = document.getElementById('edit-badge');
        const financialSection = document.getElementById('financial-section');
        const viewActions     = document.getElementById('view-actions');
        const editActions     = document.getElementById('edit-actions');
        if (!editBadge) return;

        if (State.isEditor) {
            editBadge.classList.remove('hidden');
            financialSection.classList.remove('hidden'); financialSection.classList.add('flex');
            viewActions.classList.add('hidden');
            editActions.classList.remove('hidden'); editActions.classList.add('flex');
        } else {
            editBadge.classList.add('hidden');
            financialSection.classList.add('hidden'); financialSection.classList.remove('flex');
            editActions.classList.add('hidden'); editActions.classList.remove('flex');
            viewActions.classList.remove('hidden');
        }
    },
    toggleSellerOther() {
        const seller = document.getElementById('sheet-seller').value;
        document.getElementById('sheet-seller-other').classList.toggle('hidden', seller !== 'Outros');
    },
    togglePaymentFields() {
        const method = document.getElementById('sheet-payment-method').value;
        const wrapper = document.getElementById('installments-wrapper');
        if (method === 'parcelado' || method === 'pix') {
            wrapper.classList.remove('hidden'); wrapper.classList.add('flex');
            this.renderInstallmentFields();
        } else {
            wrapper.classList.add('hidden'); wrapper.classList.remove('flex');
        }
    },
    renderInstallmentFields() {
        const table = State.tables[State.currentTableId];
        if (!table) return;
        const count = parseInt(document.getElementById('sheet-installments-count').value) || 2;
        const container = document.getElementById('installments-inputs-container');
        container.innerHTML = '';
        for (let i = 0; i < count; i++) {
            const value = table.installmentsValues[i] || '';
            
            // Lógica do checkmark de pagamento
            const isPaid = table.installmentsPaid && table.installmentsPaid[i] ? 'checked' : '';
            const readOnly = !State.isEditor ? 'disabled' : '';

            container.innerHTML += `
                <div class="flex flex-col gap-2 p-3 border border-gray-800 rounded-xl bg-gray-900/40 relative">
                    <div class="flex justify-between items-center mb-1">
                        <label class="text-[11px] text-gray-400 font-semibold uppercase tracking-wide">Parcela ${i + 1}</label>
                        <label class="flex items-center gap-1.5 text-[10px] uppercase font-bold text-gray-300 cursor-pointer select-none">
                            <input type="checkbox" id="inst-paid-${i}" class="w-3.5 h-3.5 rounded accent-green-500" ${isPaid} ${readOnly}>
                            Pago
                        </label>
                    </div>
                    <input type="text" id="inst-val-${i}" value="${value}" placeholder="R$ 0,00"
                        class="w-full bg-[#121214] border border-gray-700 text-white text-sm rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 outline-none placeholder-gray-600 transition-all" 
                        maxlength="15" ${readOnly ? 'readonly' : ''}>
                </div>`;
        }
    }
};

// ============================================
// MÓDULO DE SALVAMENTO
// ============================================
const Save = {
    async tableData() {
        if (!State.currentTableId || !State.isEditor) return;
        const table = State.tables[State.currentTableId];

        table.status           = document.getElementById('sheet-status').value;
        table.identification   = document.getElementById('sheet-identification').value.trim();
        table.observation      = document.getElementById('sheet-observation').value.trim();
        table.seller           = document.getElementById('sheet-seller').value;
        table.sellerOther      = document.getElementById('sheet-seller-other').value.trim();
        table.saleDate         = document.getElementById('sheet-sale-date').value;
        table.paymentMethod    = document.getElementById('sheet-payment-method').value;
        table.missingAmount    = document.getElementById('sheet-missing-amount').value.trim();
        table.installmentsCount = document.getElementById('sheet-installments-count').value;

        for (let i = 0; i < 10; i++) {
            const el = document.getElementById(`guest-${i}`);
            table.guests[i] = el ? el.value.trim() : '';
        }

        table.installmentsValues = Array(6).fill('');
        table.installmentsPaid = Array(6).fill(false); // Zeramos e repopulamos o controle de pagos
        
        if (table.paymentMethod === 'parcelado' || table.paymentMethod === 'pix') {
            const count = parseInt(table.installmentsCount);
            for (let i = 0; i < count; i++) {
                const inp = document.getElementById(`inst-val-${i}`);
                if (inp) table.installmentsValues[i] = inp.value.trim();

                const chk = document.getElementById(`inst-paid-${i}`);
                if (chk) table.installmentsPaid[i] = chk.checked;
            }
        }

        await this.submit(table);
    },

    async submit(table) {
        const btn = document.getElementById('save-btn');
        const originalHTML = btn.innerHTML;
        btn.innerHTML = '<i class="ph ph-circle-notch animate-spin"></i> Salvando...';
        btn.disabled = true;
        try {
            const result = await API.saveTable(table);
            if (result?.status === 'success') {
                Render.all();
                Sheet.close();
                showToast('Alterações salvas com sucesso! ✓', 'success');
            } else {
                showToast('Erro ao salvar dados', 'error');
            }
        } catch (error) {
            showToast('Erro de conexão', 'error');
        } finally {
            btn.innerHTML = originalHTML;
            btn.disabled = false;
        }
    }
};

// ============================================
// NAVEGAÇÃO
// ============================================
const Nav = {
    switchTab(tabName) {
        const tabList = document.getElementById('tab-list');
        const tabMap  = document.getElementById('tab-map');
        const navList = document.getElementById('nav-list');
        const navMap  = document.getElementById('nav-map');

        if (tabName === 'list') {
            tabList.classList.remove('hidden'); tabMap.classList.add('hidden');
            this.updateNav(navList, true); this.updateNav(navMap, false);
        } else {
            tabMap.classList.remove('hidden'); tabList.classList.add('hidden');
            this.updateNav(navMap, true); this.updateNav(navList, false);
        }
    },
    updateNav(btn, active) {
        if (active) {
            btn.classList.add('text-[#c8a45a]'); btn.classList.remove('text-gray-500');
            btn.querySelector('i').classList.add('ph-fill');
        } else {
            btn.classList.remove('text-[#c8a45a]'); btn.classList.add('text-gray-500');
            btn.querySelector('i').classList.remove('ph-fill');
        }
    }
};

// ============================================
// PWA
// ============================================
let deferredPrompt = null;

const PWA = {
    init() {
        if ('serviceWorker' in navigator) {
            window.addEventListener('load', () => {
                navigator.serviceWorker.register('service-worker.js')
                    .catch(err => console.log('Erro no Service Worker:', err));
            });
        }
        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            deferredPrompt = e;
            if (!localStorage.getItem('install_dismissed')) {
                setTimeout(() => {
                    const banner = document.getElementById('install-banner');
                    if (banner) banner.classList.add('show');
                }, 1000);
            }
        });
        window.addEventListener('appinstalled', () => {
            this.hideBanner('install-banner');
            deferredPrompt = null;
            showToast('App instalado com sucesso! ✓', 'success');
        });
    },
    async install() {
        if (!deferredPrompt) { showToast('Navegador não suporta atalho nativo.', 'warning'); return; }
        try {
            deferredPrompt.prompt();
            const { outcome } = await deferredPrompt.userChoice;
            if (outcome === 'accepted') this.hideBanner('install-banner');
        } catch (error) { console.error(error); }
        finally { deferredPrompt = null; }
    },
    hideBanner(id) {
        const banner = document.getElementById(id);
        if (banner) banner.classList.remove('show');
        localStorage.setItem('install_dismissed', 'true');
    }
};

// ============================================
// FUNÇÕES GLOBAIS
// ============================================
window.switchTab          = (tab)  => Nav.switchTab(tab);
window.openSheet          = (id)   => Sheet.open(id);
window.closeSheet         = ()     => Sheet.close();
window.showAuthModal      = ()     => Auth.showModal();
window.closeAuthModal     = ()     => Auth.closeModal();
window.authenticate       = ()     => Auth.authenticate(document.getElementById('auth-password').value);
window.saveTableData      = ()     => Save.tableData();
window.filterList         = ()     => Render.list(document.getElementById('search-input').value);
window.toggleSellerOther  = ()     => Sheet.toggleSellerOther();
window.togglePaymentFields = ()    => Sheet.togglePaymentFields();
window.renderInstallmentFields = () => Sheet.renderInstallmentFields();
window.installApp         = ()     => PWA.install();
window.dismissInstallBanner = ()   => PWA.hideBanner('install-banner');

window.toggleSync = async function() {
    if (State.isSyncing) return;
    State.isSyncing = true;
    const navSync = document.getElementById('nav-sync');
    navSync.classList.add('animate-spin');
    try {
        await Initialize.mergeWithServerData();
        Render.all();
        showToast('Sincronizado com sucesso! ✓', 'success');
    } catch (error) {
        showToast('Erro ao sincronizar', 'error');
    } finally {
        State.isSyncing = false;
        navSync.classList.remove('animate-spin');
    }
};

function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    toast.querySelector('div').textContent = message;
    toast.classList.remove('bg-gradient-to-r', 'from-emerald-600', 'to-green-500', 'from-red-600', 'to-red-500', 'from-yellow-600', 'to-yellow-500');
    if (type === 'error') {
        toast.style.background = 'linear-gradient(135deg,#dc2626,#ef4444)';
    } else if (type === 'warning') {
        toast.style.background = 'linear-gradient(135deg,#d97706,#f59e0b)';
    } else {
        toast.style.background = 'linear-gradient(135deg,#059669,#10b981)';
    }
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3000);
}

// ============================================
// INICIALIZAÇÃO
// ============================================
async function initApp() {
    try {
        State.init();
        Initialize.createTables();
        PWA.init();

        await Initialize.mergeWithServerData();

        Render.all();
        Auth.updateUI();

        document.getElementById('sheet-overlay')?.addEventListener('touchmove', e => e.preventDefault(), { passive: false });

    } catch (error) {
        console.error('Erro Fatal na Inicialização:', error);
        Render.all();
    } finally {
        const loader = document.getElementById('loading-overlay');
        if (loader) {
            loader.classList.add('opacity-0', 'pointer-events-none');
            setTimeout(() => loader.remove(), 500);
        }
    }

    setInterval(async () => {
        try { await Initialize.mergeWithServerData(); Render.all(); } catch(e) {}
    }, CONFIG.syncInterval);
}

// Fallback: remove loading após 8s se travar
setTimeout(() => {
    const loader = document.getElementById('loading-overlay');
    if (loader && !loader.classList.contains('opacity-0')) {
        loader.classList.add('opacity-0', 'pointer-events-none');
        setTimeout(() => loader.remove(), 500);
        showToast('Demora na rede. Operando offline.', 'warning');
    }
}, 8000);

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}
