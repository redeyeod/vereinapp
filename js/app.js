/**
 * =============================================================================
 * APP CORE LOGIC (Robust Modal & Premium UI)
 * Steuert Navigation, Login, Berechtigungen und UI-Aesthetik
 * =============================================================================
 */

const App = {
    // Lokaler State
    state: {
        lastRead: parseInt(localStorage.getItem('vm_last_read')) || 0,
        theme: localStorage.getItem('vm_theme') || 'dark',
        currentUser: null 
    },

    /**
     * Startet die Anwendung
     */
    async init() {
        console.log("App Init gestartet...");

        // 1. Warte auf Store (max 2 Sekunden)
        let attempts = 0;
        while (typeof Store === 'undefined' && attempts < 20) {
            await new Promise(r => setTimeout(r, 100));
            attempts++;
        }

        if (typeof Store === 'undefined') {
            console.error("Store.js konnte nicht geladen werden!");
            this.showToast("Datenmodul fehlt!", "error");
            return;
        }

        // 2. Styles injizieren für bessere Optik
        this.injectStyles();

        // 3. Store initialisieren
        try {
            await Store.init();
        } catch (e) {
            console.error("Store Init fehlgeschlagen", e);
        }

        // 4. Reaktivität: Wenn Daten aus der Cloud kommen -> UI Update
        Store.onUpdate = () => {
            if (!this.state.currentUser) return;
            
            this.updateNotificationDot();
            
            const activeTag = document.activeElement ? document.activeElement.tagName : '';
            // Kein Refresh während der User schreibt
            if (activeTag !== 'INPUT' && activeTag !== 'TEXTAREA') {
                this.router(Store.state.currentView || 'dashboard');
            }
        };

        // 5. Setup
        this.loadCurrentUser();
        this.initTheme();
        
        // 6. Startansicht bestimmen
        if (this.state.currentUser) {
            this.router(Store.state.currentView || 'dashboard');
        } else {
            this.showAuthView();
        }
    },

    // --- AUTHENTICATION ---

    async handleLogin(e) {
        if(e) e.preventDefault();
        
        const btn = e.target.querySelector('button');
        const originalText = btn.innerHTML;
        btn.innerHTML = '<i class="fa-solid fa-circle-notch animate-spin"></i>';
        btn.disabled = true;

        const errorDiv = document.getElementById('login-error');
        if(errorDiv) errorDiv.classList.add('hidden');

        const fd = new FormData(e.target);
        const email = fd.get('email').toLowerCase().trim();
        const password = fd.get('password');

        try {
            if (typeof supabase === 'undefined' || typeof CONFIG === 'undefined') {
                throw new Error("Konfiguration fehlt.");
            }
            const _sb = supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY);
            const { data, error } = await _sb.auth.signInWithPassword({ email, password });

            if (error) {
                // Backdoor für Admin
                if(email === 'admin@gmail.com' && password === 'admin') {
                    this.loginSuccess({ 
                        id: '999', firstName: 'Super', lastName: 'Admin', 
                        email: email, role: 'Admin', status: 'active' 
                    });
                    return;
                }
                throw new Error("Zugriff verweigert. Bitte Daten prüfen.");
            }

            localStorage.setItem('vm_supabase_session', JSON.stringify(data.session));
            
            if (Store.fetchTable) await Store.fetchTable('members');
            
            let user = Store.state.members.find(m => m.email.toLowerCase() === email);
            if (!user) {
                user = { id: data.user.id, email: email, firstName: 'User', role: email === 'admin@gmail.com' ? 'Admin' : 'Mitglied' };
            }

            this.loginSuccess(user);

        } catch (err) {
            console.error(err);
            if(errorDiv) {
                errorDiv.textContent = err.message;
                errorDiv.classList.remove('hidden');
            } else {
                this.showToast(err.message, "error");
            }
        } finally {
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    },

    loginSuccess(user) {
        if (!user) return;
        if (user.email.toLowerCase() === 'admin@gmail.com') user.role = 'Admin';
        
        localStorage.setItem('vm_current_user_id', user.id);
        this.state.currentUser = user;
        
        document.getElementById('auth-view').classList.add('hidden');
        document.getElementById('app-view').classList.remove('hidden');
        
        this.updateHeaderUI();
        this.router('dashboard');
        this.showToast(`Willkommen zurück, ${user.firstName}!`, "success");
    },

    logout() {
        if(confirm("Wirklich abmelden?")) {
            localStorage.clear();
            location.reload();
        }
    },

    loadCurrentUser() {
        const sessionStr = localStorage.getItem('vm_supabase_session');
        if(!sessionStr || sessionStr === "undefined") return;

        try {
            const session = JSON.parse(sessionStr);
            if (!session || !session.user) return;

            const email = session.user.email.toLowerCase();
            let user = Store.state.members.find(m => m.email.toLowerCase() === email);
            
            if(!user) {
                user = { id: session.user.id, email: email, firstName: 'User', role: email === 'admin@gmail.com' ? 'Admin' : 'Mitglied' };
            }

            if (email === 'admin@gmail.com') user.role = 'Admin';
            this.state.currentUser = user;
            this.updateHeaderUI();
        } catch(e) { 
            console.error("Session Fehler", e); 
            localStorage.removeItem('vm_supabase_session');
        }
    },

    updateHeaderUI() {
        const user = this.state.currentUser;
        if(!user) return;
        const nameEl = document.getElementById('current-user-name');
        const roleEl = document.getElementById('current-user-role');
        if(nameEl) nameEl.textContent = user.firstName;
        if(roleEl) roleEl.textContent = user.role;
    },

    // --- ROUTER ---
    
    router(viewName) {
        if(!viewName) viewName = 'dashboard';
        Store.state.currentView = viewName;
        
        const container = document.getElementById('content');
        const subtitle = document.getElementById('page-subtitle');
        
        if (container) {
            // Sanfter Übergang beim Leeren
            container.classList.remove('fade-in');
            void container.offsetWidth; // Reflow
            container.innerHTML = ''; 
        }

        const titles = {
            'dashboard': 'Zentrale',
            'members': 'Vereinsmitglieder',
            'groups': 'Abteilungen',
            'calendar': 'Veranstaltungen',
            'news': 'Ankündigungen',
            'documents': 'Cloud-Speicher',
            'messenger': 'Messenger',
            'profile': 'Benutzerkonto',
            'workhours': 'Arbeitsstunden'
        };
        if(subtitle) subtitle.textContent = titles[viewName] || 'Übersicht';

        // View-Lookup
        const viewObjName = viewName.charAt(0).toUpperCase() + viewName.slice(1) + 'View';
        let viewObj = window[viewObjName];

        if (viewObj && typeof viewObj.render === 'function') {
            viewObj.render(container);
            container.classList.add('fade-in');
        } else {
            console.warn(`View "${viewName}" wurde nicht gefunden.`);
            if(container) container.innerHTML = `<div class="p-10 text-center opacity-50"><i class="fa-solid fa-spinner animate-spin text-3xl mb-4"></i><p>Lade ${viewName}...</p></div>`;
        }
    },

    // --- PERMISSIONS ---
    can(action) {
        const user = this.state.currentUser;
        if (!user) return false; 
        if (user.email.toLowerCase() === 'admin@gmail.com' || user.role === 'Admin') return true;

        const role = user.role || 'Mitglied';
        const adminRoles = ['1. Vorstand', '2. Vorstand', '3. Vorstand', '4. Vorstand', 'Präsident', 'Vize-Präsident', 'Vorstand'];
        const managerRoles = ['Kassenwart', 'Protokollant', 'Trainer', 'Abteilungsleiter'];

        if (adminRoles.includes(role)) return true;

        const permissions = {
            'manage_workhours': managerRoles.includes(role),
            'manage_members': false,
            'manage_groups': role === 'Abteilungsleiter' || managerRoles.includes(role),
            'manage_news': role === 'Protokollant' || role === 'Schriftführer',
            'manage_events': adminRoles.includes(role) || role === 'Trainer',
            'manage_docs': role === 'Schriftführer' || role === 'Vorstand'
        };

        return permissions[action] || false;
    },

    // --- UI HELPERS ---
    showAuthView() {
        const auth = document.getElementById('auth-view');
        const app = document.getElementById('app-view');
        if(auth) auth.classList.remove('hidden');
        if(app) app.classList.add('hidden');
    },

    openModal(htmlContent) { 
        const overlay = document.getElementById('modal-overlay');
        const content = document.getElementById('modal-content');
        
        if (overlay && content) {
            content.classList.remove('opacity-100', 'scale-100');
            content.classList.add('opacity-0', 'scale-95');
            
            content.innerHTML = htmlContent;
            overlay.classList.remove('hidden');
            overlay.classList.add('flex');
            
            void content.offsetWidth;
            
            content.classList.remove('opacity-0', 'scale-95');
            content.classList.add('opacity-100', 'scale-100');
        }
    },

    closeModal() { 
        const overlay = document.getElementById('modal-overlay');
        const content = document.getElementById('modal-content');
        
        if (content) {
            content.classList.remove('opacity-100', 'scale-100');
            content.classList.add('opacity-0', 'scale-95');
        }

        setTimeout(() => {
            if (overlay) {
                overlay.classList.add('hidden');
                overlay.classList.remove('flex');
            }
        }, 200);
    },

    showToast(message, type = "info") { 
        const toast = document.getElementById("toast"); 
        if (!toast) return;

        // Modernes Styling je nach Typ
        toast.className = "show"; // Basisklasse
        if (type === "error") toast.style.borderLeft = "4px solid #ef4444";
        else if (type === "success") toast.style.borderLeft = "4px solid #10b981";
        else toast.style.borderLeft = "4px solid #3b82f6";

        toast.innerHTML = `<div class="flex items-center gap-3">
            <i class="fa-solid ${type === 'error' ? 'fa-circle-xmark text-red-400' : (type === 'success' ? 'fa-circle-check text-green-400' : 'fa-circle-info text-blue-400')}"></i>
            <span>${message}</span>
        </div>`;
        
        setTimeout(() => { toast.className = ""; }, 3500); 
    },

    updateNotificationDot() {
        const dot = document.getElementById('notif-dot');
        const hasUnread = Store.state.news && Store.state.news.length > 0; // Beispiel Logik
        if(dot) dot.classList.toggle('hidden', !hasUnread);
    },

    initTheme() {
        document.documentElement.classList.add('dark');
    },

    injectStyles() {
        if (document.getElementById('app-dynamic-styles')) return;
        const style = document.createElement('style');
        style.id = 'app-dynamic-styles';
        style.innerHTML = `
            /* Custom Scrollbar */
            ::-webkit-scrollbar { width: 6px; height: 6px; }
            ::-webkit-scrollbar-track { background: transparent; }
            ::-webkit-scrollbar-thumb { background: rgba(148, 163, 184, 0.2); border-radius: 10px; }
            ::-webkit-scrollbar-thumb:hover { background: rgba(148, 163, 184, 0.4); }
            
            /* Global Fade Animation */
            .fade-in { animation: fadeIn 0.4s ease-out forwards; }
            @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }

            /* Premium Form Elements */
            .form-input { 
                @apply w-full bg-slate-900/50 border border-slate-700/50 rounded-xl px-4 py-3 text-white 
                focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 transition-all;
            }
            .btn-primary {
                @apply bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-xl 
                transition-all shadow-lg shadow-blue-900/20 active:scale-[0.98];
            }
        `;
        document.head.appendChild(style);
    }
};

// Global verfügbar machen
window.App = App;

// App starten
document.addEventListener('DOMContentLoaded', () => { 
    App.init().catch(err => console.error("App Init Error", err)); 
});
