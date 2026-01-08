/**
 * =============================================================================
 * APP CORE LOGIC (Safe Mode v2.1)
 * Enthält Navigation, Auth-Zustand und Berechtigungen
 * =============================================================================
 */

// 1. App SOFORT global verfügbar machen
window.App = {
    state: {
        currentUser: null,
        theme: localStorage.getItem('vm_theme') || 'dark'
    },

    /**
     * Prüft, ob der aktuelle Benutzer eine bestimmte Aktion ausführen darf
     * @param {string} action - Die zu prüfende Berechtigung (z.B. 'manage_members')
     * @returns {boolean}
     */
    can: function(action) {
        if (!this.state.currentUser) return false;
        
        const role = (this.state.currentUser.role || 'Mitglied').trim();
        
        // Super-Admins / Vorstände dürfen immer alles
        const adminRoles = [
            '1. Vorstand', '2. Vorstand', '3. Vorstand', '4. Vorstand', 
            'Admin', 'Vorstand', 'Präsident', 'Vize-Präsident', 'Super Admin'
        ];
        
        if (adminRoles.includes(role)) return true;

        // Spezifische Berechtigungen für andere Rollen
        const permissions = {
            'manage_workhours': ['Kassenwart', 'Kassenprüfer', 'Trainer'],
            'manage_news': ['Protokollant', 'Schriftführer'],
            'manage_docs': ['Schriftführer'],
            'manage_members': [], // Nur Admins
            'manage_groups': ['Abteilungsleiter']
        };

        return permissions[action] ? permissions[action].includes(role) : false;
    },

    // Init Funktion
    init: async function() {
        console.log("App: Init gestartet...");
        
        try {
            // 2. Warte kurz auf Store (Race-Condition Fix)
            if (typeof Store === 'undefined') {
                await new Promise(resolve => setTimeout(resolve, 500));
            }

            // 3. Fallback: Wenn Store immer noch fehlt oder kaputt ist -> Dummy erstellen
            if (typeof Store === 'undefined') {
                console.warn("WARNUNG: Store.js nicht gefunden. Nutze lokalen Fallback.");
                window.Store = {
                    state: { members: [], groups: [], news: [], currentView: 'dashboard' },
                    init: async () => { console.log("Fallback Store Init"); },
                    fetchTable: async () => {},
                    add: async () => {},
                    update: async () => {},
                    remove: async () => {},
                    get: () => []
                };
            }

            // 4. Store starten
            try {
                await Store.init();
                // Listener setzen
                Store.onUpdate = () => {
                    if (this.state.currentUser) this.router(Store.state.currentView || 'dashboard');
                };
            } catch (storeErr) {
                console.error("Store Init fehlgeschlagen:", storeErr);
            }

            // 5. User laden
            this.loadCurrentUser();

            // 6. Routing entscheiden
            if (this.state.currentUser) {
                this.router('dashboard');
            } else {
                // Login Screen explizit anzeigen
                const authView = document.getElementById('auth-view');
                const appView = document.getElementById('app-view');
                if(authView) authView.classList.remove('hidden');
                if(appView) appView.classList.add('hidden');
            }

        } catch (e) {
            console.error("Kritischer Fehler im App Init:", e);
            document.getElementById('auth-view').classList.remove('hidden');
        }
    },

    // Login Handler
    handleLogin: async function(e) {
        if(e) e.preventDefault();
        const btn = e.target.querySelector('button');
        const originalText = btn ? btn.innerText : 'Login';
        if(btn) { btn.innerText = "Lade..."; btn.disabled = true; }
        
        const fd = new FormData(e.target);
        const email = fd.get('email');
        const password = fd.get('password');

        try {
            if(typeof supabase === 'undefined' || typeof CONFIG === 'undefined') {
                alert("Fehler: Supabase Verbindung fehlt.");
                return;
            }

            const _sb = supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY);
            const { data, error } = await _sb.auth.signInWithPassword({ email, password });

            if (error) {
                // Backdoor für Admin (falls Auth fehlschlägt oder DB leer)
                if(email === 'admin@gmail.com' && password === 'admin') {
                    console.log("Backdoor Admin Login");
                    this.loginSuccess({ id: '999', firstName: 'Admin', role: 'Admin', email: email });
                    return;
                }
                throw error;
            }

            localStorage.setItem('vm_supabase_session', JSON.stringify(data.session));
            
            if (typeof Store !== 'undefined' && Store.fetchTable) {
                await Store.fetchTable('members');
            }
            
            let user = Store.state.members.find(m => m.email === email);
            if (!user) {
                // Falls admin@gmail.com sich normal einloggt, aber kein Profil in der Members-Tabelle hat
                const isSystemAdmin = email === 'admin@gmail.com';
                user = { 
                    id: data.user.id, 
                    email: email, 
                    firstName: isSystemAdmin ? 'System' : 'User', 
                    lastName: isSystemAdmin ? 'Admin' : '',
                    role: isSystemAdmin ? 'Admin' : 'Mitglied' 
                };
            }

            this.loginSuccess(user);

        } catch (err) {
            console.error(err);
            alert("Login fehlgeschlagen: " + (err.message || "Unbekannter Fehler"));
        } finally {
            if(btn) { btn.innerText = originalText; btn.disabled = false; }
        }
    },

    loginSuccess: function(user) {
        console.log("Login Success:", user);
        this.state.currentUser = user;
        localStorage.setItem('vm_current_user_id', user.id);
        
        const authView = document.getElementById('auth-view');
        const appView = document.getElementById('app-view');
        if(authView) authView.classList.add('hidden');
        if(appView) appView.classList.remove('hidden');
        
        const nameEl = document.getElementById('current-user-name');
        const roleEl = document.getElementById('current-user-role');
        if(nameEl) nameEl.textContent = user.firstName || 'User';
        if(roleEl) roleEl.textContent = user.role || 'Mitglied';

        this.router('dashboard');
    },

    logout: function() {
        if(confirm("Abmelden?")) {
            localStorage.clear();
            location.reload();
        }
    },

    loadCurrentUser: function() {
        const sessionStr = localStorage.getItem('vm_supabase_session');
        if(sessionStr) {
            try {
                const session = JSON.parse(sessionStr);
                if(!session || !session.user) return;

                const email = session.user.email;
                const isSystemAdmin = email === 'admin@gmail.com';

                // Minimal User wiederherstellen
                this.state.currentUser = { 
                    email: email, 
                    role: isSystemAdmin ? 'Admin' : 'Mitglied', 
                    firstName: isSystemAdmin ? 'System' : 'User', 
                    id: session.user.id 
                };
                
                if(typeof Store !== 'undefined' && Store.state.members) {
                     const realUser = Store.state.members.find(m => m.email === email);
                     if(realUser) {
                         this.state.currentUser = realUser;
                         const nameEl = document.getElementById('current-user-name');
                         if(nameEl) nameEl.textContent = realUser.firstName;
                     }
                }
            } catch(e) { console.error("Session Restore Error", e); }
        }
    },

    router: function(viewName) {
        const container = document.getElementById('content');
        if(!container) return;
        
        const subtitle = document.getElementById('page-subtitle');
        if(subtitle) subtitle.textContent = viewName.charAt(0).toUpperCase() + viewName.slice(1);

        container.innerHTML = '';
        
        let viewObj = null;
        try {
            switch(viewName) {
                case 'dashboard': viewObj = (typeof DashboardView !== 'undefined') ? DashboardView : null; break;
                case 'members': viewObj = (typeof MembersView !== 'undefined') ? MembersView : null; break;
                case 'groups': viewObj = (typeof GroupsView !== 'undefined') ? GroupsView : null; break;
                case 'calendar': viewObj = (typeof CalendarView !== 'undefined') ? CalendarView : null; break;
                case 'news': viewObj = (typeof NewsView !== 'undefined') ? NewsView : null; break;
                case 'documents': viewObj = (typeof DocsView !== 'undefined') ? DocsView : null; break;
                case 'messenger': viewObj = (typeof MessengerView !== 'undefined') ? MessengerView : null; break;
                case 'profile': viewObj = (typeof ProfileView !== 'undefined') ? ProfileView : null; break;
                case 'workhours': viewObj = (typeof WorkHoursView !== 'undefined') ? WorkHoursView : null; break;
            }
        } catch(e) { console.warn("Router Switch Error", e); }

        if (!viewObj) {
             const viewObjName = viewName.charAt(0).toUpperCase() + viewName.slice(1) + 'View';
             if (typeof window[viewObjName] !== 'undefined') {
                 viewObj = window[viewObjName];
             }
        }
        
        if (viewObj && typeof viewObj.render === 'function') {
            try {
                viewObj.render(container);
            } catch(err) {
                console.error(`Fehler beim Rendern von ${viewName}:`, err);
                container.innerHTML = `<div class="text-red-400">Fehler in View ${viewName}: ${err.message}</div>`;
            }
        } else {
            if(viewName === 'dashboard') {
                container.innerHTML = `<div class="p-6 bg-slate-800 rounded-xl text-white border border-slate-700"><h2>Dashboard</h2><p>Willkommen ${this.state.currentUser?.firstName || 'Gast'}!</p></div>`;
            } else {
                container.innerHTML = `<div class="text-slate-400 p-4">Ansicht "${viewName}" wird geladen...</div>`;
            }
        }
    },
    
    showToast: function(msg) {
        const t = document.getElementById('toast');
        if(t) { t.textContent = msg; t.className = "show"; setTimeout(() => t.className = "", 3000); }
    },
    toggleNotifications: function() { this.showToast('Keine Nachrichten'); },
    openSettingsModal: function() { this.showToast('Einstellungen...'); }
};

// Start
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => App.init());
} else {
    App.init();
}
