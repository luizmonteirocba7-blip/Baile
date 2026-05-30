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
    },

    setEditor(value) {
        this.isEditor = value;
        localStorage.setItem('baile_editor', value);
    },

    updateLastSync() {
        this.lastSync = new Date().toISOString();
        localStorage.setItem('baile_sync', this.lastSync);
    }
};

// ============================================
// MÓDULO DE API
// ============================================
const API = {
    async fetch(endpoint = '', data = null) {
        try {
            const options = {
                headers: { 'Content-Type': 'text/plain;charset=utf-8' }
            };

            if (data) {
                options.method = 'POST';
                options.body = JSON.stringify(data);
            }

            const response = await fetch(CONFIG.webAppUrl + endpoint, options);

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error('Erro na API:', error);
            showToast('Conexão instável. Usando dados locais.', 'warning');
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

    async saveTable(table) {
        return await this.fetch('', {
            id: table.id,
            number: table.number,
            status: table.status,
            identification: table.identification,
            seller: table.seller,
            sellerOther: table.sellerOther,
            saleDate: table.saleDate,
            paymentMethod: table.paymentMethod,
            missingAmount: table.missingAmount,
            installmentsCount: table.installmentsCount,
            installmentsValues: table.installmentsValues,
            guests: table.guests
        });
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
            identification: '',
            paymentMethod: '',
            missingAmount: '',
            installmentsCount: '2',
            installmentsValues: Array(6).fill(''),
            guests: Array(10).fill(''),
            seller: '',
            sellerOther: '',
            saleDate: ''
        };
    },

    async mergeWithServerData() {
        const serverData = await API.loadData();

        Object.entries(serverData).forEach(([id, data]) => {
            if (State.tables[id]) {
                Object.assign(State.tables[id], data);
                if (!State.tables[id].installmentsValues) {
                    State.tables[id].installmentsValues = Array(6).fill('');
                }
                if (!State.tables[id].guests) {
                    State.tables[id].guests = Array(10).fill('');
                }
            }
        });

        State.updateLastSync();
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

    map() {
        const sectorA = document.getElementById('sector-a');
        const sectorB = document.getElementById('sector-b');
        
        if(!sectorA || !sectorB) return; 
        
        sectorA.innerHTML = '';
        sectorB.innerHTML = '';

        Object.values(State.tables).forEach(table => {
            const pinHTML = this.createTablePin(table);
            const sector = table.sector === 'A' ? sectorA : sectorB;
            sector.innerHTML += pinHTML;
        });
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
        if(!container) return;

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
// MÓDULO DE AUTENTICAÇÃO
// ============================================
const Auth = {
    showModal() {
        if (State.isEditor) return;
        const modal = document.getElementById('auth-modal');
        modal.classList.add('active');
        modal.querySelector('#auth-password').focus();
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

        State.setEditor(true);
        this.closeModal();
        this.updateUI();

        if (State.currentTableId) {
            Sheet.open(State.currentTableId);
        }

        showToast('Acesso desbloqueado! Modo edição ativado.', 'success');
        return true;
    },

    updateUI() {
        const btnUnlock = document.getElementById('btn-unlock');
        const badgeUnlocked = document.getElementById('badge-unlocked');
        
        if(!btnUnlock || !badgeUnlocked) return;

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
// MÓDULO DO BOTTOM SHEET
// ============================================
const Sheet = {
    open(tableId) {
        State.currentTableId = tableId;
        const table = State.tables[tableId];
        if (!table) return;

        this.updateHeader(table);
        this.fillForm(table);
        this.updateUI();
        this.show();
    },

    close() {
        document.getElementById('sheet-overlay').classList.remove('active');
        document.getElementById('bottom-sheet').classList.remove('active');
        setTimeout(() => { State.currentTableId = null; }, 300);
    },

    show() {
        document.getElementById('sheet-overlay').classList.add('active');
        document.getElementById('bottom-sheet').classList.add('active');
    },

    updateHeader(table) {
        let statusKey = table.status ? table.status.toLowerCase() : 'livre';
        const config = STATUS_CONFIG[statusKey] || STATUS_CONFIG['livre'];
        
        document.getElementById('sheet-title').textContent = `Mesa ${table.number}`;
        document.getElementById('sheet-status-indicator').className = `w-4 h-4 rounded-full shadow-[0_0_12px_rgba(34,197,94,0.5)] ${config.color}`;
    },

    fillForm(table) {
        let statusKey = table.status ? table.status.toLowerCase() : 'livre';
        if(!STATUS_CONFIG[statusKey]) statusKey = 'livre';
        
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
            const bgClass = isReadOnly
                ? 'bg-transparent border-transparent px-0 text-gray-400'
                : 'bg-[#121214] border border-gray-700 text-white pl-10 pr-4 py-3';

            guestsList.innerHTML += `
                <div class="relative">
                    <div class="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none ${isReadOnly ? 'hidden' : ''}">
                        <span class="text-gray-500 text-[10px] font-bold">${i + 1}</span>
                    </div>
                    <input
                        type="text"
                        id="guest-${i}"
                        value="${guestValue}"
                        placeholder="${isReadOnly ? '—' : 'Nome do convidado...'}"
                        class="w-full text-sm rounded-xl outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-200 ${bgClass}"
                        maxlength="40"
                        ${isReadOnly ? 'readonly' : ''}>
                </div>
            `;
        }

        this.setFieldsDisabled(!State.isEditor);
        this.toggleSellerOther();
        this.togglePaymentFields();
    },

    setFieldsDisabled(disabled) {
        const mainFields = ['sheet-status', 'sheet-identification', 'sheet-seller', 'sheet-sale-date', 'sheet-payment-method', 'sheet-missing-amount', 'sheet-installments-count'];
        mainFields.forEach(id => {
            const el = document.getElementById(id);
            if(el) el.disabled = disabled;
        });

        const textFields = ['sheet-identification', 'sheet-seller-other', 'sheet-missing-amount', 'sheet-sale-date'];
        textFields.forEach(id => {
            const el = document.getElementById(id);
            if(el) {
                if (disabled) {
                    el.setAttribute('readonly', 'true');
                    el.classList.add('bg-transparent', 'border-transparent', 'px-0');
                } else {
                    el.removeAttribute('readonly');
                    el.classList.remove('bg-transparent', 'border-transparent', 'px-0');
                }
            }
        });
    },

    updateUI() {
        const editBadge = document.getElementById('edit-badge');
        const financialSection = document.getElementById('financial-section');
        const viewActions = document.getElementById('view-actions');
        const editActions = document.getElementById('edit-actions');

        if(!editBadge || !financialSection) return;

        if (State.isEditor) {
            editBadge.classList.remove('hidden');
            financialSection.classList.remove('hidden');
            financialSection.classList.add('flex');
            viewActions.classList.add('hidden');
            editActions.classList.remove('hidden');
            editActions.classList.add('flex');
        } else {
            editBadge.classList.add('hidden');
            financialSection.classList.add('hidden');
            financialSection.classList.remove('flex');
            editActions.classList.add('hidden');
            editActions.classList.remove('flex');
            viewActions.classList.remove('hidden');
        }
    },

    toggleSellerOther() {
        const seller = document.getElementById('sheet-seller').value;
        const otherInput = document.getElementById('sheet-seller-other');
        otherInput.classList.toggle('hidden', seller !== 'Outros');
    },

    togglePaymentFields() {
        const method = document.getElementById('sheet-payment-method').value;
        const wrapper = document.getElementById('installments-wrapper');

        if (method === 'parcelado') {
            wrapper.classList.remove('hidden');
            wrapper.classList.add('flex');
            this.renderInstallmentFields();
        } else {
            wrapper.classList.add('hidden');
            wrapper.classList.remove('flex');
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
            const bgClass = State.isEditor
                ? 'bg-[#121214] border border-gray-700 text-white focus:ring-2 focus:ring-blue-500'
                : 'bg-transparent border-transparent px-0 text-gray-400';

            container.innerHTML += `
                <div class="flex flex-col gap-1">
                    <label class="text-[10px] text-gray-500 font-medium">Parcela ${i + 1}</label>
                    <input
                        type="text"
                        id="inst-val-${i}"
                        value="${value}"
                        placeholder="R$ 0,00"
                        class="w-full text-sm rounded-xl outline-none p-3 transition-all duration-200 ${bgClass}"
                        maxlength="15"
                        ${isReadOnly}>
                </div>
            `;
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

        table.status = document.getElementById('sheet-status').value;
        table.identification = document.getElementById('sheet-identification').value.trim();
        table.seller = document.getElementById('sheet-seller').value;
        table.sellerOther = document.getElementById('sheet-seller-other').value.trim();
        table.saleDate = document.getElementById('sheet-sale-date').value;
        table.paymentMethod = document.getElementById('sheet-payment-method').value;
        table.missingAmount = document.getElementById('sheet-missing-amount').value.trim();
        table.installmentsCount = document.getElementById('sheet-installments-count').value;

        for (let i = 0; i < 10; i++) {
            table.guests[i] = (document.getElementById(`guest-${i}`).value || '').trim();
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
                Render.all();
                Sheet.close();
                showToast('Mesa salva com sucesso! ✓', 'success');
            } else {
                showToast('Erro ao salvar dados', 'error');
            }
        } catch (error) {
            console.error('Erro ao salvar:', error);
            showToast('Erro de conexão', 'error');
        } finally {
            btn.innerHTML = originalHTML;
            btn.disabled = false;
        }
    }
};

// ============================================
// MÓDULO DE NAVEGAÇÃO
// ============================================
const Nav = {
    switchTab(tabName) {
        const tabList = document.getElementById('tab-list');
        const tabMap = document.getElementById('tab-map');
        const navList = document.getElementById('nav-list');
        const navMap = document.getElementById('nav-map');

        if (tabName === 'list') {
            tabList.classList.remove('hidden');
            tabMap.classList.add('hidden');
            this.updateNav(navList, true);
            this.updateNav(navMap, false);
        } else {
            tabMap.classList.remove('hidden');
            tabList.classList.add('hidden');
            this.updateNav(navMap, true);
            this.updateNav(navList, false);
        }
    },

    updateNav(btn, active) {
        if (active) {
            btn.classList.add('text-blue-500');
            btn.classList.remove('text-gray-500');
            btn.querySelector('i').classList.add('ph-fill');
        } else {
            btn.classList.remove('text-blue-500');
            btn.classList.add('text-gray-500');
            btn.querySelector('i').classList.remove('ph-fill');
        }
    }
};

// ============================================
// MÓDULO PWA (INSTALAÇÃO) - RESOLVE O BUG DO BOTÃO TRAVADO E ABAS DUPLAS
// ============================================
const PWA = {
    deferredPrompt: null,

    init() {
        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            this.deferredPrompt = e;
            
            // SE ESTE EVENTO DISPAROU, É ANDROID. Vamos esconder a aba do iOS se ela tentar aparecer.
            const iosBanner = document.getElementById('ios-banner');
            if (iosBanner) iosBanner.classList.remove('show');
            
            if (!localStorage.getItem('install_dismissed')) {
                setTimeout(() => {
                    const banner = document.getElementById('install-banner');
                    if(banner) banner.classList.add('show');
                }, 2000);
            }
        });

        window.addEventListener('appinstalled', () => {
            this.hideBanner('install-banner');
            this.hideBanner('ios-banner');
            this.deferredPrompt = null;
            showToast('App instalado com sucesso! ✓', 'success');
        });

        this.checkIos();
    },

    async install() {
        if (!this.deferredPrompt) {
            showToast('Abra o link nativamente no Chrome ou Safari para instalar.', 'warning');
            return;
        }
        
        try {
            this.deferredPrompt.prompt();
            const { outcome } = await this.deferredPrompt.userChoice;
            
            if (outcome === 'accepted') {
                this.hideBanner('install-banner');
            }
        } catch (error) {
            console.error('Erro na instalação:', error);
        } finally {
            this.deferredPrompt = null;
            this.hideBanner('install-banner');
        }
    },

    hideBanner(id) {
        const banner = document.getElementById(id);
        if (banner) {
            banner.classList.remove('show');
        }
        localStorage.setItem(id === 'install-banner' ? 'install_dismissed' : 'ios_dismissed', 'true');
    },

    checkIos() {
        const isIos = /iphone|ipad|ipod|macintosh/i.test(navigator.userAgent);
        // Verificação robusta para saber se o App JÁ FOI instalado na tela inicial
        const isStandalone = window.navigator.standalone === true || window.matchMedia('(display-mode: standalone)').matches;
        const dismissed = localStorage.getItem('ios_dismissed');

        // Mostra apenas se for iOS, NÃO estiver instalado, e se o aviso do Android (deferredPrompt) não assumiu o controle.
        if (isIos && !isStandalone && !dismissed) {
            setTimeout(() => {
                // Checagem dupla de segurança antes de exibir
                if (!this.deferredPrompt) {
                    const banner = document.getElementById('ios-banner');
                    if(banner) banner.classList.add('show');
                }
            }, 2500); // Aguarda um pouquinho a mais para dar tempo do Android se manifestar
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
window.authenticate = function() {
    const password = document.getElementById('auth-password').value;
    Auth.authenticate(password);
}
window.saveTableData = function() { Save.tableData(); }
window.filterList = function() {
    const searchText = document.getElementById('search-input').value;
    Render.list(searchText);
}
window.toggleSellerOther = function() { Sheet.toggleSellerOther(); }
window.togglePaymentFields = function() { Sheet.togglePaymentFields(); }
window.renderInstallmentFields = function() { Sheet.renderInstallmentFields(); }

// Exportando funções do PWA para o HTML
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
    } catch (error) {
        console.error('Erro ao sincronizar:', error);
        showToast('Erro ao sincronizar', 'error');
    } finally {
        State.isSyncing = false;
        navSync.classList.remove('animate-spin');
    }
}

function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    const icon = toast.querySelector('i');
    const text = toast.querySelector('div');

    text.textContent = message;
    toast.classList.remove('bg-green-600', 'bg-red-600', 'bg-yellow-600');

    if (type === 'error') {
        toast.classList.add('bg-red-600');
        icon.className = 'ph ph-warning text-2xl flex-shrink-0';
    } else if (type === 'warning') {
        toast.classList.add('bg-yellow-600');
        icon.className = 'ph ph-warning-circle text-2xl flex-shrink-0';
    } else {
        toast.classList.add('bg-green-600');
        icon.className = 'ph ph-check-circle text-2xl flex-shrink-0';
    }

    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3000);
}

// ============================================
// INICIALIZAÇÃO DO APP - RESOLVE O BUG DO LOADING INFINITO
// ============================================
async function initApp() {
    try {
        State.init();
        Initialize.createTables();
        
        PWA.init();
        
        // Se a chamada do servidor falhar, a trava de proteção garante que o mapa funcione offline/vazio
        await Initialize.mergeWithServerData();
        
        Render.all();
        Auth.updateUI();
    } catch (error) {
        console.error('Erro ao inicializar:', error);
        showToast('Erro de conexão ao Google.', 'error');
        Render.all(); // Renderiza mesmo com erro (mostra as mesas vazias)
    } finally {
        // Remove a tela preta de carregamento INDEPENDENTE DE SUCESSO OU ERRO
        const loader = document.getElementById('loading-overlay');
        if (loader) {
            loader.classList.add('opacity-0', 'pointer-events-none');
            setTimeout(() => loader.remove(), 500);
        }
    }

    // Intervalo de Sincronização
    setInterval(async () => {
        try {
            await Initialize.mergeWithServerData();
            Render.all();
        } catch(e) {}
    }, CONFIG.syncInterval);
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}

document.getElementById('sheet-overlay')?.addEventListener('touchmove', e => e.preventDefault(), { passive: false });
