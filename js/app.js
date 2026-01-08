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

            // Reaktivität: Wenn Daten aus der Cloud kommen, UI aktualisieren
            Store.onUpdate = () => {
                this.updateNotificationDot();
                
                // Nur rerendern, wenn wir nicht gerade Text eingeben (verhindert Fokusverlust)
                if (document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
                     this.router(Store.state.currentView);
                }
            };
        } else {
            console.error("KRITISCHER FEHLER: Store.js wurde nicht geladen!");
            return;
        }

        // 2. Aktuellen Benutzer laden (für Berechtigungen)
        this.loadCurrentUser();

        // 3. Theme initialisieren
        this.initTheme();

        // 4. Globale Styles injizieren
        const style = document.createElement('style');
        style.innerHTML = `
            .form-input { 
                width: 100%; 
                background-color: var(--bg-color); 
                border: 1px solid var(--border-color); 
                border-radius: 0.75rem; 
                padding: 0.75rem; 
                color: var(--text-color); 
                transition: box-shadow 0.2s, border-color 0.2s; 
            }
            .form-input:focus { 
                outline: none; 
                ring: 2px solid #3b82f6; 
                border-color: #3b82f6;
            }
            .text-muted { 
                display: block; 
                font-size: 0.875rem; 
                font-weight: 500; 
                color: var(--muted-color); 
                margin-bottom: 0.5rem; 
            }
            .btn-primary { 
                background-color: #2563eb; 
                color: white; 
                font-weight: 700; 
                padding: 0.75rem 1.5rem; 
                border-radius: 0.75rem; 
                transition: all 0.2s; 
                box-shadow: 0 10px 15px -3px rgba(30, 58, 138, 0.4); 
                cursor: pointer;
            }
            .btn-primary:hover { 
                background-color: #1d4ed8; 
                transform: translateY(-1px);
            }
            .btn-green { 
                background-color: #16a34a; 
                color: white; 
                font-weight: 700; 
                padding: 0.75rem 1.5rem; 
                border-radius: 0.75rem; 
                transition: all 0.2s; 
                box-shadow: 0 10px 15px -3px rgba(20, 83, 45, 0.4); 
                cursor: pointer;
            }
            .btn-green:hover { 
                background-color: #15803d; 
                transform: translateY(-1px);
            }
            .dark-date { 
                color-scheme: dark; 
            }
            html:not(.dark) .dark-date {
                color-scheme: light;
            }
            .notif-scrollbar::-webkit-scrollbar { width: 6px; }
            .notif-scrollbar::-webkit-scrollbar-track { background: var(--card-color); }
            .notif-scrollbar::-webkit-scrollbar-thumb { background: var(--border-color); border-radius: 3px; }
        `;
        document.head.appendChild(style);

        // 5. Notification Status prüfen
        this.updateNotificationDot();

        // 6. Startseite laden
        this.router('dashboard');
    },

    loadCurrentUser() {
        const sessionStr = localStorage.getItem('vm_supabase_session');
        if(sessionStr && typeof Store !== 'undefined') {
            const session = JSON.parse(sessionStr);
            const email = session.user.email;
            
            // Wir suchen den User anhand der Email in den geladenen Daten
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
            }
        }
    },

    // --- PERMISSION SYSTEM (RBAC) ---

    /**
     * Prüft, ob der aktuelle Benutzer eine bestimmte Aktion ausführen darf.
     * @param {string} action - Die angeforderte Aktion (z.B. 'manage_members')
     * @returns {boolean}
     */
    can(action) {
        // Sicherstellen, dass User geladen ist
        if (!this.state.currentUser) this.loadCurrentUser();
        
        const user = this.state.currentUser;
        if (!user) return false; // Nicht eingeloggt = keine Rechte

        const role = user.role || 'Mitglied';

        // 1. Definition der Rollen-Gruppen
        const roles = {
            // Admin-Rollen mit Schreibrechten
            admin: ['1. Vorstand', '2. Vorstand', '3. Vorstand', '4. Vorstand', 'Präsident', 'Vize-Präsident', 'Admin', 'Vorstand'], 
            
            // Manager-Rollen (können z.B. Arbeitsstunden verwalten)
            manager: ['Kassenwart', 'Protokollant', 'Trainer', 'Abteilungsleiter'], 
            
            // Normale Mitglieder (Nur Lesen)
            member: ['Mitglied', 'Ehren-Mitglied', 'Beisitzer', 'Gast'] 
        };

        // 2. Definition der Rechte pro Gruppe
        const permissions = {
            // Admin darf alles
            admin:   ['manage_members', 'manage_groups', 'manage_events', 'manage_news', 'manage_docs', 'manage_workhours', 'settings', 'delete_content'],
            
            // Manager dürfen Arbeitsstunden verwalten
            manager: ['manage_workhours'], 
            
            // Mitglieder haben nur Leserechte
            member:  [] 
        };

        // 3. Welche Gruppe hat der User?
        let userGroup = 'member'; // Standard-Fallback
        
        if (roles.admin.includes(role)) {
            userGroup = 'admin';
        } else if (roles.manager.includes(role)) {
            userGroup = 'manager';
        }

        // 4. Hat die Gruppe das Recht?
        return permissions[userGroup].includes(action);
    },

    // --- THEMING ---

    initTheme() {
        this.applyTheme();
    },

    toggleTheme() {
        this.state.theme = this.state.theme === 'dark' ? 'light' : 'dark';
        localStorage.setItem('vm_theme', this.state.theme);
        this.applyTheme();
        
        if(document.getElementById('settings-modal')) {
            this.openSettingsModal(); 
        }
    },

    applyTheme() {
        const root = document.documentElement;
        const isDark = this.state.theme === 'dark';
        
        if (isDark) {
            root.classList.add('dark');
            root.style.setProperty('--bg-color', '#0f172a');      
            root.style.setProperty('--card-color', '#1e293b');    
            root.style.setProperty('--border-color', '#334155');  
            root.style.setProperty('--text-color', '#f1f5f9');    
            root.style.setProperty('--muted-color', '#94a3b8');   
            root.style.setProperty('--hover-color', '#334155');   
        } else {
            root.classList.remove('dark');
            root.style.setProperty('--bg-color', '#f1f5f9');      
            root.style.setProperty('--card-color', '#ffffff');    
            root.style.setProperty('--border-color', '#e2e8f0');  
            root.style.setProperty('--text-color', '#0f172a');    
            root.style.setProperty('--muted-color', '#64748b');   
            root.style.setProperty('--hover-color', '#e2e8f0');   
        }
    },

    // --- ROUTER ---

    router(viewName) {
        if (typeof Store !== 'undefined') {
            Store.state.currentView = viewName;
        }

        const container = document.getElementById('content');
        const subtitle = document.getElementById('page-subtitle');
        
        if (container) {
            container.classList.remove('fade-in');
            void container.offsetWidth; // Trigger Reflow
            container.classList.add('fade-in');
            container.innerHTML = ''; 
        }
        
        // Titel im Header aktualisieren
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

        switch(viewName) {
            case 'dashboard':
                if(typeof DashboardView !== 'undefined') DashboardView.render(container);
                break;
            case 'members':
                if(typeof MembersView !== 'undefined') MembersView.render(container);
                break;
            case 'groups':
                if(typeof GroupsView !== 'undefined') GroupsView.render(container);
                break;
            case 'calendar':
                if(typeof CalendarView !== 'undefined') CalendarView.render(container);
                break;
            case 'news':
                if(typeof NewsView !== 'undefined') NewsView.render(container);
                break;
            case 'documents':
                if(typeof DocsView !== 'undefined') DocsView.render(container);
                break;
            case 'messenger':
                if(typeof MessengerView !== 'undefined') MessengerView.render(container);
                break;
            case 'profile':
                if(typeof ProfileView !== 'undefined') ProfileView.render(container);
                break;
            case 'workhours':
                if(typeof WorkHoursView !== 'undefined') WorkHoursView.render(container);
                break;
            default:
                console.warn(`View "${viewName}" ist nicht definiert.`);
                if(container) container.innerHTML = `<div class="text-center p-10 text-dark-muted">Modul "${viewName}" lädt...</div>`;
        }
    },

    // --- UI HELPERS ---

    openSettingsModal() {
        const isDark = this.state.theme === 'dark';
        
        const html = `
            <div id="settings-modal" class="p-6">
                <div class="flex justify-between items-center mb-6 border-b border-dark-border pb-4">
                    <h3 class="text-xl font-bold text-dark-text">Einstellungen</h3>
                    <button onclick="App.closeModal()" class="text-dark-muted hover:text-dark-text p-2 transition-colors"><i class="fa-solid fa-times text-xl"></i></button>
                </div>
                
                <div class="space-y-4">
                    <!-- Theme Toggle -->
                    <div class="flex items-center justify-between p-4 rounded-xl bg-dark-bg border border-dark-border">
                        <div class="flex items-center gap-3">
                            <div class="w-10 h-10 rounded-full bg-blue-500/20 text-blue-500 flex items-center justify-center">
                                <i class="fa-solid ${isDark ? 'fa-moon' : 'fa-sun'}"></i>
                            </div>
                            <div>
                                <p class="font-bold text-dark-text">Erscheinungsbild</p>
                                <p class="text-xs text-dark-muted">${isDark ? 'Dunkler Modus' : 'Heller Modus'} aktiv</p>
                            </div>
                        </div>
                        <button onclick="App.toggleTheme()" class="bg-dark-card border border-dark-border text-dark-text px-4 py-2 rounded-lg text-xs font-bold hover:border-blue-500 transition-colors">
                            Wechseln
                        </button>
                    </div>

                    <!-- Info & Reset -->
                    <div class="p-4 rounded-xl bg-dark-bg border border-dark-border text-center mt-6">
                        <p class="text-sm text-dark-muted mb-2">VereinsManager App v1.2.0</p>
                        <button onclick="if(confirm('Alle lokalen Daten löschen und abmelden?')) { localStorage.clear(); location.reload(); }" class="text-xs text-red-400 hover:underline">
                            App zurücksetzen & Cache leeren
                        </button>
                    </div>
                </div>
            </div>
        `;
        this.openModal(html);
    },

    toggleNotifications() {
        let overlay = document.getElementById('notification-overlay');
        
        if (overlay && !overlay.classList.contains('hidden')) {
            overlay.classList.add('hidden');
            return;
        }

        const lastRead = this.state.lastRead;
        const news = Store.state.news.filter(n => new Date(n.date).getTime() > lastRead);
        const chats = [];
        
        Store.state.groups.forEach(g => {
            if (g.chat && g.chat.length > 0) {
                const lastMsg = g.chat[g.chat.length - 1];
                if (new Date(lastMsg.time).getTime() > lastRead) {
                    chats.push({ groupName: g.name, groupId: g.id, message: lastMsg.text, sender: lastMsg.sender, time: lastMsg.time });
                }
            }
        });
        chats.sort((a, b) => new Date(b.time) - new Date(a.time));

        let html = `
            <div class="absolute top-20 right-6 w-96 bg-dark-card border border-dark-border rounded-xl shadow-2xl z-50 overflow-hidden flex flex-col max-h-[500px]" onclick="event.stopPropagation()">
                <div class="p-4 border-b border-dark-border bg-dark-bg/95 backdrop-blur flex justify-between items-center sticky top-0">
                    <h3 class="font-bold text-dark-text"><i class="fa-regular fa-bell mr-2"></i>Benachrichtigungen</h3>
                    <button onclick="document.getElementById('notification-overlay').classList.add('hidden')" class="text-dark-muted hover:text-dark-text transition-colors"><i class="fa-solid fa-times"></i></button>
                </div>
                <div class="overflow-y-auto notif-scrollbar flex-1">
        `;

        if (news.length === 0 && chats.length === 0) {
            html += `<div class="p-8 text-center text-dark-muted flex flex-col items-center"><i class="fa-regular fa-bell-slash text-3xl mb-2 opacity-50"></i><p class="text-sm">Keine neuen Nachrichten.</p></div>`;
        } else {
            if (news.length > 0) {
                html += `<div class="px-4 py-2 text-[10px] font-bold text-blue-400 uppercase tracking-wider bg-dark-bg/50 sticky top-0 backdrop-blur-sm">Ankündigungen</div>`;
                news.forEach(n => {
                    html += `
                        <div onclick="App.router('news'); document.getElementById('notification-overlay').classList.add('hidden')" class="p-4 border-b border-dark-border hover:bg-dark-hover cursor-pointer transition-colors group">
                            <div class="flex justify-between items-start mb-1"><p class="text-sm text-dark-text font-bold truncate pr-2 group-hover:text-blue-400 transition-colors">${n.title}</p><span class="text-[10px] text-dark-muted whitespace-nowrap">${new Date(n.date).toLocaleDateString()}</span></div>
                            <p class="text-xs text-dark-muted line-clamp-2">${n.content}</p>
                        </div>`;
                });
            }
            if (chats.length > 0) {
                html += `<div class="px-4 py-2 text-[10px] font-bold text-green-400 uppercase tracking-wider bg-dark-bg/50 sticky top-0 backdrop-blur-sm mt-2">Neue Chats</div>`;
                chats.forEach(c => {
                    html += `
                        <div onclick="GroupsView.openGroup(${c.groupId}); GroupsView.switchTab('chat'); document.getElementById('notification-overlay').classList.add('hidden')" class="p-4 border-b border-dark-border hover:bg-dark-hover cursor-pointer transition-colors group">
                            <div class="flex justify-between items-center mb-1"><span class="text-xs font-bold text-dark-text bg-dark-bg border border-dark-border px-2 py-0.5 rounded-md">${c.groupName}</span><span class="text-[10px] text-dark-muted">${new Date(c.time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span></div>
                            <div class="text-xs mt-1"><span class="text-dark-text font-medium mr-1">${c.sender}:</span><span class="text-dark-muted group-hover:text-dark-text transition-colors">${c.message}</span></div>
                        </div>`;
                });
            }
        }

        html += `</div>`;
        if (news.length > 0 || chats.length > 0) {
            html += `<div class="p-3 bg-dark-bg/50 border-t border-dark-border text-center"><button onclick="App.markAllAsRead()" class="text-xs font-bold text-blue-400 hover:text-blue-300 hover:underline">Alle als gelesen markieren</button></div>`;
        }
        html += `</div>`;

        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'notification-overlay';
            overlay.className = 'fixed inset-0 z-50 hidden'; 
            overlay.onclick = (e) => { if(e.target === overlay) overlay.classList.add('hidden'); };
            document.body.appendChild(overlay);
        }
        overlay.innerHTML = html;
        overlay.classList.remove('hidden');
    },

    markAllAsRead() {
        this.state.lastRead = Date.now();
        localStorage.setItem('vm_last_read', this.state.lastRead);
        document.getElementById('notification-overlay').classList.add('hidden');
        this.updateNotificationDot();
        App.showToast('Alle Benachrichtigungen als gelesen markiert');
    },

    updateNotificationDot() {
        const lastRead = this.state.lastRead;
        let hasNew = false;
        if (Store.state.news.some(n => new Date(n.date).getTime() > lastRead)) hasNew = true;
        if (!hasNew) {
            Store.state.groups.forEach(g => {
                if (g.chat && g.chat.length > 0) {
                    const lastMsg = g.chat[g.chat.length - 1];
                    if (new Date(lastMsg.time).getTime() > lastRead) hasNew = true;
                }
            });
        }
        const dot = document.querySelector('button[onclick="App.toggleNotifications()"] span');
        if (dot) dot.style.display = hasNew ? 'block' : 'none';
    },

    openModal(htmlContent) {
        const overlay = document.getElementById('modal-overlay');
        const content = document.getElementById('modal-content');
        if (overlay && content) {
            content.innerHTML = htmlContent;
            overlay.classList.remove('hidden');
            setTimeout(() => { content.classList.remove('scale-95', 'opacity-0'); content.classList.add('scale-100', 'opacity-100'); }, 10);
        }
    },

    closeModal() {
        const overlay = document.getElementById('modal-overlay');
        const content = document.getElementById('modal-content');
        if (overlay && content) {
            content.classList.remove('scale-100', 'opacity-100');
            content.classList.add('scale-95', 'opacity-0');
            setTimeout(() => { overlay.classList.add('hidden'); content.innerHTML = ''; }, 300);
        }
    },

    showToast(message) {
        const toast = document.getElementById("toast");
        if (toast) {
            toast.textContent = message;
            toast.className = "show";
            setTimeout(() => { toast.className = toast.className.replace("show", ""); }, 3000);
        }
    }
};

window.addEventListener('DOMContentLoaded', () => { App.init(); });