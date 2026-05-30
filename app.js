// ============================================
// CONFIGURAÇÕES E CONSTANTES
// ============================================
const CONFIG = {
    webAppUrl: 'https://script.google.com/macros/s/AKfycbyZPP_uF5VpQWYZZDzC-mrxDhjBpGbpHO_Twt7_mnWK71-yqTA7_4N8JjH2oAX7iiLIjQ/exec',
    password: 'baile2026',
    syncInterval: 5 * 60 * 1000,
    version: '2.0.0'
};

const STATUS_CONFIG = {
    livre: { color: 'bg-green-500', border: 'border-green-600', label: 'Livre' },
    negociacao: { color: 'bg-purple-500', border: 'border-purple-600', label: 'Negociação' },
    reservada: { color: 'bg-orange-500', border: 'border-orange-600', label: 'Reservada' },
    patrocinio: { color: 'bg-cyan-500', border: 'border-cyan-600', label: 'Patrocínio' },
    bloqueada: { color: 'bg-gray-500', border: 'border-gray-600', label: 'Bloqueada' }
};

// ============================================
// ESTADO GLOBAL
// ============================================
const State = {
    tables: {},
    currentTableId: null,
    isEditor: false,
    lastSync: null,
    isSyncing: false,
    searchFilter: '',

    init() {
        this.tables = {};
        this.currentTableId = null;
        this.isEditor = localStorage.getItem('baile_editor') === 'true';
        this.lastSync = localStorage.getItem('baile_sync') || null;
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
        if (result?.status === 'success' && result.data) {
            return result.data;
        }
        return {};
    },

    // CORREÇÃO BUG 5: spread operator garante que todos os campos sejam enviados
    async saveTable(table) {
        return await this.fetch('', { ...table });
    }
};

