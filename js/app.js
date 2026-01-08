/**
 * =============================================================================
 * APP CORE LOGIC (Robust Modal & Global Scope)
 * Steuert Navigation, Login, Berechtigungen und UI
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
            this.showToast("Datenmodul fehlt!");
            return;
        }

        // 2. Store initialisieren
        try {
            await Store.init();
        } catch (e) {
            console.error("Store Init fehlgeschlagen", e);
        }

        // 3. Reaktivität: Wenn Daten aus der Cloud kommen -> UI Update
        Store.onUpdate = () => {
            if (!this.state.currentUser) return;
            
            this.updateNotificationDot();
            
            const activeTag = document.activeElement ? document.activeElement.tagName : '';
            // Kein Refresh während der User schreibt
            if (activeTag !== 'INPUT' && activeTag !== 'TEXTAREA') {
                this.router(Store.state.currentView || 'dashboard');
            }
        };

        // 4. Setup
        this.loadCurrentUser();
        this.initTheme();
        
        // 5. Startansicht bestimmen
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
        const originalText = btn.innerText;
        btn.innerText = "Lade...";
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
                throw new Error("Login fehlgeschlagen. Bitte Daten prüfen.");
            }

            localStorage.setItem('vm_supabase_session', JSON.stringify(data.session));
            
            // Versuche Profildaten zu laden
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
                this.showToast(err.message);
            }
        } finally {
            btn.innerText = originalText;
            btn.disabled = false;
        }
    },

    loginSuccess(user) {
        if (!user) return;
        // Admin Force
        if (user.email.toLowerCase() === 'admin@gmail.com') user.role = 'Admin';
        
        localStorage.setItem('vm_current_user_id', user.id);
        this.state.currentUser = user;
        
        document.getElementById('auth-view').classList.add('hidden');
        document.getElementById('app-view').classList.remove('hidden');
        
        this.updateHeaderUI();
        this.router('dashboard');
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
            console.error("User Session Error", e); 
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
            container.innerHTML = ''; 
        }

        const titles = {
            'dashboard': 'Dashboard',
            'members': 'Mitglieder',
            'groups': 'Abteilungen',
            'calendar': 'Kalender',
            'news': 'News',
            'documents': 'Dokumente',
            'messenger': 'Chat',
            'profile': 'Profil',
            'workhours': 'Stunden'
        };
        if(subtitle) subtitle.textContent = titles[viewName] || 'Übersicht';

        // View-Lookup
        const viewObjName = viewName.charAt(0).toUpperCase() + viewName.slice(1) + 'View';
        let viewObj = window[viewObjName];

        if (viewObj && typeof viewObj.render === 'function') {
            viewObj.render(container);
        } else {
            console.warn(`View "${viewName}" (Objekt: ${viewObjName}) nicht gefunden.`);
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
            'manage_members': false, // Nur Admins (oben geprüft)
            'manage_groups': role === 'Abteilungsleiter' || managerRoles.includes(role),
            'manage_news': role === 'Protokollant' || role === 'Schriftführer',
            'manage_events': adminRoles.includes(role) || role === 'Trainer',
            'manage_docs': role === 'Schriftführer' || role === 'Vorstand'
        };

        return permissions[action] || false;
    },

    // --- UI HELPERS ---
    showAuthView() {
        document.getElementById('auth-view').classList.remove('hidden');
        document.getElementById('app-view').classList.add('hidden');
    },

    /**
     * Öffnet ein Modal mit Inhalt
     */
    openModal(htmlContent) { 
        const overlay = document.getElementById('modal-overlay');
        const content = document.getElementById('modal-content');
        
        if (overlay && content) {
            // Reset Animation Classes
            content.classList.remove('opacity-100', 'scale-100');
            content.classList.add('opacity-0', 'scale-95');
            
            content.innerHTML = htmlContent;
            overlay.classList.remove('hidden');
            overlay.classList.add('flex'); // Sicherstellen, dass es zentriert ist
            
            // Reflow erzwingen
            void content.offsetWidth;
            
            // Animation starten
            content.classList.remove('opacity-0', 'scale-95');
            content.classList.add('opacity-100', 'scale-100');
        }
    },

    /**
     * Schließt das Modal
     */
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

    showToast(message) { 
        const toast = document.getElementById("toast"); 
        if (toast) { 
            toast.textContent = message; 
            toast.classList.add('show'); 
            setTimeout(() => { toast.classList.remove('show'); }, 3000); 
        } 
    },

    updateNotificationDot() {
        const dot = document.getElementById('notif-dot');
        if(dot) dot.classList.add('hidden'); // Placeholder
    },

    initTheme() {
        document.documentElement.classList.add('dark');
    },

    injectStyles() {
        // Nicht mehr nötig, da in index.html definiert
    }
};

// Global verfügbar machen
window.App = App;

// App starten
document.addEventListener('DOMContentLoaded', () => { 
    App.init().catch(err => console.error("App Init Error", err)); 
});
