/**
 * =============================================================================
 * APP CORE LOGIC (RBAC Integration & Admin UI)
 * UPDATED: Support für Multi-Role System (1 User = N Rollen)
 * =============================================================================
 */

const App = {
    state: {
        lastRead: parseInt(localStorage.getItem('vm_last_read')) || 0,
        theme: localStorage.getItem('vm_theme') || 'dark',
        currentUser: null 
    },

    // Standard-Rollen Fallback
    defaultRoles: [
        { name: 'Vorstand', permissions: ['admin_global'] },
        { name: 'Mitglied', permissions: [] }
    ],

    async init() {
        console.log("App: Init RBAC System (Multi-Role Support)...");
        this.injectStyles();
        
        this.loadCurrentUser();
        this.initTheme();

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
            
            if (Store.fetchTable) {
                await Store.fetchTable('roles');
                await Store.fetchTable('groups');
            }
            
            this.loadCurrentUser(); 
        } catch (e) { console.error(e); }

        Store.onUpdate = () => {
            if (!this.state.currentUser) return;
            this.updateNotificationDot();
            const activeTag = document.activeElement ? document.activeElement.tagName : '';
            if (activeTag !== 'INPUT' && activeTag !== 'TEXTAREA') {
                this.router(Store.state.currentView || localStorage.getItem('vm_last_view') || 'dashboard');
            }
        };

        if (this.state.currentUser) {
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
                // Notfall-Admin
                if(email === 'admin@gmail.com' && password === 'admin') {
                    // Fix: role als Array übergeben
                    this.loginSuccess({ id: '999', firstName: 'System', lastName: 'Admin', email: email, roles: ['Vorstand'] });
                    return;
                }
                throw new Error("Login fehlgeschlagen.");
            }

            if (data.session) {
                localStorage.setItem('vm_supabase_session', JSON.stringify(data.session));
            } else {
                throw new Error("Keine Session empfangen.");
            }
            
            try {
                if (Store.fetchTable) {
                    await Store.fetchTable('members');
                    await Store.fetchTable('roles'); 
                    await Store.fetchTable('groups');
                }
            } catch(e) { console.warn("Daten-Load Fehler beim Login", e); }
            
            let user = null;
            if (Store.state && Store.state.members) {
                user = Store.state.members.find(m => m.email.toLowerCase() === email);
            }
            // Fallback User
            if (!user) user = { id: data.user.id, email: email, firstName: 'User', roles: ['Mitglied'] };

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
        
        // Admin Force (Rolle hinzufügen falls fehlt)
        if (user.email.toLowerCase() === 'admin@gmail.com') {
            const currentRoles = this.getUserRoles(user);
            if(!currentRoles.includes('Vorstand')) {
                 // Wir manipulieren das lokale Objekt, speichern es aber nicht zwingend in DB
                 if(user.roles) user.roles.push('Vorstand');
                 else user.role = 'Vorstand'; // Fallback
            }
        }
        
        localStorage.setItem('vm_current_user_id', user.id);
        this.state.currentUser = user;
        
        document.getElementById('auth-view').classList.add('hidden');
        document.getElementById('app-view').classList.remove('hidden');
        this.updateHeaderUI();
        
        localStorage.removeItem('vm_last_view');
        this.router('dashboard');
        this.showToast(`Willkommen, ${user.firstName}!`, "success");
    },

    logout() {
        if(confirm("Abmelden?")) {
            localStorage.removeItem('vm_supabase_session');
            localStorage.removeItem('vm_current_user_id');
            localStorage.removeItem('vm_last_view'); 
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
            
            let user = { id: session.user.id, email: email, firstName: 'User', roles: ['Mitglied'] };
            
            if(Store && Store.state && Store.state.members && Store.state.members.length > 0) {
                const found = Store.state.members.find(m => m.email.toLowerCase() === email);
                if(found) user = found;
            }
            
            if (email === 'admin@gmail.com') {
                 // Sicherstellen dass Admin Rechte da sind
                 const r = this.getUserRoles(user);
                 if(!r.includes('Vorstand')) {
                     if(Array.isArray(user.roles)) user.roles.push('Vorstand');
                     else user.roles = ['Vorstand'];
                 }
            }

            this.state.currentUser = user;
            this.updateHeaderUI();
            
            document.getElementById('auth-view').classList.add('hidden');
            document.getElementById('app-view').classList.remove('hidden');
        } catch(e) { console.error("Session Parse Error:", e); }
    },

    // Helper um sicherzustellen, dass wir immer ein Array von Rollen haben
    // Egal ob in DB 'role' (string) oder 'roles' (array) steht
    getUserRoles(user) {
        if (!user) return [];
        if (Array.isArray(user.roles)) return user.roles;
        if (user.role) return [user.role]; // Legacy Support
        return ['Mitglied']; // Default
    },

    updateHeaderUI() {
        const user = this.state.currentUser;
        if(!user) return;
        const nameEl = document.getElementById('current-user-name');
        const roleEl = document.getElementById('current-user-role');
        
        if(nameEl) nameEl.textContent = user.firstName;
        
        // Zeige Hauptrolle oder Anzahl an
        if(roleEl) {
            const roles = this.getUserRoles(user);
            if(roles.length > 1) roleEl.textContent = `${roles[0]} +${roles.length - 1}`;
            else roleEl.textContent = roles[0] || 'Mitglied';
        }

        const adminBtn = document.getElementById('nav-btn-roles');
        if(adminBtn) {
            if(this.can('admin_global')) {
                adminBtn.classList.remove('hidden');
            } else {
                adminBtn.classList.add('hidden');
            }
        }
    },

    // --- ROUTER ---
    router(viewName) {
        if(!viewName) viewName = 'dashboard';
        localStorage.setItem('vm_last_view', viewName);
        if (Store && Store.state) Store.state.currentView = viewName;
        
        const container = document.getElementById('content');
        const subtitle = document.getElementById('page-subtitle');
        if (container) container.innerHTML = ''; 
        if(subtitle) subtitle.textContent = viewName.charAt(0).toUpperCase() + viewName.slice(1);

        const viewObjName = viewName.charAt(0).toUpperCase() + viewName.slice(1) + 'View';
        
        if (viewName === 'admin_roles') {
             if (window.AdminRolesView) window.AdminRolesView.render(container);
             else container.innerHTML = '<div class="p-10 text-center text-red-400">AdminRolesView script nicht geladen.</div>';
        } else {
            let viewObj = window[viewObjName];
            if(!viewObj) {
                const map = { 
                    'dashboard': window.DashboardView, 
                    'members': window.MembersView, 
                    'groups': window.GroupsView, 
                    'calendar': window.CalendarView, 
                    'news': window.NewsView, 
                    'documents': window.DocsView, 
                    'messenger': window.MessengerView, 
                    'profile': window.ProfileView, 
                    'workhours': window.WorkHoursView
                };
                viewObj = map[viewName];
            }

            if (viewObj && typeof viewObj.render === 'function') {
                container.classList.remove('fade-in');
                void container.offsetWidth; 
                viewObj.render(container);
                container.classList.add('fade-in');
                
                const mobileMenu = document.getElementById('mobile-menu');
                if(mobileMenu && !mobileMenu.classList.contains('hidden')) mobileMenu.classList.add('hidden');
            } else {
                if(container) container.innerHTML = `<div class="p-10 text-center opacity-50">Lade ${viewName}...</div>`;
            }
        }
    },

    // --- PERMISSIONS SYSTEM (UPDATED FOR MULTI-ROLE) ---
    can(action, context = null) {
        const user = this.state.currentUser;
        if (!user) return false; 
        
        // 1. Hardcoded Super-Admin
        if (user.email.toLowerCase() === 'admin@gmail.com') return true;

        // 2. Rollen Konfigurationen holen
        const allRolesConfig = (Store.state && Store.state.roles && Store.state.roles.length > 0) ? Store.state.roles : this.defaultRoles;
        
        // 3. Alle Rollen des Users holen (Array)
        const userRoleNames = this.getUserRoles(user);

        // 4. Wir sammeln ALLE Berechtigungen aus ALLEN Rollen des Users
        let aggregatedPermissions = new Set();

        userRoleNames.forEach(roleName => {
            const config = allRolesConfig.find(r => r.name === roleName);
            if (config && Array.isArray(config.permissions)) {
                config.permissions.forEach(p => aggregatedPermissions.add(p));
            }
        });

        // Konvertieren zu Array für einfachere Checks
        const perms = Array.from(aggregatedPermissions);

        // --- CHECK LOGIK (unverändert, aber gegen gesammelte perms) ---

        // A. Global Admin
        if (perms.includes('admin_global')) return true;

        // B. Exakte Berechtigung
        if (perms.includes(action)) return true;

        // C. Scoped Permissions (Gruppen)
        if (action === 'manage_group_content' && context) {
            if (perms.includes('manage_all_groups')) return true;
            // Checkt auf "manage_group:GruppenName"
            if (perms.includes(`manage_group:${context}`)) return true;
            
            // Legacy Support
            if (perms.includes('manage_own_group')) {
                const userGroups = Array.isArray(user.groups) ? user.groups : [];
                if (userGroups.includes(context)) return true;
            }
        }
        
        // D. Gruppen-Management Generell
        if (action === 'manage_groups') {
            if (context) return this.can('manage_group_content', context);
            const hasSpecificGroup = perms.some(p => p.startsWith('manage_group:'));
            return perms.includes('manage_all_groups') || perms.includes('manage_own_group') || hasSpecificGroup;
        }

        return false;
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
            overlay.classList.add('flex');
            void content.offsetWidth;
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

    injectStyles() {
        if (document.getElementById('app-dynamic-styles')) return;
        const style = document.createElement('style');
        style.id = 'app-dynamic-styles';
        style.textContent = `
            ::-webkit-scrollbar { width: 6px; height: 6px; }
            ::-webkit-scrollbar-track { background: transparent; }
            ::-webkit-scrollbar-thumb { background: rgba(148, 163, 184, 0.2); border-radius: 10px; }
            ::-webkit-scrollbar-thumb:hover { background: rgba(148, 163, 184, 0.4); }
            .fade-in { animation: fadeIn 0.4s ease-out forwards; }
            @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
            .form-input { 
                width: 100%;
                background-color: rgba(30, 41, 59, 0.5); border: 1px solid rgba(71, 85, 105, 0.5);
                border-radius: 0.75rem; padding: 0.75rem 1rem; color: #f1f5f9; outline: none; transition: all 0.2s;
            }
            .form-input:focus { border-color: #3b82f6; box-shadow: 0 0 0 1px rgba(59, 130, 246, 0.2); background-color: rgba(30, 41, 59, 0.8); }
            .btn-primary {
                background-color: #2563eb; color: white; font-weight: 700; padding: 0.75rem 1.5rem;
                border-radius: 0.75rem; transition: all 0.2s; box-shadow: 0 10px 15px -3px rgba(37, 99, 235, 0.2);
            }
            .btn-primary:hover { background-color: #1d4ed8; transform: translateY(-1px); }
            .btn-primary:active { transform: translateY(0); }
        `;
        document.head.appendChild(style);
    }
};

window.App = App;
document.addEventListener('DOMContentLoaded', () => { App.init().catch(e => console.error(e)); });