// ============================================
// MÓDULO DE INICIALIZAÇÃO
// ============================================
const Initialize = {
    createTables() {
        for (let i = 1; i <= 48; i++) {
            let status = 'livre';
            if (i <= 4) status = 'reservada';
            if ([12, 24, 36, 48].includes(i)) status = 'patrocinio';

            const row = Math.floor((i - 1) / 12);
            const col = (i - 1) % 12;
            const tableNum = row + 1 + (11 - col) * 4;

            State.tables[`A${i}`] = this.createTableObject(`A${i}`, 'A', tableNum, status);
        }

        for (let i = 1; i <= 48; i++) {
            let status = 'livre';
            if (i % 12 === 11 || i % 12 === 0) status = 'patrocinio';

            const row = Math.floor((i - 1) / 12);
            const col = (i - 1) % 12;
            const tableNum = 48 + row + 1 + (11 - col) * 4;

            State.tables[`B${i}`] = this.createTableObject(`B${i}`, 'B', tableNum, status);
        }
    },

    createTableObject(id, sector, number, status) {
        return {
            id, sector, number, status,
            identification: '', paymentMethod: '', missingAmount: '',
            installmentsCount: '2', installmentsValues: Array(6).fill(''),
            guests: Array(10).fill(''), seller: '', sellerOther: '', saleDate: ''
        };
    },

    async mergeWithServerData() {
        const serverData = await API.loadData();
        if (!serverData) return;

        Object.entries(serverData).forEach(([id, data]) => {
            if (State.tables[id]) {
                Object.assign(State.tables[id], data);
                if (!State.tables[id].installmentsValues) State.tables[id].installmentsValues = Array(6).fill('');
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
        this.map();
        this.list();
    },

    // CORREÇÃO BUG 4: acumula HTML em arrays e atribui uma única vez
    map() {
        const sectorA = document.getElementById('sector-a');
        const sectorB = document.getElementById('sector-b');
        if (!sectorA || !sectorB) return;

        const htmlA = [];
        const htmlB = [];

        Object.values(State.tables).forEach(table => {
            if (table.sector === 'A') htmlA.push(this.createTablePin(table));
            else htmlB.push(this.createTablePin(table));
        });

        sectorA.innerHTML = htmlA.join('');
        sectorB.innerHTML = htmlB.join('');
    },

    createTablePin(table) {
        let statusKey = table.status ? table.status.toLowerCase() : 'livre';
        const config = STATUS_CONFIG[statusKey] || STATUS_CONFIG['livre'];

        const label = table.identification
            ? `<span class="text-[8px] font-medium leading-tight mt-0.5 max-w-[40px] truncate text-center text-white/90">${table.identification}</span>`
            : '';

        return `
            <div onclick="openSheet('${table.id}')"
                 class="table-pin flex flex-col items-center justify-center w-11 h-11 rounded-full border-2 ${config.border} ${config.color} shadow-lg hover:shadow-xl">
                <span class="text-[13px] font-extrabold text-white leading-none">${table.number}</span>
                ${label}
            </div>
        `;
    },

    list(searchText = '') {
        const container = document.getElementById('list-container');
        if (!container) return;

        const lowerSearch = searchText.toLowerCase();
        const sorted = Object.values(State.tables).sort((a, b) => a.number - b.number);

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
        let statusKey = table.status ? table.status.toLowerCase() : 'livre';
        const config = STATUS_CONFIG[statusKey] || STATUS_CONFIG['livre'];
        const name = table.identification || 'Sem responsável';

        return `
            <div onclick="openSheet('${table.id}')" class="bg-[#1c1c20] border border-gray-800 p-4 rounded-2xl flex items-center justify-between hover:border-gray-700 active:scale-[0.98] transition-all duration-200 cursor-pointer">
                <div class="flex items-center gap-3">
                    <div class="w-12 h-12 rounded-full ${config.color} border-2 ${config.border} flex items-center justify-center flex-shrink-0 shadow-md">
                        <span class="text-white font-extrabold text-lg">${table.number}</span>
                    </div>
                    <div class="flex flex-col min-w-0">
                        <span class="text-sm font-bold text-white truncate">${name}</span>
                        <span class="text-[11px] text-gray-400 mt-0.5 flex items-center gap-1">
                            <div class="w-2 h-2 rounded-full ${config.color}"></div>
                            ${config.label}
                        </span>
                    </div>
                </div>
                <i class="ph ph-caret-right text-gray-600 flex-shrink-0"></i>
            </div>
        `;
    }
};

// ============================================
// MÓDULO DE AUTENTICAÇÃO E BOTTOM SHEET
// ============================================
const Auth = {
    showModal() {
        if (State.isEditor) return;
        const modal = document.getElementById('auth-modal');
        modal.classList.add('active');
        modal.querySelector('#auth-password').focus();
        document.getElementById('auth-error').classList.add('hidden');
    },
    closeModal() { document.getElementById('auth-modal').classList.remove('active'); },
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
        const btnUnlock = document.getElementById('btn-unlock');
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
        let statusKey = table.status ? table.status.toLowerCase() : 'livre';
        const config = STATUS_CONFIG[statusKey] || STATUS_CONFIG['livre'];
        document.getElementById('sheet-title').textContent = `Mesa ${table.number}`;
        document.getElementById('sheet-status-indicator').className = `w-4 h-4 rounded-full shadow-[0_0_12px_rgba(34,197,94,0.5)] ${config.color}`;
    },
    fillForm(table) {
        let statusKey = table.status ? table.status.toLowerCase() : 'livre';
        if (!STATUS_CONFIG[statusKey]) statusKey = 'livre';

        document.getElementById('sheet-status').value = statusKey;
        document.getElementById('sheet-identification').value = table.identification || '';
        document.getElementById('sheet-seller').value = table.seller || '';
        document.getElementById('sheet-seller-other').value = table.sellerOther || '';
        document.getElementById('sheet-sale-date').value = table.saleDate || '';
        document.getElementById('sheet-payment-method').value = table.paymentMethod || '';
        document.getElementById('sheet-missing-amount').value = table.missingAmount || '';
        document.getElementById('sheet-installments-count').value = table.installmentsCount || '2';

        const guestsList = document.getElementById('sheet-guests-list');
        guestsList.innerHTML = '';

        for (let i = 0; i < 10; i++) {
            const guestValue = table.guests[i] || '';
            const isReadOnly = !State.isEditor;
            const bgClass = isReadOnly ? 'bg-transparent border-transparent px-0 text-gray-400' : 'bg-[#121214] border border-gray-700 text-white pl-10 pr-4 py-3';

            guestsList.innerHTML += `
                <div class="relative">
                    <div class="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none ${isReadOnly ? 'hidden' : ''}">
                        <span class="text-gray-500 text-[10px] font-bold">${i + 1}</span>
                    </div>
                    <input type="text" id="guest-${i}" value="${guestValue}" placeholder="${isReadOnly ? '—' : 'Nome do convidado...'}" class="w-full text-sm rounded-xl outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-200 ${bgClass}" maxlength="40" ${isReadOnly ? 'readonly' : ''}>
                </div>
            `;
        }
        this.setFieldsDisabled(!State.isEditor);
        this.toggleSellerOther();
        this.togglePaymentFields();
    },
    setFieldsDisabled(disabled) {
        ['sheet-status', 'sheet-identification', 'sheet-seller', 'sheet-sale-date', 'sheet-payment-method', 'sheet-missing-amount', 'sheet-installments-count'].forEach(id => {
            const el = document.getElementById(id); if (el) el.disabled = disabled;
        });
        ['sheet-identification', 'sheet-seller-other', 'sheet-missing-amount', 'sheet-sale-date'].forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                if (disabled) { el.setAttribute('readonly', 'true'); el.classList.add('bg-transparent', 'border-transparent', 'px-0'); }
                else { el.removeAttribute('readonly'); el.classList.remove('bg-transparent', 'border-transparent', 'px-0'); }
            }
        });
    },
    updateUI() {
        const editBadge = document.getElementById('edit-badge');
        const financialSection = document.getElementById('financial-section');
        const viewActions = document.getElementById('view-actions');
        const editActions = document.getElementById('edit-actions');
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
        if (method === 'parcelado') {
            wrapper.classList.remove('hidden'); wrapper.classList.add('flex');
            this.renderInstallmentFields();
        } else {
            wrapper.classList.add('hidden'); wrapper.classList.remove('flex');
        }
    },
    renderInstallmentFields() {
        const table = State.tables[State.currentTableId];
        const count = parseInt(document.getElementById('sheet-installments-count').value) || 2;
        const container = document.getElementById('installments-inputs-container');
        container.innerHTML = '';
        for (let i = 0; i < count; i++) {
            const value = table.installmentsValues[i] || '';
            const isReadOnly = !State.isEditor ? 'readonly' : '';
            const bgClass = State.isEditor ? 'bg-[#121214] border border-gray-700 text-white' : 'bg-transparent border-transparent px-0 text-gray-400';
            container.innerHTML += `<div class="flex flex-col gap-1"><label class="text-[10px] text-gray-500 font-medium">Parcela ${i + 1}</label><input type="text" id="inst-val-${i}" value="${value}" placeholder="R$ 0,00" class="w-full text-sm rounded-xl outline-none p-3 ${bgClass}" maxlength="15" ${isReadOnly}></div>`;
        }
    }
};

