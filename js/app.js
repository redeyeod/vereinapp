/**
 * =============================================================================
 * APP CORE LOGIC (Fixed Global Scope)
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

        // 1. Warte auf Store
        let attempts = 0;
        while (typeof Store === 'undefined' && attempts < 20) {
            await new Promise(r => setTimeout(r, 100));
            attempts++;
        }

        if (typeof Store === 'undefined') {
            console.error("Store.js nicht geladen!");
            return;
        }

        // 2. Store initialisieren
        await Store.init();

        // 3. Reaktivität: Wenn Daten aus der Cloud kommen -> UI Update
        Store.onUpdate = () => {
            this.updateNotificationDot();
            
            const activeTag = document.activeElement ? document.activeElement.tagName : '';
            // Kein automatischer Refresh während der User tippt (verhindert Cursor-Sprünge)
            if (activeTag !== 'INPUT' && activeTag !== 'TEXTAREA') {
                 if (this.state.currentUser) {
                     this.router(Store.state.currentView || 'dashboard');
                 }
            }
        };

        // 4. Setup
        this.loadCurrentUser();
        this.initTheme();
        this.injectStyles();
        
        // 5. Routing Start
        if (this.state.currentUser || localStorage.getItem('vm_current_user_id')) {
            const startView = Store.state.currentView || 'dashboard';
            this.router(startView);
            this.updateNotificationDot();
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
        const email = fd.get('email');
        const password = fd.get('password');

        try {
            if (typeof supabase === 'undefined' || typeof CONFIG === 'undefined') {
                throw new Error("Verbindungsinformationen fehlen.");
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
                throw new Error("Login fehlgeschlagen. Daten prüfen.");
            }

            localStorage.setItem('vm_supabase_session', JSON.stringify(data.session));
            if (Store.state.members.length === 0) await Store.fetchTable('members');
            
            let user = Store.state.members.find(m => m.email === email);
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
        if (user.email === 'admin@gmail.com') user.role = 'Admin';
        
        localStorage.setItem('vm_current_user_id', user.id);
        this.state.currentUser = user;
        
        document.getElementById('auth-view').classList.add('hidden');
        document.getElementById('app-view').classList.remove('hidden');
        
        this.updateHeaderUI();
        this.router('dashboard');
    },

    logout() {
        if(confirm("Abmelden?")) {
            localStorage.removeItem('vm_current_user_id');
            localStorage.removeItem('vm_supabase_session');
            location.reload();
        }
    },

    loadCurrentUser() {
        const sessionStr = localStorage.getItem('vm_supabase_session');
        if(!sessionStr || sessionStr === "undefined") return;

        try {
            const session = JSON.parse(sessionStr);
            if (!session || !session.user) return;

            const email = session.user.email;
            let user = Store.state.members.find(m => m.email === email);
            
            if(!user) {
                user = { id: session.user.id, email: email, firstName: 'User', role: email === 'admin@gmail.com' ? 'Admin' : 'Mitglied' };
            }

            if (email === 'admin@gmail.com') user.role = 'Admin';
            this.state.currentUser = user;
            this.updateHeaderUI();
        } catch(e) { 
            console.error("User Load Error", e); 
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

        // View-Lookup über das globale window Objekt (daher muss jede View dort registriert sein)
        const viewObjName = viewName.charAt(0).toUpperCase() + viewName.slice(1) + 'View';
        // Spezialfall für messenger -> MessengerView etc.
        let viewObj = window[viewObjName];

        // Fallback für manuelle Switch-Logik
        if(!viewObj) {
            switch(viewName) {
                case 'dashboard': viewObj = window.DashboardView; break;
                case 'members': viewObj = window.MembersView; break;
                case 'groups': viewObj = window.GroupsView; break;
                case 'calendar': viewObj = window.CalendarView; break;
                case 'news': viewObj = window.NewsView; break;
                case 'documents': viewObj = window.DocsView; break;
                case 'messenger': viewObj = window.MessengerView; break;
                case 'profile': viewObj = window.ProfileView; break;
                case 'workhours': viewObj = window.WorkHoursView; break;
            }
        }

        if (viewObj && typeof viewObj.render === 'function') {
            viewObj.render(container);
        } else {
            console.warn(`View "${viewName}" konnte nicht geladen werden.`);
            if(container) container.innerHTML = `<p class="text-dark-muted">Lade ${viewName}...</p>`;
        }
    },

    // --- PERMISSIONS ---
    can(action) {
        const user = this.state.currentUser;
        if (!user) return false; 
        if (user.email === 'admin@gmail.com') return true;

        const role = user.role || 'Mitglied';
        const adminRoles = ['1. Vorstand', '2. Vorstand', '3. Vorstand', '4. Vorstand', 'Präsident', 'Vize-Präsident', 'Admin', 'Vorstand'];
        const managerRoles = ['Kassenwart', 'Protokollant', 'Trainer', 'Abteilungsleiter'];

        if (adminRoles.includes(role)) return true;

        const permissions = {
            'manage_workhours': managerRoles.includes(role),
            'manage_members': false,
            'manage_groups': role === 'Abteilungsleiter',
            'manage_news': role === 'Protokollant'
        };

        return permissions[action] || false;
    },

    // --- UI HELPERS ---
    showAuthView() {
        document.getElementById('auth-view').classList.remove('hidden');
        document.getElementById('app-view').classList.add('hidden');
    },

    openModal(htmlContent) { 
        const overlay = document.getElementById('modal-overlay');
        const content = document.getElementById('modal-content');
        if (overlay && content) {
            content.innerHTML = htmlContent;
            overlay.classList.remove('hidden');
        }
    },

    closeModal() { 
        const overlay = document.getElementById('modal-overlay');
        if (overlay) overlay.classList.add('hidden');
    },

    showToast(message) { 
        const toast = document.getElementById("toast"); 
        if (toast) { 
            toast.textContent = message; 
            toast.classList.add('show'); 
            setTimeout(() => { toast.classList.remove('show'); }, 3000); 
        } 
    },

    updateNotificationDot() { /* Logik für den roten Punkt am Bell-Icon */ },
    initTheme() { this.applyTheme(); },
    toggleTheme() { 
        this.state.theme = this.state.theme === 'dark' ? 'light' : 'dark'; 
        localStorage.setItem('vm_theme', this.state.theme); 
        this.applyTheme(); 
    },
    applyTheme() {
        const root = document.documentElement;
        if (this.state.theme === 'dark') root.classList.add('dark');
        else root.classList.remove('dark');
    },
    injectStyles() { /* Form-Styles etc. */ }
};

// WICHTIG: App global verfügbar machen!
window.App = App;

document.addEventListener('DOMContentLoaded', () => { App.init(); });
