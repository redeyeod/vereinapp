/**
 * =============================================================================
 * APP CORE LOGIC (Visual Fix & Admin Force & View Restore)
 * Repariert das Design der Eingabefelder, erzwingt Admin-Rechte
 * und stellt die letzte Ansicht nach Reload wieder her.
 * =============================================================================
 */

const App = {
    state: {
        lastRead: parseInt(localStorage.getItem('vm_last_read')) || 0,
        theme: localStorage.getItem('vm_theme') || 'dark',
        currentUser: null 
    },

    async init() {
        console.log("App: Init...");

        // 1. CSS laden (WICHTIG: Das muss passieren, bevor Views gerendert werden)
        this.injectStyles();

        // 2. Warte auf Store
        let attempts = 0;
        while (typeof Store === 'undefined' && attempts < 20) {
            await new Promise(r => setTimeout(r, 100));
            attempts++;
        }

        if (typeof Store === 'undefined') {
            console.error("Store nicht gefunden!");
            return;
        }

        try {
            await Store.init();
        } catch (e) { console.error(e); }

        Store.onUpdate = () => {
            if (!this.state.currentUser) return;
            this.updateNotificationDot();
            const activeTag = document.activeElement ? document.activeElement.tagName : '';
            // Nur neu rendern, wenn wir nicht gerade tippen
            if (activeTag !== 'INPUT' && activeTag !== 'TEXTAREA') {
                // Hier nutzen wir den aktuellen State
                this.router(Store.state.currentView || 'dashboard');
            }
        };

        this.loadCurrentUser();
        this.initTheme();
        
        if (this.state.currentUser) {
            // FIX: Letzte Ansicht wiederherstellen
            const lastView = localStorage.getItem('vm_last_view') || 'dashboard';
            this.router(lastView);
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

        const fd = new FormData(e.target);
        const email = fd.get('email').toLowerCase().trim();
        const password = fd.get('password');

        try {
            const _sb = supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY);
            const { data, error } = await _sb.auth.signInWithPassword({ email, password });

            if (error) {
                if(email === 'admin@gmail.com' && password === 'admin') {
                    this.loginSuccess({ id: '999', firstName: 'System', lastName: 'Admin', email: email, role: 'Admin' });
                    return;
                }
                throw new Error("Login fehlgeschlagen.");
            }

            localStorage.setItem('vm_supabase_session', JSON.stringify(data.session));
            if (Store.fetchTable) await Store.fetchTable('members');
            
            let user = Store.state.members.find(m => m.email.toLowerCase() === email);
            if (!user) user = { id: data.user.id, email: email, firstName: 'User', role: 'Mitglied' };

            this.loginSuccess(user);

        } catch (err) {
            this.showToast(err.message, "error");
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
        
        // FIX: Auch nach Login zur zuletzt besuchten Seite oder Dashboard
        const lastView = localStorage.getItem('vm_last_view') || 'dashboard';
        this.router(lastView);
        
        this.showToast(`Willkommen, ${user.firstName}!`, "success");
    },

    logout() {
        if(confirm("Abmelden?")) {
            localStorage.clear();
            location.reload();
        }
    },

    loadCurrentUser() {
        const sessionStr = localStorage.getItem('vm_supabase_session');
        if(!sessionStr) return;

        try {
            const session = JSON.parse(sessionStr);
            if (!session || !session.user) return;

            const email = session.user.email.toLowerCase();
            // Versuche User aus Store zu laden (falls schon geladen), sonst Fallback
            let user = null;
            if(Store.state && Store.state.members) {
                user = Store.state.members.find(m => m.email.toLowerCase() === email);
            }
            
            if(!user) user = { id: session.user.id, email: email, firstName: 'User', role: 'Mitglied' };
            if (email === 'admin@gmail.com') user.role = 'Admin';
            
            this.state.currentUser = user;
            this.updateHeaderUI();
        } catch(e) { 
            console.error(e); 
            // Nur löschen wenn wirklich defekt
            // localStorage.removeItem('vm_supabase_session');
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
        // FIX: Fallback auf gespeicherte View, falls Parameter leer
        if(!viewName) viewName = localStorage.getItem('vm_last_view') || 'dashboard';
        
        // FIX: Speichern der neuen View
        localStorage.setItem('vm_last_view', viewName);
        Store.state.currentView = viewName;
        
        const container = document.getElementById('content');
        const subtitle = document.getElementById('page-subtitle');
        if (container) container.innerHTML = ''; 
        if(subtitle) subtitle.textContent = viewName.charAt(0).toUpperCase() + viewName.slice(1);

        const viewObjName = viewName.charAt(0).toUpperCase() + viewName.slice(1) + 'View';
        let viewObj = window[viewObjName];

        // Fallback Map
        if(!viewObj) {
            const map = { 'dashboard': window.DashboardView, 'members': window.MembersView, 'groups': window.GroupsView, 'calendar': window.CalendarView, 'news': window.NewsView, 'documents': window.DocsView, 'messenger': window.MessengerView, 'profile': window.ProfileView, 'workhours': window.WorkHoursView };
            viewObj = map[viewName];
        }

        if (viewObj && typeof viewObj.render === 'function') {
            container.classList.remove('fade-in');
            void container.offsetWidth; // Trigger Reflow
            viewObj.render(container);
            container.classList.add('fade-in');
            
            // Mobile Menu schließen falls offen (optional)
            const mobileMenu = document.getElementById('mobile-menu');
            if(mobileMenu && !mobileMenu.classList.contains('hidden')) mobileMenu.classList.add('hidden');
            
        } else {
            if(container) container.innerHTML = `<div class="p-10 text-center opacity-50">Lade ${viewName}...</div>`;
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

    openModal(htmlContent) { 
        const overlay = document.getElementById('modal-overlay');
        const content = document.getElementById('modal-content');
        
        if (overlay && content) {
            content.classList.remove('opacity-100', 'scale-100');
            content.classList.add('opacity-0', 'scale-95');
            
            content.innerHTML = htmlContent;
            overlay.classList.remove('hidden');
            overlay.classList.add('flex'); // Zentrierung
            
            void content.offsetWidth; // Reflow erzwingen
            
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

        toast.className = "show";
        if (type === "error") toast.style.borderLeft = "4px solid #ef4444";
        else if (type === "success") toast.style.borderLeft = "4px solid #10b981";
        else toast.style.borderLeft = "4px solid #3b82f6";

        toast.innerHTML = `<div class="flex items-center gap-3"><i class="fa-solid ${type === 'error' ? 'fa-circle-xmark text-red-400' : (type === 'success' ? 'fa-circle-check text-green-400' : 'fa-circle-info text-blue-400')}"></i><span>${message}</span></div>`;
        
        setTimeout(() => { toast.className = ""; }, 3500); 
    },

    updateNotificationDot() {
        const dot = document.getElementById('notif-dot');
        if(dot) dot.classList.add('hidden');
    },

    initTheme() { document.documentElement.classList.add('dark'); },

    // FIX: Echtes CSS statt @apply (das im Browser nicht funktioniert)
    injectStyles() {
        if (document.getElementById('app-dynamic-styles')) return;
        const style = document.createElement('style');
        style.id = 'app-dynamic-styles';
        style.textContent = `
            /* Custom Scrollbar */
            ::-webkit-scrollbar { width: 6px; height: 6px; }
            ::-webkit-scrollbar-track { background: transparent; }
            ::-webkit-scrollbar-thumb { background: rgba(148, 163, 184, 0.2); border-radius: 10px; }
            ::-webkit-scrollbar-thumb:hover { background: rgba(148, 163, 184, 0.4); }
            
            /* Animationen */
            .fade-in { animation: fadeIn 0.4s ease-out forwards; }
            @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }

            /* Modern Inputs (Glassmorphism) */
            .form-input { 
                width: 100%;
                background-color: rgba(30, 41, 59, 0.5); /* bg-slate-800/50 */
                border: 1px solid rgba(71, 85, 105, 0.5); /* border-slate-600/50 */
                border-radius: 0.75rem; /* rounded-xl */
                padding: 0.75rem 1rem;
                color: #f1f5f9;
                outline: none;
                transition: all 0.2s;
            }
            .form-input:focus {
                border-color: #3b82f6;
                box-shadow: 0 0 0 1px rgba(59, 130, 246, 0.2);
                background-color: rgba(30, 41, 59, 0.8);
            }

            /* Buttons */
            .btn-primary {
                background-color: #2563eb;
                color: white;
                font-weight: 700;
                padding: 0.75rem 1.5rem;
                border-radius: 0.75rem;
                transition: all 0.2s;
                box-shadow: 0 10px 15px -3px rgba(37, 99, 235, 0.2);
            }
            .btn-primary:hover { background-color: #1d4ed8; transform: translateY(-1px); }
            .btn-primary:active { transform: translateY(0); }
        `;
        document.head.appendChild(style);
    }
};

window.App = App;
document.addEventListener('DOMContentLoaded', () => { App.init().catch(e => console.error(e)); });