// ============================================
// MÓDULO DE SALVAMENTO E NAVEGAÇÃO
// ============================================
const Save = {
    async tableData() {
        if (!State.currentTableId || !State.isEditor) return;
        const table = State.tables[State.currentTableId];

        table.status = document.getElementById('sheet-status').value;
        table.identification = document.getElementById('sheet-identification').value.trim();
        table.seller = document.getElementById('sheet-seller').value;
        table.sellerOther = document.getElementById('sheet-seller-other').value.trim();
        table.saleDate = document.getElementById('sheet-sale-date').value;
        table.paymentMethod = document.getElementById('sheet-payment-method').value;
        table.missingAmount = document.getElementById('sheet-missing-amount').value.trim();
        table.installmentsCount = document.getElementById('sheet-installments-count').value;

        // CORREÇÃO BUG 6: proteção contra elemento null
        for (let i = 0; i < 10; i++) {
            const el = document.getElementById(`guest-${i}`);
            table.guests[i] = el ? el.value.trim() : '';
        }

        table.installmentsValues = Array(6).fill('');
        if (table.paymentMethod === 'parcelado') {
            const count = parseInt(table.installmentsCount);
            for (let i = 0; i < count; i++) {
                const inp = document.getElementById(`inst-val-${i}`);
                if (inp) table.installmentsValues[i] = inp.value.trim();
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
                Render.all(); Sheet.close(); showToast('Mesa salva com sucesso! ✓', 'success');
            } else showToast('Erro ao salvar dados', 'error');
        } catch (error) { showToast('Erro de conexão', 'error'); }
        finally { btn.innerHTML = originalHTML; btn.disabled = false; }
    }
};

