// ============================================
// MÓDULO PWA (FOCADO 100% NO ANDROID)
// ============================================
let deferredPrompt = null; // Variável global segura para não perder a função nativa

const PWA = {
    init() {
        // 1. Intercepta o pedido oficial de instalação do Android
        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            deferredPrompt = e; // Salva o evento nativo
            
            // Garante que a aba do iOS suma imediatamente se tentar aparecer
            const iosBanner = document.getElementById('ios-banner');
            if (iosBanner) iosBanner.classList.remove('show');
            
            // Mostra o nosso banner de instalação do Android
            if (!localStorage.getItem('install_dismissed')) {
                setTimeout(() => {
                    const banner = document.getElementById('install-banner');
                    if (banner) banner.classList.add('show');
                }, 1000);
            }
        });

        // 2. Quando o app for instalado com sucesso
        window.addEventListener('appinstalled', () => {
            this.hideBanner('install-banner');
            deferredPrompt = null;
            showToast('App instalado com sucesso! ✓', 'success');
        });

        this.checkIos();
    },

    async install() {
        // Se o Android recusar abrir o prompt nativo, avisa o motivo
        if (!deferredPrompt) {
            showToast('O Chrome ainda não liberou a instalação. Limpe o cache e tente de novo!', 'warning');
            return;
        }
        
        try {
            // Dispara a janela nativa branca do Android (aquela que sobe debaixo)
            deferredPrompt.prompt();
            const { outcome } = await deferredPrompt.userChoice;
            
            if (outcome === 'accepted') {
                this.hideBanner('install-banner');
            }
        } catch (error) {
            console.error('Erro na instalação:', error);
        } finally {
            deferredPrompt = null;
            this.hideBanner('install-banner');
        }
    },

    hideBanner(id) {
        const banner = document.getElementById(id);
        if (banner) banner.classList.remove('show');
        localStorage.setItem(id === 'install-banner' ? 'install_dismissed' : 'ios_dismissed', 'true');
    },

    checkIos() {
        // Detecção super restrita apenas para iPhones, ignorando Androids totalmente
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
