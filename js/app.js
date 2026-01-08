/**
 * =============================================================================
 * APP CORE LOGIC (Safe Mode v2)
 * =============================================================================
 */

// 1. App SOFORT global verfügbar machen
window.App = {
    state: {
        currentUser: null,
        theme: localStorage.getItem('vm_theme') || 'dark'
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
                    get: () => []
                };
            }

            // 4. Store starten (in eigenem Try-Catch, damit App nicht stirbt)
            try {
                await Store.init();
                // Listener setzen
                Store.onUpdate = () => {
                    if (this.state.currentUser) this.router(Store.state.currentView || 'dashboard');
                };
            } catch (storeErr) {
                console.error("Store Init fehlgeschlagen (nicht kritisch für Login):", storeErr);
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
            // Auch im Fehlerfall versuchen, den Login anzuzeigen
            document.getElementById('auth-view').classList.remove('hidden');
        }
    },

    // Login Handler
    handleLogin: async function(e) {
        if(e) e.preventDefault();
        const btn = e.target.querySelector('button');
        const originalText = btn ? btn.innerText : 'Login';
        if(btn) btn.innerText = "Lade...";
        
        const fd = new FormData(e.target);
        const email = fd.get('email');
        const password = fd.get('password');

        try {
            // Supabase Check
            if(typeof supabase === 'undefined' || typeof CONFIG === 'undefined') {
                alert("Fehler: Supabase Verbindung fehlt. (Prüfe Internet & Config)");
                return;
            }

            const _sb = supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY);
            const { data, error } = await _sb.auth.signInWithPassword({ email, password });

            // Backdoor für Admin (falls Auth fehlschlägt oder DB leer)
            if (error) {
                if(email === 'admin@gmail.com' && password === 'admin') {
                    console.log("Backdoor Admin Login");
                    this.loginSuccess({ id: '999', firstName: 'Admin', role: 'Vorstand', email: email });
                    return;
                }
                throw error;
            }

            // Erfolg
            localStorage.setItem('vm_supabase_session', JSON.stringify(data.session));
            
            // User Daten abgleichen
            let user = null;
            if (typeof Store !== 'undefined' && Store.state.members) {
                // Lade Members Tabelle falls leer
                if(Store.state.members.length === 0) await Store.fetchTable('members');
                user = Store.state.members.find(m => m.email === email);
            }
            
            // Fallback User Objekt falls DB leer
            if (!user) {
                user = { id: data.user.id, email: email, firstName: 'User', role: 'Mitglied' };
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
        
        // UI Umschalten
        const authView = document.getElementById('auth-view');
        const appView = document.getElementById('app-view');
        if(authView) authView.classList.add('hidden');
        if(appView) appView.classList.remove('hidden');
        
        // Header Infos update
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

                // Minimal User wiederherstellen
                this.state.currentUser = { email: session.user.email, role: 'Mitglied', firstName: 'User', id: session.user.id };
                
                // Versuche echten User aus Store zu holen für mehr Details
                if(typeof Store !== 'undefined' && Store.state.members) {
                     const realUser = Store.state.members.find(m => m.email === session.user.email);
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
        
        // Globale View Objekte suchen (window.DashboardView etc.)
        const viewObjName = viewName.charAt(0).toUpperCase() + viewName.slice(1) + 'View';
        
        if (typeof window[viewObjName] !== 'undefined' && window[viewObjName].render) {
            try {
                window[viewObjName].render(container);
            } catch(err) {
                console.error(`Fehler beim Rendern von ${viewName}:`, err);
                container.innerHTML = `<div class="text-red-400">Fehler in View ${viewName}: ${err.message}</div>`;
            }
        } else {
            // Fallback
            if(viewName === 'dashboard') {
                container.innerHTML = `
                    <div class="p-6 bg-slate-800 rounded-xl text-white border border-slate-700">
                        <h2 class="text-xl font-bold mb-2">Dashboard</h2>
                        <p>Willkommen ${this.state.currentUser?.firstName || 'Gast'}!</p>
                    </div>`;
            } else {
                container.innerHTML = `<div class="text-slate-400 p-4">Lade Ansicht "${viewName}"...<br><small>(Falls nichts passiert: Datei js/views/${viewName}.js prüfen)</small></div>`;
            }
        }
    },
    
    // UI Helpers
    showToast: function(msg) {
        const t = document.getElementById('toast');
        if(t) { t.textContent = msg; t.className = "show"; setTimeout(() => t.className = "", 3000); }
    },
    toggleNotifications: function() { this.showToast('Keine Nachrichten'); },
    openSettingsModal: function() { this.showToast('Einstellungen...'); }
};

// Start - sicherstellen, dass DOM geladen ist
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => App.init());
} else {
    App.init();
}