const Nav = {
    switchTab(tabName) {
        const tabList = document.getElementById('tab-list');
        const tabMap = document.getElementById('tab-map');
        const navList = document.getElementById('nav-list');
        const navMap = document.getElementById('nav-map');

        if (tabName === 'list') {
            tabList.classList.remove('hidden'); tabMap.classList.add('hidden');
            this.updateNav(navList, true); this.updateNav(navMap, false);
        } else {
            tabMap.classList.remove('hidden'); tabList.classList.add('hidden');
            this.updateNav(navMap, true); this.updateNav(navList, false);
        }
    },
    updateNav(btn, active) {
        if (active) { btn.classList.add('text-blue-500'); btn.classList.remove('text-gray-500'); btn.querySelector('i').classList.add('ph-fill'); }
        else { btn.classList.remove('text-blue-500'); btn.classList.add('text-gray-500'); btn.querySelector('i').classList.remove('ph-fill'); }
    }
};

// ============================================
// MÓDULO PWA
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

            const iosBanner = document.getElementById('ios-banner');
            if (iosBanner) iosBanner.classList.remove('show');

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

        this.checkIos();
    },

    async install() {
        if (!deferredPrompt) {
            showToast('Navegador não suporta atalho nativo.', 'warning');
            return;
        }
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
        localStorage.setItem(id === 'install-banner' ? 'install_dismissed' : 'ios_dismissed', 'true');
    },

    checkIos() {
        const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
        const isStandalone = window.navigator.standalone === true || window.matchMedia('(display-mode: standalone)').matches;
        const dismissed = localStorage.getItem('ios_dismissed');

        if (isIos && !isStandalone && !dismissed) {
            setTimeout(() => {
                if (!deferredPrompt) {
                    const banner = document.getElementById('ios-banner');
                    if (banner) banner.classList.add('show');
                }
            }, 2500);
        }
    }
};

// ============================================
// FUNÇÕES GLOBAIS
// ============================================
window.switchTab = function(tabName) { Nav.switchTab(tabName); }
window.openSheet = function(tableId) { Sheet.open(tableId); }
window.closeSheet = function() { Sheet.close(); }
window.showAuthModal = function() { Auth.showModal(); }
window.closeAuthModal = function() { Auth.closeModal(); }
window.authenticate = function() { Auth.authenticate(document.getElementById('auth-password').value); }
window.saveTableData = function() { Save.tableData(); }
window.filterList = function() { Render.list(document.getElementById('search-input').value); }
window.toggleSellerOther = function() { Sheet.toggleSellerOther(); }
window.togglePaymentFields = function() { Sheet.togglePaymentFields(); }
window.renderInstallmentFields = function() { Sheet.renderInstallmentFields(); }
window.installApp = function() { PWA.install(); }
window.dismissInstallBanner = function() { PWA.hideBanner('install-banner'); }
window.dismissIosBanner = function() { PWA.hideBanner('ios-banner'); }

window.toggleSync = async function() {
    if (State.isSyncing) return;
    State.isSyncing = true;
    const navSync = document.getElementById('nav-sync');
    navSync.classList.add('animate-spin');
    try {
        await Initialize.mergeWithServerData();
        Render.all();
        showToast('Sincronizado com sucesso! ✓', 'success');
    } catch (error) { showToast('Erro ao sincronizar', 'error'); }
    finally { State.isSyncing = false; navSync.classList.remove('animate-spin'); }
}

function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    toast.querySelector('div').textContent = message;
    toast.classList.remove('bg-green-600', 'bg-red-600', 'bg-yellow-600');
    toast.classList.add(type === 'error' ? 'bg-red-600' : type === 'warning' ? 'bg-yellow-600' : 'bg-green-600');
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

        // CORREÇÃO BUG 8: evento registrado após o DOM estar pronto
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
