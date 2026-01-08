/**
 * =============================================================================
 * APP CORE LOGIC (Safe Mode)
 * =============================================================================
 */

// 1. App SOFORT global verfügbar machen, bevor irgendwas anderes passiert
window.App = {
    state: {
        currentUser: null,
        theme: localStorage.getItem('vm_theme') || 'dark'
    },

    // Init Funktion
    init: async function() {
        console.log("App: Init gestartet...");
        
        try {
            // Check Store
            if (typeof Store === 'undefined') {
                console.error("Store nicht gefunden");
                // Wir brechen hier NICHT ab, damit die App zumindest den Login anzeigen kann
            } else {
                // Store starten
                await Store.init();

                // Store Listener
                Store.onUpdate = () => {
                    if (this.state.currentUser) this.router(Store.state.currentView || 'dashboard');
                };
            }

            // User laden (Versuch Session wiederherzustellen)
            this.loadCurrentUser();

            // Routing
            if (this.state.currentUser) {
                this.router('dashboard');
            } else {
                const authView = document.getElementById('auth-view');
                const appView = document.getElementById('app-view');
                if(authView) authView.classList.remove('hidden');
                if(appView) appView.classList.add('hidden');
            }

        } catch (e) {
            console.error("Kritischer Fehler im App Init:", e);
            alert("App Init Fehler: " + e.message);
        }
    },

    // Login Handler (Muss existieren, auch wenn Init crasht)
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
                alert("Konfiguration oder Supabase Library fehlt! Prüfe config.js und index.html imports.");
                return;
            }

            const _sb = supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY);
            const { data, error } = await _sb.auth.signInWithPassword({ email, password });

            // Backdoor / Fehlerbehandlung
            if (error) {
                if(email === 'admin@gmail.com' && password === 'admin') {
                    // Fake Admin Login erlauben für Demo (falls DB leer oder Auth failt)
                    console.log("Backdoor Admin Login");
                    this.loginSuccess({ id: '999', firstName: 'Admin', role: 'Vorstand', email: email });
                    return;
                }
                throw error;
            }

            // Erfolg
            localStorage.setItem('vm_supabase_session', JSON.stringify(data.session));
            
            // Versuchen User aus Store zu holen
            if (typeof Store !== 'undefined') {
                if(Store.state.members.length === 0) await Store.fetchTable('members');
                const user = Store.state.members.find(m => m.email === email);
                this.loginSuccess(user || { id: data.user.id, email: email, firstName: 'User', role: 'Mitglied' });
            } else {
                this.loginSuccess({ id: data.user.id, email: email, firstName: 'User', role: 'Mitglied' });
            }

        } catch (err) {
            console.error(err);
            alert("Login Fehler: " + (err.message || err));
        } finally {
            if(btn) { btn.innerText = originalText; btn.disabled = false; }
        }
    },

    loginSuccess: function(user) {
        console.log("Login Success:", user);
        this.state.currentUser = user;
        localStorage.setItem('vm_current_user_id', user.id);
        
        document.getElementById('auth-view').classList.add('hidden');
        document.getElementById('app-view').classList.remove('hidden');
        
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

                this.state.currentUser = { email: session.user.email, role: 'Mitglied', firstName: 'User', id: session.user.id }; // Minimal User
                
                // Versuche echten User aus Store zu holen
                if(typeof Store !== 'undefined' && Store.state.members) {
                     const realUser = Store.state.members.find(m => m.email === session.user.email);
                     if(realUser) {
                         this.state.currentUser = realUser;
                         // Header update sofort
                         const nameEl = document.getElementById('current-user-name');
                         if(nameEl) nameEl.textContent = realUser.firstName;
                     }
                }
            } catch(e) { console.error(e); }
        }
    },

    router: function(viewName) {
        const container = document.getElementById('content');
        if(!container) return;
        
        // Titel Update
        const subtitle = document.getElementById('page-subtitle');
        if(subtitle) subtitle.textContent = viewName.charAt(0).toUpperCase() + viewName.slice(1);

        container.innerHTML = '';
        
        // Versuchen View zu finden (über globales window Objekt)
        const viewObjName = viewName.charAt(0).toUpperCase() + viewName.slice(1) + 'View';
        
        if (typeof window[viewObjName] !== 'undefined' && window[viewObjName].render) {
            window[viewObjName].render(container);
        } else {
            // Fallback Dashboard oder Fehler
            if(viewName === 'dashboard') {
                container.innerHTML = `
                    <div class="p-6 bg-slate-800 rounded-xl text-white border border-slate-700">
                        <h2 class="text-xl font-bold mb-2">Dashboard</h2>
                        <p>Willkommen ${this.state.currentUser?.firstName || 'Gast'}!</p>
                        <p class="text-sm text-slate-400 mt-2">Wenn du dies siehst, wurde die Datei <b>js/views/dashboard.js</b> nicht geladen oder DashboardView ist nicht definiert.</p>
                    </div>`;
            } else {
                container.innerHTML = `<div class="text-red-400 p-4 border border-red-500 rounded bg-red-900/20">View "${viewName}" nicht gefunden.<br>Bitte prüfe, ob <b>js/views/${viewName}.js</b> existiert und geladen wurde.</div>`;
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

// Start
window.addEventListener('DOMContentLoaded', () => {
    App.init();
});
