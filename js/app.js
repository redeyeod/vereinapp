/**
 * =============================================================================
 * APP CORE LOGIC
 * Steuert Navigation (Router), Initialisierung, Theming und globale UI-Elemente
 * =============================================================================
 */

const App = {
    // Lokaler State für die App-Steuerung
    state: {
        lastRead: parseInt(localStorage.getItem('vm_last_read')) || 0,
        theme: localStorage.getItem('vm_theme') || 'dark',
        currentUser: null // Speichert das volle User-Objekt inkl. Rolle
    },

    /**
     * Startet die Anwendung
     */
    async init() {
        console.log("App wird initialisiert...");

        // 1. Warte auf Store
        let attempts = 0;
        while (typeof Store === 'undefined' && attempts < 20) {
            await new Promise(r => setTimeout(r, 100));
            attempts++;
        }

        if (typeof Store === 'undefined') {
            console.error("KRITISCHER FEHLER: Store.js wurde nicht geladen!");
            return;
        }

        // 2. Daten-Store initialisieren
        // Wir warten hier explizit, damit Daten da sind bevor gerendert wird
        await Store.init();

        // 3. Reaktivität einrichten
        Store.onUpdate = () => {
            this.updateNotificationDot();
            const activeTag = document.activeElement ? document.activeElement.tagName : '';
            const isTyping = (activeTag === 'INPUT' || activeTag === 'TEXTAREA');

            // Spezielle Ausnahme: Messenger kümmert sich selbst um Updates wenn offen
            if (!isTyping || Store.state.currentView !== 'messenger') {
                 this.router(Store.state.currentView);
            }
        };

        this.loadCurrentUser();
        this.initTheme();
        this.injectStyles();
        this.updateNotificationDot();
        
        // Start-View laden
        this.router('dashboard');
    },

    // --- NEUE LOGIN LOGIK (Integriert) ---
    async login(e) {
        e.preventDefault();
        const btn = e.target.querySelector('button');
        const originalText = btn.innerText;
        btn.innerText = "Lade...";
        btn.disabled = true;

        const fd = new FormData(e.target);
        const email = fd.get('email');
        const password = fd.get('password');

        try {
            // 1. Sicherstellen, dass Store bereit ist und Daten hat
            if (typeof Store === 'undefined') {
                alert("Fehler: Store.js nicht geladen.");
                return;
            }
            
            // Wenn Store leer ist, erzwinge Initialisierung
            if (Store.state.members.length === 0) {
                await Store.init();
            }

            // Supabase Client holen
            if (typeof supabase === 'undefined' || typeof CONFIG === 'undefined') {
                alert("Fehler: Supabase oder Config fehlt.");
                return;
            }
            const { createClient } = supabase;
            const _sb = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY);

            // 2. Auth Login Versuch
            const { data, error } = await _sb.auth.signInWithPassword({ email, password });

            if (error) {
                // BACKDOOR: Erster Admin Login (wenn noch nicht registriert)
                if(email === 'admin@gmail.com' && password === 'admin') {
                    const { data: reg, error: regErr } = await _sb.auth.signUp({email, password});
                    if (!regErr) {
                        // Admin User in DB anlegen
                        const adminUser = { 
                            firstName: 'Super', lastName: 'Admin', email: email, role: 'Admin', 
                            status: 'active', groups: ['Vorstand'], joinedDate: new Date().toISOString() 
                        };
                        
                        await Store.add('members', adminUser);
                        localStorage.setItem('vm_supabase_session', JSON.stringify(reg.session));
                        
                        // ID finden (durch Store Reload)
                        await Store.fetchTable('members');
                        const created = Store.state.members.find(m => m.email === email);
                        if(created) this.loginSuccess(created);
                        return;
                    }
                }
                throw new Error("Login fehlgeschlagen: " + error.message);
            }

            // 3. Login erfolgreich -> User in DB suchen
            localStorage.setItem('vm_supabase_session', JSON.stringify(data.session));
            
            // Wir suchen den User in den geladenen Daten
            let user = Store.state.members.find(m => m.email === email);
            
            // Falls nicht gefunden (z.B. neu registriert), neu laden
            if (!user) {
                await Store.fetchTable('members');
                user = Store.state.members.find(m => m.email === email);
            }

            if (user) {
                this.loginSuccess(user);
            } else {
                // Admin Backdoor Fallback (Auth da, DB Eintrag fehlt)
                if (email === 'admin@gmail.com') {
                     const adminUser = { firstName: 'Super', lastName: 'Admin', email: email, role: 'Admin', status: 'active', groups: ['Vorstand'], joinedDate: new Date().toISOString() };
                     await Store.add('members', adminUser);
                     // Kurz warten und neu suchen
                     await new Promise(r => setTimeout(r, 1000));
                     await Store.fetchTable('members');
                     const newAdmin = Store.state.members.find(m => m.email === email);
                     if(newAdmin) this.loginSuccess(newAdmin);
                     else alert("Konnte Admin-Profil nicht erstellen.");
                } else {
                    alert('Login erfolgreich, aber kein Mitgliedsprofil gefunden. Bitte Admin kontaktieren.');
                    _sb.auth.signOut();
                }
            }

        } catch (err) {
            console.error(err);
            alert(err.message);
        } finally {
            btn.innerText = originalText;
            btn.disabled = false;
        }
    },

    loginSuccess(user) {
        localStorage.setItem('vm_current_user_id', user.id);
        
        // UI Umschalten
        const authView = document.getElementById('auth-view');
        const appView = document.getElementById('app-view');
        if(authView) authView.classList.add('hidden');
        if(appView) appView.classList.remove('hidden');

        // Header Infos setzen
        const nameEl = document.getElementById('current-user-name');
        const roleEl = document.getElementById('current-user-role');
        if(nameEl) nameEl.textContent = user.firstName;
        if(roleEl) roleEl.textContent = user.role;

        // IDs für Views setzen
        if(typeof MessengerView !== 'undefined') MessengerView.state.myId = user.id;
        if(typeof GroupsView !== 'undefined') GroupsView.state.myId = user.id;
        if(typeof WorkHoursView !== 'undefined') WorkHoursView.state.myId = user.id;

        // App starten
        this.loadCurrentUser();
        this.init();
    },

    logout() {
        if(confirm("Möchten Sie sich wirklich abmelden?")) {
            localStorage.removeItem('vm_current_user_id');
            localStorage.removeItem('vm_supabase_session');
            location.reload();
        }
    },

    loadCurrentUser() {
        // Wir laden die Session vom Supabase Auth
        const sessionStr = localStorage.getItem('vm_supabase_session');
        if(sessionStr && typeof Store !== 'undefined') {
            try {
                const session = JSON.parse(sessionStr);
                const email = session.user.email;
                
                const user = Store.state.members.find(m => m.email === email);
                if(user) {
                    this.state.currentUser = user;
                    // IDs für Views setzen (damit diese wissen, wer "Ich" ist)
                    if (typeof MessengerView !== 'undefined') MessengerView.state.myId = user.id;
                    if (typeof GroupsView !== 'undefined') GroupsView.state.myId = user.id;
                    if (typeof WorkHoursView !== 'undefined') WorkHoursView.state.myId = user.id;
                }
            } catch(e) { 
                console.error("Fehler beim Laden des Benutzers:", e); 
            }
        }
    },

    // --- PERMISSION SYSTEM (RBAC) ---
    can(action) {
        if (!this.state.currentUser) this.loadCurrentUser();
        const user = this.state.currentUser;
        if (!user) return false; 

        const role = user.role || 'Mitglied';
        
        const roles = {
            admin: ['1. Vorstand', '2. Vorstand', '3. Vorstand', '4. Vorstand', 'Präsident', 'Vize-Präsident', 'Admin', 'Vorstand'], 
            manager: ['Kassenwart', 'Protokollant', 'Trainer', 'Abteilungsleiter'], 
            member: ['Mitglied', 'Ehren-Mitglied', 'Beisitzer', 'Gast'] 
        };

        const permissions = {
            admin:   ['manage_members', 'manage_groups', 'manage_events', 'manage_news', 'manage_docs', 'manage_workhours', 'settings', 'delete_content'],
            manager: ['manage_workhours'], 
            member:  [] 
        };

        let userGroup = 'member';
        if (roles.admin.includes(role)) userGroup = 'admin';
        else if (roles.manager.includes(role)) userGroup = 'manager';

        return permissions[userGroup].includes(action);
    },

    // --- THEMING & ROUTING ---
    initTheme() { this.applyTheme(); },
    
    toggleTheme() { 
        this.state.theme = this.state.theme === 'dark' ? 'light' : 'dark'; 
        localStorage.setItem('vm_theme', this.state.theme); 
        this.applyTheme(); 
        if(document.getElementById('settings-modal')) this.openSettingsModal(); 
    },
    
    applyTheme() {
        const root = document.documentElement;
        if (this.state.theme === 'dark') { 
            root.classList.add('dark'); 
            root.style.setProperty('--bg-color', '#0f172a'); 
            root.style.setProperty('--card-color', '#1e293b'); 
            root.style.setProperty('--border-color', '#334155'); 
            root.style.setProperty('--text-color', '#f1f5f9'); 
            root.style.setProperty('--muted-color', '#94a3b8'); 
        } else { 
            root.classList.remove('dark'); 
            root.style.setProperty('--bg-color', '#f1f5f9'); 
            root.style.setProperty('--card-color', '#ffffff'); 
            root.style.setProperty('--border-color', '#e2e8f0'); 
            root.style.setProperty('--text-color', '#0f172a'); 
            root.style.setProperty('--muted-color', '#64748b'); 
        }
    },

    // --- ROBUST ROUTER ---
    router(viewName) {
        if (typeof Store !== 'undefined') Store.state.currentView = viewName;
        
        const container = document.getElementById('content');
        const subtitle = document.getElementById('page-subtitle');
        
        if (container) {
            container.classList.remove('fade-in');
            void container.offsetWidth; // Trigger Reflow
            container.classList.add('fade-in');
            container.innerHTML = ''; 
        }

        const titles = {
            'dashboard': 'Dashboard',
            'members': 'Mitgliederverwaltung',
            'groups': 'Abteilungen',
            'calendar': 'Kalender',
            'news': 'Ankündigungen',
            'documents': 'Dokumente',
            'messenger': 'Messenger',
            'profile': 'Mein Profil',
            'workhours': 'Arbeitsstunden'
        };
        if(subtitle) subtitle.textContent = titles[viewName] || 'Übersicht';

        const views = {
            'dashboard': typeof DashboardView !== 'undefined' ? DashboardView : null,
            'members': typeof MembersView !== 'undefined' ? MembersView : null,
            'groups': typeof GroupsView !== 'undefined' ? GroupsView : null,
            'calendar': typeof CalendarView !== 'undefined' ? CalendarView : null,
            'news': typeof NewsView !== 'undefined' ? NewsView : null,
            'documents': typeof DocsView !== 'undefined' ? DocsView : null,
            'messenger': typeof MessengerView !== 'undefined' ? MessengerView : null,
            'profile': typeof ProfileView !== 'undefined' ? ProfileView : null,
            'workhours': typeof WorkHoursView !== 'undefined' ? WorkHoursView : null
        };

        const currentViewObj = views[viewName];

        if (currentViewObj) {
            try {
                currentViewObj.render(container);
            } catch (e) {
                console.error(`Fehler beim Rendern von ${viewName}:`, e);
                container.innerHTML = `<div class="p-8 text-center text-red-400">Fehler beim Laden der Ansicht:<br>${e.message}</div>`;
            }
        } else {
            console.warn(`View "${viewName}" Objekt nicht gefunden.`);
            if(container) {
                container.innerHTML = `
                    <div class="flex flex-col items-center justify-center h-64 text-dark-muted">
                        <i class="fa-solid fa-spinner fa-spin text-3xl mb-4"></i>
                        <p>Lade Modul... (${viewName})</p>
                        <p class="text-xs mt-2 opacity-50">Falls dies lange dauert, bitte Seite neu laden.</p>
                    </div>`;
            }
            
            setTimeout(() => {
                if (Store.state.currentView === viewName) {
                    const retryView = (typeof window[viewName.charAt(0).toUpperCase() + viewName.slice(1) + 'View'] !== 'undefined') 
                                    ? window[viewName.charAt(0).toUpperCase() + viewName.slice(1) + 'View'] 
                                    : null;
                    if (retryView) retryView.render(container);
                }
            }, 1000);
        }
    },

    injectStyles() {
         if(document.getElementById('app-styles')) return;
         const style = document.createElement('style');
         style.id = 'app-styles';
         style.innerHTML = `
            .form-input { width: 100%; background-color: var(--bg-color); border: 1px solid var(--border-color); border-radius: 0.75rem; padding: 0.75rem; color: var(--text-color); transition: box-shadow 0.2s, border-color 0.2s; }
            .form-input:focus { outline: none; ring: 2px solid #3b82f6; border-color: #3b82f6; }
            .btn-primary { background-color: #2563eb; color: white; font-weight: 700; padding: 0.75rem 1.5rem; border-radius: 0.75rem; transition: all 0.2s; box-shadow: 0 10px 15px -3px rgba(30, 58, 138, 0.4); cursor: pointer; }
            .btn-primary:hover { background-color: #1d4ed8; }
            .notif-scrollbar::-webkit-scrollbar { width: 6px; }
            .notif-scrollbar::-webkit-scrollbar-track { background: var(--card-color); }
            .notif-scrollbar::-webkit-scrollbar-thumb { background: var(--border-color); border-radius: 3px; }
         `;
         document.head.appendChild(style);
    },

    // --- UI HELPERS ---
    
    openSettingsModal() { 
        const isDark = this.state.theme === 'dark';
        this.openModal(`<div class="p-6"><h3 class="text-xl font-bold text-dark-text mb-4">Einstellungen</h3><div class="flex items-center justify-between p-4 rounded-xl bg-dark-bg border border-dark-border"><p class="text-dark-text">Dark Mode</p><button onclick="App.toggleTheme()" class="bg-blue-600 text-white px-4 py-2 rounded-lg text-xs font-bold">${isDark ? 'An' : 'Aus'}</button></div><div class="p-4 rounded-xl bg-dark-bg border border-dark-border text-center mt-6"><p class="text-sm text-dark-muted mb-2">VereinsManager App v1.3.1</p><button onclick="if(confirm('Alle lokalen Daten löschen und abmelden?')) { localStorage.clear(); location.reload(); }" class="text-xs text-red-400 hover:underline">Reset Cache</button></div></div>`);
    },
    
    toggleNotifications() {
        // ... (Code identisch zur vorherigen Version für Notifs) ...
        let overlay = document.getElementById('notification-overlay');
        if (overlay && !overlay.classList.contains('hidden')) { overlay.classList.add('hidden'); return; }

        const lastRead = this.state.lastRead;
        const news = Store.state.news.filter(n => new Date(n.date).getTime() > lastRead);
        const chats = [];
        
        Store.state.groups.forEach(g => { if (g.chat && g.chat.length > 0) { const lastMsg = g.chat[g.chat.length - 1]; if (new Date(lastMsg.time).getTime() > lastRead) { chats.push({ groupName: g.name, groupId: g.id, message: lastMsg.text, sender: lastMsg.sender, time: lastMsg.time }); } } });
        chats.sort((a, b) => new Date(b.time) - new Date(a.time));

        let html = `<div class="absolute top-20 right-6 w-96 bg-dark-card border border-dark-border rounded-xl shadow-2xl z-50 overflow-hidden flex flex-col max-h-[500px]" onclick="event.stopPropagation()"><div class="p-4 border-b border-dark-border bg-dark-bg/95 backdrop-blur flex justify-between items-center sticky top-0"><h3 class="font-bold text-dark-text"><i class="fa-regular fa-bell mr-2"></i>Benachrichtigungen</h3><button onclick="document.getElementById('notification-overlay').classList.add('hidden')" class="text-dark-muted hover:text-dark-text transition-colors"><i class="fa-solid fa-times"></i></button></div><div class="overflow-y-auto notif-scrollbar flex-1">`;
        if (news.length === 0 && chats.length === 0) { html += `<div class="p-8 text-center text-dark-muted flex flex-col items-center"><i class="fa-regular fa-bell-slash text-3xl mb-2 opacity-50"></i><p class="text-sm">Keine neuen Nachrichten.</p></div>`; } 
        else {
            if (news.length > 0) { html += `<div class="px-4 py-2 text-[10px] font-bold text-blue-400 uppercase tracking-wider bg-dark-bg/50 sticky top-0 backdrop-blur-sm">Ankündigungen</div>`; news.forEach(n => { html += `<div onclick="App.router('news'); document.getElementById('notification-overlay').classList.add('hidden')" class="p-4 border-b border-dark-border hover:bg-dark-hover cursor-pointer transition-colors group"><div class="flex justify-between items-start mb-1"><p class="text-sm text-dark-text font-bold truncate pr-2 group-hover:text-blue-400 transition-colors">${n.title}</p><span class="text-[10px] text-dark-muted whitespace-nowrap">${new Date(n.date).toLocaleDateString()}</span></div><p class="text-xs text-dark-muted line-clamp-2">${n.content}</p></div>`; }); }
            if (chats.length > 0) { html += `<div class="px-4 py-2 text-[10px] font-bold text-green-400 uppercase tracking-wider bg-dark-bg/50 sticky top-0 backdrop-blur-sm mt-2">Neue Chats</div>`; chats.forEach(c => { html += `<div onclick="GroupsView.openGroup(${c.groupId}); GroupsView.switchTab('chat'); document.getElementById('notification-overlay').classList.add('hidden')" class="p-4 border-b border-dark-border hover:bg-dark-hover cursor-pointer transition-colors group"><div class="flex justify-between items-center mb-1"><span class="text-xs font-bold text-dark-text bg-dark-bg border border-dark-border px-2 py-0.5 rounded-md">${c.groupName}</span><span class="text-[10px] text-dark-muted">${new Date(c.time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span></div><div class="text-xs mt-1"><span class="text-dark-text font-medium mr-1">${c.sender}:</span><span class="text-dark-muted group-hover:text-dark-text transition-colors">${c.message}</span></div></div>`; }); }
        }
        html += `</div>`; if (news.length > 0 || chats.length > 0) { html += `<div class="p-3 bg-dark-bg/50 border-t border-dark-border text-center"><button onclick="App.markAllAsRead()" class="text-xs font-bold text-blue-400 hover:text-blue-300 hover:underline">Alle als gelesen markieren</button></div>`; } html += `</div>`;
        if (!overlay) { overlay = document.createElement('div'); overlay.id = 'notification-overlay'; overlay.className = 'fixed inset-0 z-50 hidden'; overlay.onclick = (e) => { if(e.target === overlay) overlay.classList.add('hidden'); }; document.body.appendChild(overlay); } overlay.innerHTML = html; overlay.classList.remove('hidden');
    },

    markAllAsRead() { this.state.lastRead = Date.now(); localStorage.setItem('vm_last_read', this.state.lastRead); document.getElementById('notification-overlay').classList.add('hidden'); this.updateNotificationDot(); App.showToast('Alle als gelesen markiert'); },
    updateNotificationDot() { const lastRead = this.state.lastRead; let hasNew = false; if (Store.state.news.some(n => new Date(n.date).getTime() > lastRead)) hasNew = true; if (!hasNew) Store.state.groups.forEach(g => { if (g.chat && g.chat.length > 0) { const lastMsg = g.chat[g.chat.length - 1]; if (new Date(lastMsg.time).getTime() > lastRead) hasNew = true; } }); const dot = document.querySelector('button[onclick="App.toggleNotifications()"] span'); if (dot) dot.style.display = hasNew ? 'block' : 'none'; },
    openModal(htmlContent) { const overlay = document.getElementById('modal-overlay'); const content = document.getElementById('modal-content'); if (overlay && content) { content.innerHTML = htmlContent; overlay.classList.remove('hidden'); setTimeout(() => { content.classList.remove('scale-95', 'opacity-0'); content.classList.add('scale-100', 'opacity-100'); }, 10); } },
    closeModal() { const overlay = document.getElementById('modal-overlay'); const content = document.getElementById('modal-content'); if (overlay && content) { content.classList.remove('scale-100', 'opacity-100'); content.classList.add('scale-95', 'opacity-0'); setTimeout(() => { overlay.classList.add('hidden'); content.innerHTML = ''; }, 300); } },
    showToast(message) { const toast = document.getElementById("toast"); if (toast) { toast.textContent = message; toast.classList.add('show'); setTimeout(() => { toast.classList.remove('show'),3000); } } }
};

// Globaler Hook für den Login-Formular Submit (überschreibt inline handler)
window.handleLogin = (e) => App.login(e);
window.logout = () => App.logout();

// Start
window.addEventListener('DOMContentLoaded', () => { App.init(); });
