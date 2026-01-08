/**
 * =============================================================================
 * APP CORE LOGIC
 * =============================================================================
 */

const App = {
    state: {
        lastRead: parseInt(localStorage.getItem('vm_last_read')) || 0,
        theme: localStorage.getItem('vm_theme') || 'dark',
        currentUser: null 
    },

    async init() {
        console.log("App: Init gestartet...");

        // 1. Warte auf Store (Max 2 Sekunden)
        let attempts = 0;
        while (typeof Store === 'undefined' && attempts < 20) {
            await new Promise(r => setTimeout(r, 100));
            attempts++;
        }

        if (typeof Store === 'undefined') {
            console.error("App: CRITICAL - Store.js wurde nicht geladen.");
            alert("Fehler: Store.js konnte nicht geladen werden. Prüfe die Dateipfade.");
            return;
        }

        // 2. Store initialisieren
        await Store.init();

        // 3. Reaktivität setzen
        Store.onUpdate = () => {
            this.updateNotificationDot();
            const activeTag = document.activeElement ? document.activeElement.tagName : '';
            if (activeTag !== 'INPUT' && activeTag !== 'TEXTAREA') {
                 if (this.state.currentUser) {
                     this.router(Store.state.currentView);
                 }
            }
        };

        // 4. Setup
        this.loadCurrentUser();
        this.initTheme();
        this.injectStyles();
        
        // 5. Routing / Auth Check
        // Wir prüfen, ob wir eine gültige User-Session haben
        if (this.state.currentUser) {
            console.log("App: User gefunden, starte Dashboard");
            this.router('dashboard');
            this.updateNotificationDot();
        } else {
            console.log("App: Kein User, zeige Login");
            const authView = document.getElementById('auth-view');
            const appView = document.getElementById('app-view');
            if(authView) authView.classList.remove('hidden');
            if(appView) appView.classList.add('hidden');
        }
    },

    // --- AUTHENTICATION ---

    async handleLogin(e) {
        if(e) e.preventDefault();
        console.log("App: Login Versuch...");
        
        const btn = e.target.querySelector('button');
        const originalText = btn ? btn.innerText : 'Login';
        if(btn) { btn.innerText = "Lade..."; btn.disabled = true; }

        const errorDiv = document.getElementById('login-error');
        if(errorDiv) errorDiv.classList.add('hidden');

        const fd = new FormData(e.target);
        const email = fd.get('email');
        const password = fd.get('password');

        try {
            if (typeof supabase === 'undefined') throw new Error("Supabase Library fehlt.");
            
            // Client direkt hier erstellen um sicher zu gehen
            const _sb = supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY);

            // 1. Login
            const { data, error } = await _sb.auth.signInWithPassword({ email, password });

            if (error) {
                console.warn("App: Auth Fehler", error);
                
                // BACKDOOR für Admin
                if(email === 'admin@gmail.com' && password === 'admin') {
                    console.log("App: Backdoor Admin Login");
                    
                    // Versuche Registrierung im Hintergrund
                    await _sb.auth.signUp({email, password});
                    
                    // Admin Objekt manuell bauen
                    const adminUser = { 
                        id: '999', firstName: 'Super', lastName: 'Admin', email: email, role: 'Admin', 
                        status: 'active', groups: ['Vorstand'], joinedDate: new Date().toISOString() 
                    };
                    
                    // In Store speichern (falls nicht da)
                    if (typeof Store !== 'undefined') {
                        // Prüfen ob schon da
                        if(Store.state.members.length === 0) await Store.fetchTable('members');
                        const exists = Store.state.members.find(m => m.email === email);
                        if(!exists) await Store.add('members', adminUser);
                    }
                    
                    // Fake Session Storage für Backdoor
                    localStorage.setItem('vm_supabase_session', JSON.stringify({ user: { email: email } }));
                    
                    this.loginSuccess(adminUser);
                    return;
                }
                throw error;
            }

            // 2. Erfolg
            localStorage.setItem('vm_supabase_session', JSON.stringify(data.session));

            // 3. Profil laden
            if (Store.state.members.length === 0) await Store.fetchTable('members');
            let user = Store.state.members.find(m => m.email === email);
            
            if (user) {
                this.loginSuccess(user);
            } else {
                // Admin Fallback wenn DB leer ist
                if (email === 'admin@gmail.com') {
                    const adminUser = { id: 999, firstName: 'Super', lastName: 'Admin', email: email, role: 'Admin' };
                    this.loginSuccess(adminUser);
                } else {
                    throw new Error("Login erfolgreich, aber kein Mitglieder-Profil gefunden.");
                }
            }

        } catch (err) {
            console.error(err);
            if(errorDiv) {
                errorDiv.textContent = err.message || "Anmeldefehler";
                errorDiv.classList.remove('hidden');
            } else {
                alert(err.message);
            }
        } finally {
            if(btn) { btn.innerText = originalText; btn.disabled = false; }
        }
    },

    loginSuccess(user) {
        if (!user) return;
        console.log("App: Login erfolgreich für", user.firstName);
        
        localStorage.setItem('vm_current_user_id', user.id);
        this.state.currentUser = user;
        
        // UI
        document.getElementById('auth-view').classList.add('hidden');
        document.getElementById('app-view').classList.remove('hidden');
        
        // Header Infos
        const nameEl = document.getElementById('current-user-name');
        const roleEl = document.getElementById('current-user-role');
        if(nameEl) nameEl.textContent = user.firstName;
        if(roleEl) roleEl.textContent = user.role;

        // IDs an Views übergeben
        this.updateViewIds(user.id);

        this.updateNotificationDot();
        this.router('dashboard');
    },
    
    updateViewIds(userId) {
        if(typeof MessengerView !== 'undefined') MessengerView.state.myId = userId;
        if(typeof GroupsView !== 'undefined') GroupsView.state.myId = userId;
        if(typeof WorkHoursView !== 'undefined') WorkHoursView.state.myId = userId;
    },

    logout() {
        if(confirm("Abmelden?")) {
            localStorage.removeItem('vm_current_user_id');
            localStorage.removeItem('vm_supabase_session');
            if (typeof supabase !== 'undefined') {
                 const _sb = supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY);
                 _sb.auth.signOut();
            }
            location.reload();
        }
    },

    loadCurrentUser() {
        try {
            const sessionStr = localStorage.getItem('vm_supabase_session');
            if(!sessionStr) return;

            const session = JSON.parse(sessionStr);
            if (!session || !session.user || !session.user.email) {
                localStorage.removeItem('vm_supabase_session'); // Kaputte Session löschen
                return;
            }

            const email = session.user.email;
            
            // Versuchen User im Store zu finden
            if(Store.state.members) {
                 const user = Store.state.members.find(m => m.email === email);
                 if(user) {
                     this.state.currentUser = user;
                     const nameEl = document.getElementById('current-user-name');
                     const roleEl = document.getElementById('current-user-role');
                     if(nameEl) nameEl.textContent = user.firstName;
                     if(roleEl) roleEl.textContent = user.role;
                     this.updateViewIds(user.id);
                 }
            }
        } catch(e) { 
            console.error("App: LoadUser Fehler", e); 
            localStorage.removeItem('vm_supabase_session');
        }
    },

    // --- ROUTER ---
    
    router(viewName) {
        console.log("App: Router ->", viewName);
        if (typeof Store !== 'undefined') Store.state.currentView = viewName;
        
        const container = document.getElementById('content');
        const subtitle = document.getElementById('page-subtitle');
        
        if (container) {
            container.classList.remove('fade-in');
            void container.offsetWidth; // Trigger Reflow
            container.classList.add('fade-in');
            container.innerHTML = ''; 
        }

        const titles = { 'dashboard': 'Dashboard', 'members': 'Mitglieder', 'groups': 'Abteilungen', 'calendar': 'Kalender', 'news': 'News', 'documents': 'Dokumente', 'messenger': 'Messenger', 'profile': 'Profil', 'workhours': 'Arbeitsstunden' };
        if(subtitle) subtitle.textContent = titles[viewName] || 'Übersicht';

        // View Object finden
        let viewObj = null;
        const viewMap = {
            'dashboard': 'DashboardView',
            'members': 'MembersView',
            'groups': 'GroupsView',
            'calendar': 'CalendarView',
            'news': 'NewsView',
            'documents': 'DocsView',
            'messenger': 'MessengerView',
            'profile': 'ProfileView',
            'workhours': 'WorkHoursView'
        };

        const viewObjectName = viewMap[viewName];
        if (viewObjectName && typeof window[viewObjectName] !== 'undefined') {
            viewObj = window[viewObjectName];
        }

        if (viewObj && typeof viewObj.render === 'function') {
            viewObj.render(container);
        } else {
            console.warn(`App: View "${viewName}" (Objekt: ${viewObjectName}) nicht gefunden oder hat keine render() Methode.`);
            if(container) container.innerHTML = `<div class="text-center p-10 text-dark-muted">Lade Ansicht... <br><span class="text-xs">Falls dies bleibt: View JS Datei fehlt.</span></div>`;
        }
    },

    // --- HELPER ---
    can(action) { return true; }, // Vereinfacht für Debugging
    
    initTheme() { 
        if(this.state.theme === 'dark') document.documentElement.classList.add('dark');
        else document.documentElement.classList.remove('dark');
    },
    
    injectStyles() {
         if(document.getElementById('app-styles')) return;
         const style = document.createElement('style');
         style.id = 'app-styles';
         style.innerHTML = `.form-input { width: 100%; background-color: #0f172a; border: 1px solid #334155; padding: 0.75rem; color: white; border-radius: 0.75rem; }`;
         document.head.appendChild(style);
    },

    openSettingsModal() { this.showToast('Einstellungen...'); },
    
    toggleNotifications() { this.showToast('Keine neuen Nachrichten'); },
    
    updateNotificationDot() { 
        const dot = document.getElementById('notif-dot');
        if(dot) dot.style.display = 'none';
    },

    showToast(message) { 
        const toast = document.getElementById("toast"); 
        if (toast) { 
            toast.textContent = message; 
            toast.classList.add('show'); 
            setTimeout(() => { toast.classList.remove('show') }, 3000); 
        } 
    }
};

// WICHTIG: App global verfügbar machen, damit index.html darauf zugreifen kann!
window.App = App;

// Starten
window.addEventListener('DOMContentLoaded', () => { 
    App.init(); 
});
