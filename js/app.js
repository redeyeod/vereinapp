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

        // 1. Daten-Store initialisieren (Async für Cloud)
        if (typeof Store !== 'undefined') {
            await Store.init();

            // ZENTRALE UPDATE LOGIK
            // Wird aufgerufen, wenn sich Daten im Store ändern (durch User oder Cloud)
            Store.onUpdate = () => {
                this.updateNotificationDot();
                
                // Prüfen, ob der User gerade tippt. Wenn ja, KEIN komplettes Neurendern,
                // da sonst das Textfeld den Fokus verliert.
                const activeTag = document.activeElement ? document.activeElement.tagName : '';
                const isTyping = (activeTag === 'INPUT' || activeTag === 'TEXTAREA');

                // Spezielle Ausnahme: Wenn wir im Messenger sind und tippen, kümmert sich der Messenger selbst ums Update.
                // In allen anderen Fällen (oder wenn nicht getippt wird) rendern wir neu.
                if (!isTyping || Store.state.currentView !== 'messenger') {
                     this.router(Store.state.currentView);
                } else {
                    console.log("Update empfangen, aber User tippt gerade. Überspringe Render.");
                }
            };
        } else {
            console.error("KRITISCHER FEHLER: Store.js wurde nicht geladen!");
            return;
        }

        this.loadCurrentUser();
        this.initTheme();
        this.injectStyles();
        this.updateNotificationDot();
        this.router('dashboard');
    },

    loadCurrentUser() {
        // Wir laden die Session vom Supabase Auth
        const sessionStr = localStorage.getItem('vm_supabase_session');
        if(sessionStr && typeof Store !== 'undefined') {
            const session = JSON.parse(sessionStr);
            const email = session.user.email;
            
            // User im Store finden
            // Falls Store noch leer (Daten laden noch), wird dies später durch onUpdate korrigiert
            const user = Store.state.members.find(m => m.email === email);
            if(user) {
                this.state.currentUser = user;
                // Header-Infos aktualisieren
                const nameEl = document.getElementById('current-user-name');
                const roleEl = document.getElementById('current-user-role');
                if(nameEl) nameEl.textContent = user.firstName;
                if(roleEl) roleEl.textContent = user.role;

                // IDs für Views setzen
                if (typeof MessengerView !== 'undefined') MessengerView.state.myId = user.id;
                if (typeof GroupsView !== 'undefined') GroupsView.state.myId = user.id;
                if (typeof WorkHoursView !== 'undefined') WorkHoursView.state.myId = user.id;
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
    toggleTheme() { this.state.theme = this.state.theme === 'dark' ? 'light' : 'dark'; localStorage.setItem('vm_theme', this.state.theme); this.applyTheme(); if(document.getElementById('settings-modal')) this.openSettingsModal(); },
    applyTheme() {
        const root = document.documentElement;
        if (this.state.theme === 'dark') { root.classList.add('dark'); root.style.setProperty('--bg-color', '#0f172a'); root.style.setProperty('--card-color', '#1e293b'); root.style.setProperty('--border-color', '#334155'); root.style.setProperty('--text-color', '#f1f5f9'); root.style.setProperty('--muted-color', '#94a3b8'); } 
        else { root.classList.remove('dark'); root.style.setProperty('--bg-color', '#f1f5f9'); root.style.setProperty('--card-color', '#ffffff'); root.style.setProperty('--border-color', '#e2e8f0'); root.style.setProperty('--text-color', '#0f172a'); root.style.setProperty('--muted-color', '#64748b'); }
    },

    router(viewName) {
        if (typeof Store !== 'undefined') Store.state.currentView = viewName;
        const container = document.getElementById('content');
        const subtitle = document.getElementById('page-subtitle');
        if (container) { container.classList.remove('fade-in'); void container.offsetWidth; container.classList.add('fade-in'); container.innerHTML = ''; }
        
        if(subtitle) {
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
            subtitle.textContent = titles[viewName] || 'Übersicht';
        }

        // FIX: Explizite Zuordnung der Views statt dynamischer Fenster-Suche
        // Das löst das Problem, dass const-Variablen nicht auf window gefunden werden
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
            currentViewObj.render(container);
        } else {
             // Fallback oder Fehler
             if(container) container.innerHTML = `<div class="text-center p-10 text-dark-muted">
                <i class="fa-solid fa-triangle-exclamation text-3xl mb-2 text-yellow-500"></i><br>
                Modul "${viewName}" konnte nicht geladen werden.<br>
                <span class="text-xs opacity-70">Stellen Sie sicher, dass die Datei js/views/${viewName}.js geladen wurde.</span>
             </div>`;
             console.error(`View "${viewName}" nicht gefunden. Verfügbare Views:`, Object.keys(views).filter(k => views[k] !== null));
        }
    },

    injectStyles() {
         if(document.getElementById('app-styles')) return;
         const style = document.createElement('style');
         style.id = 'app-styles';
         style.innerHTML = `
            .form-input { width: 100%; background-color: var(--bg-color); border: 1px solid var(--border-color); border-radius: 0.75rem; padding: 0.75rem; color: var(--text-color); transition: box-shadow 0.2s, border-color 0.2s; }
            .form-input:focus { outline: none; ring: 2px solid #3b82f6; border-color: #3b82f6; }
            .btn-primary { background-color: #2563eb; color: white; font-weight: 700; padding: 0.75rem 1.5rem; border-radius: 0.75rem; transition: 0.2s; cursor: pointer; }
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
        this.openModal(`<div class="p-6"><h3 class="text-xl font-bold text-dark-text mb-4">Einstellungen</h3><div class="flex items-center justify-between p-4 rounded-xl bg-dark-bg border border-dark-border"><p class="text-dark-text">Dark Mode</p><button onclick="App.toggleTheme()" class="bg-blue-600 text-white px-4 py-2 rounded-lg text-xs font-bold">${isDark ? 'An' : 'Aus'}</button></div><div class="p-4 rounded-xl bg-dark-bg border border-dark-border text-center mt-6"><p class="text-sm text-dark-muted mb-2">VereinsManager App v1.2.0</p><button onclick="if(confirm('Alle lokalen Daten löschen und abmelden?')) { localStorage.clear(); location.reload(); }" class="text-xs text-red-400 hover:underline">App zurücksetzen & Cache leeren</button></div></div>`);
    },
    
    toggleNotifications() {
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
    
    openModal(html) { const o=document.getElementById('modal-overlay'), c=document.getElementById('modal-content'); if(o&&c){ c.innerHTML=html; o.classList.remove('hidden'); setTimeout(()=>c.classList.remove('scale-95','opacity-0'),10); } },
    closeModal() { document.getElementById('modal-overlay').classList.add('hidden'); },
    showToast(msg) { const t=document.getElementById('toast'); if(t){ t.textContent=msg; t.classList.add('show'); setTimeout(()=>t.classList.remove('show'),3000); } }
};

window.addEventListener('DOMContentLoaded', () => { App.init(); });
