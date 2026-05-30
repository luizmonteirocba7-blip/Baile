// ============================================
// MÓDULO PWA (LÓGICA DE INSTALAÇÃO CORRIGIDA)
// ============================================
let deferredPrompt = null;

const PWA = {
    init() {
        // 1. O SEGREDO DO SUCESSO: Registrar o Service Worker
        // Sem isso aqui, o Android bloqueia a instalação!
        if ('serviceWorker' in navigator) {
            window.addEventListener('load', () => {
                // ATENÇÃO: Confirme se o nome do seu arquivo no GitHub é service-worker.js ou sw.js
                navigator.serviceWorker.register('service-worker.js')
                    .then(() => console.log('Service Worker ativado com sucesso!'))
                    .catch(err => console.error('Erro no Service Worker:', err));
            });
        }

        // 2. Intercepta o evento nativo do Android
        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            deferredPrompt = e;
            
            // Esconde a faixa do iOS se o Android assumir
            const iosBanner = document.getElementById('ios-banner');
            if (iosBanner) iosBanner.classList.remove('show');
            
            // Mostra o seu banner do Android
            if (!localStorage.getItem('install_dismissed')) {
                setTimeout(() => {
                    const banner = document.getElementById('install-banner');
                    if (banner) banner.classList.add('show');
                }, 1000);
            }
        });

        // 3. Sucesso na instalação
        window.addEventListener('appinstalled', () => {
            this.hideBanner('install-banner');
            deferredPrompt = null;
            showToast('App instalado com sucesso! ✓', 'success');
        });

        this.checkIos();
    },

    async install() {
        // Se o deferredPrompt estiver vazio, é porque está rodando no WhatsApp/Insta
        // ou porque o Service Worker falhou.
        if (!deferredPrompt) {
            showToast('Abra o link nativamente no Chrome ou Safari para instalar.', 'warning');
            return;
        }
        
        try {
            // Dispara a janela oficial branca do Android
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
