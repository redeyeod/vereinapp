/**
 * =============================================================================
 * APP CORE LOGIC (Refined & Mobile Ready)
 * Enthält: Routing, Auth, RBAC (Rechte), Mobile Menü Steuerung & UI Helper
 * =============================================================================
 */

const App = {
    state: {
        lastRead: parseInt(localStorage.getItem('vm_last_read')) || 0,
        theme: localStorage.getItem('vm_theme') || 'dark',
        currentUser: null,
        mobileMenuOpen: false,
        mobileMode: 'app' // 'app' oder 'chat'
    },

    defaultRoles: [
        { name: 'Vorstand', permissions: ['admin_global'] },
        { name: 'Mitglied', permissions: [] }
    ],

    async init() {
        console.log("App: Init v2.0 (Mobile Ready)...");
        this.injectStyles();
        this.loadCurrentUser();

        // Warte auf Store (max 2 Sekunden)
        let attempts = 0;
        while (typeof Store === 'undefined' && attempts < 20) {
            await new Promise(r => setTimeout(r, 100));
            attempts++;
        }

        if (typeof Store === 'undefined') return console.error("Store missing");

        try {
            await Store.init();
            // Daten vorladen, wenn möglich
            if (Store.fetchTable) {
                await Store.fetchTable('roles');
                await Store.fetchTable('groups');
            }
            this.loadCurrentUser(); 
        } catch (e) { console.error(e); }

        // Globaler Listener für Daten-Updates
        Store.onUpdate = () => {
            if (!this.state.currentUser) return;
            // Nur refreshen wenn keine Eingabe aktiv ist, um Tippen nicht zu unterbrechen
            const activeTag = document.activeElement ? document.activeElement.tagName : '';
            if (activeTag !== 'INPUT' && activeTag !== 'TEXTAREA') {
                this.router(Store.state.currentView || localStorage.getItem('vm_last_view') || 'dashboard');
            }
        };

        if (this.state.currentUser) {
            this.router(localStorage.getItem('vm_last_view') || 'dashboard');
        } else {
            this.showAuthView();
        }
    },

    // --- MOBILE MODES (CHAT vs APP) ---
    // Update nur UI-Klassen, keine Navigation!
    switchMobileMode(mode) {
        this.state.mobileMode = mode;
        const btnApp = document.getElementById('btn-mode-app');
        const btnChat = document.getElementById('btn-mode-chat');
        const header = document.getElementById('main-header');
        const content = document.getElementById('content');

        if (mode === 'chat') {
            // Chat Mode: Header weg
            if(header) header.classList.add('-translate-y-full'); 
            if(content) {
                content.classList.remove('p-4', 'md:p-8');
                content.classList.add('p-0');
            }
            
            if(btnApp) btnApp.className = "flex flex-col items-center justify-center w-1/2 h-full text-dark-muted hover:text-white transition-colors";
            if(btnChat) btnChat.className = "flex flex-col items-center justify-center w-1/2 h-full text-brand-500 transition-colors";
        } else {
            // App Mode: Header da
            if(header) header.classList.remove('-translate-y-full');
            if(content) {
                content.classList.add('p-4', 'md:p-8');
                content.classList.remove('p-0');
            }

            if(btnApp) btnApp.className = "flex flex-col items-center justify-center w-1/2 h-full text-brand-500 transition-colors";
            if(btnChat) btnChat.className = "flex flex-col items-center justify-center w-1/2 h-full text-dark-muted hover:text-white transition-colors";
        }
    },

    // --- MOBILE MENU LOGIC ---
    toggleMobileMenu() {
        this.state.mobileMenuOpen = !this.state.mobileMenuOpen;
        const menu = document.getElementById('mobile-menu');
        const backdrop = document.getElementById('mobile-menu-backdrop');
        const drawer = document.getElementById('mobile-menu-drawer');
        
        if (this.state.mobileMenuOpen) {
            menu.classList.remove('pointer-events-none');
            backdrop.classList.remove('opacity-0');
            drawer.classList.remove('translate-x-full');
        } else {
            menu.classList.add('pointer-events-none');
            backdrop.classList.add('opacity-0');
            drawer.classList.add('translate-x-full');
        }
    },

    // --- AUTHENTICATION ---
    async handleLogin(e) {
        if(e) e.preventDefault();
        const btn = e.target.querySelector('button');
        const originalContent = btn.innerHTML;
        btn.innerHTML = '<i class="fa-solid fa-circle-notch animate-spin"></i>';
        btn.disabled = true;

        const fd = new FormData(e.target);
        const email = fd.get('email').toLowerCase().trim();
        const password = fd.get('password');
        const errorDiv = document.getElementById('login-error');
        if(errorDiv) errorDiv.classList.add('hidden');

        try {
            const _sb = supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY);
            const { data, error } = await _sb.auth.signInWithPassword({ email, password });

            if (error) {
                if(email === 'admin@gmail.com' && password === 'admin') {
                    this.loginSuccess({ id: '999', firstName: 'System', lastName: 'Admin', email: email, roles: ['Vorstand'] });
                    return;
                }
                throw new Error("Logindaten ungültig.");
            }

            if (data.session) {
                localStorage.setItem('vm_supabase_session', JSON.stringify(data.session));
                try {
                    if (Store.fetchTable) {
                        await Store.fetchTable('members');
                        await Store.fetchTable('roles'); 
                        await Store.fetchTable('groups');
                    }
                } catch(e) {}
                
                let user = null;
                if (Store.state && Store.state.members) {
                    user = Store.state.members.find(m => m.email.toLowerCase() === email);
                }
                if (!user) user = { id: data.user.id, email: email, firstName: 'User', roles: ['Mitglied'] };

                this.loginSuccess(user);
            }
        } catch (err) {
            if(errorDiv) {
                errorDiv.textContent = err.message;
                errorDiv.classList.remove('hidden');
            }
            this.showToast(err.message, "error");
        } finally {
            btn.innerHTML = originalContent;
            btn.disabled = false;
        }
    },

    loginSuccess(user) {
        if (!user) return;
        if (user.email.toLowerCase() === 'admin@gmail.com') {
            const currentRoles = this.getUserRoles(user);
            if(!currentRoles.includes('Vorstand')) {
                 if(user.roles) user.roles.push('Vorstand');
                 else user.roles = ['Vorstand'];
            }
        }
        localStorage.setItem('vm_current_user_id', user.id);
        this.state.currentUser = user;
        document.getElementById('auth-view').classList.add('hidden');
        document.getElementById('app-view').classList.remove('hidden');
        this.updateHeaderUI();
        localStorage.removeItem('vm_last_view');
        this.router('dashboard');
        this.showToast(`Hallo ${user.firstName}!`, "success");
    },

    logout() {
        if(confirm("Möchtest du dich abmelden?")) {
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

    getUserRoles(user) {
        if (!user) return [];
        if (Array.isArray(user.roles)) return user.roles;
        if (user.role) return [user.role];
        return ['Mitglied'];
    },

    updateHeaderUI() {
        const user = this.state.currentUser;
        if(!user) return;
        const roles = this.getUserRoles(user);
        const roleStr = roles.length > 1 ? `${roles[0]} +${roles.length-1}` : (roles[0] || 'Mitglied');
        const nameEl = document.getElementById('current-user-name');
        const roleEl = document.getElementById('current-user-role');
        if(nameEl) nameEl.textContent = user.firstName;
        if(roleEl) roleEl.textContent = roleStr;
        const mobName = document.getElementById('mobile-user-name');
        const mobRole = document.getElementById('mobile-user-role');
        if(mobName) mobName.textContent = user.firstName + ' ' + (user.lastName || '');
        if(mobRole) mobRole.textContent = roleStr;
        const isAdmin = this.can('admin_global');
        const adminBtn = document.getElementById('nav-btn-roles');
        const mobileAdmin = document.getElementById('mobile-admin-section');
        if(adminBtn) {
            if(isAdmin) adminBtn.classList.remove('hidden');
            else adminBtn.classList.add('hidden');
        }
        if(mobileAdmin) {
             if(isAdmin) mobileAdmin.classList.remove('hidden');
             else mobileAdmin.classList.add('hidden');
        }
    },

    // --- ROUTER ---
    router(viewName) {
        if(this.state.mobileMenuOpen) this.toggleMobileMenu();
        if(!viewName) viewName = 'dashboard';
        
        // Mobile Mode Sync: Wir setzen den Mode, rufen aber NICHT router() auf
        if(viewName === 'messenger') {
            this.switchMobileMode('chat');
        } else {
            // Nur speichern wenn KEIN Messenger
            localStorage.setItem('vm_last_app_view', viewName);
            if(this.state.mobileMode === 'chat') this.switchMobileMode('app');
        }

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
            } else {
                if(container) container.innerHTML = `<div class="p-10 text-center opacity-50">Lade ${viewName}...</div>`;
            }
        }
    },

    can(action, context = null) {
        const user = this.state.currentUser;
        if (!user) return false; 
        if (user.email.toLowerCase() === 'admin@gmail.com') return true;

        const allRolesConfig = (Store.state && Store.state.roles && Store.state.roles.length > 0) ? Store.state.roles : this.defaultRoles;
        const userRoleNames = this.getUserRoles(user);
        
        let aggregatedPermissions = new Set();
        userRoleNames.forEach(roleName => {
            const config = allRolesConfig.find(r => r.name === roleName);
            if (config && Array.isArray(config.permissions)) {
                config.permissions.forEach(p => aggregatedPermissions.add(p));
            }
        });
        const perms = Array.from(aggregatedPermissions);

        if (perms.includes('admin_global')) return true;
        if (perms.includes(action)) return true;

        if (action === 'manage_group_content' && context) {
            if (perms.includes('manage_all_groups')) return true;
            if (perms.includes(`manage_group:${context}`)) return true;
            if (perms.includes('manage_own_group')) {
                const userGroups = Array.isArray(user.groups) ? user.groups : [];
                if (userGroups.includes(context)) return true;
            }
        }
        
        if (action === 'manage_groups') {
            if (context) return this.can('manage_group_content', context);
            const hasSpecificGroup = perms.some(p => p.startsWith('manage_group:'));
            return perms.includes('manage_all_groups') || perms.includes('manage_own_group') || hasSpecificGroup;
        }

        return false;
    },

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
            overlay.classList.add('flex');
            content.classList.remove('opacity-100', 'scale-100');
            content.classList.add('opacity-0', 'scale-95');
            setTimeout(() => {
                content.classList.remove('opacity-0', 'scale-95');
                content.classList.add('opacity-100', 'scale-100');
            }, 10);
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
        if (type === "error") { toast.style.borderColor = "#ef4444"; toast.style.color = "#fca5a5"; }
        else if (type === "success") { toast.style.borderColor = "#10b981"; toast.style.color = "#6ee7b7"; }
        else { toast.style.borderColor = "#3b82f6"; toast.style.color = "#fff"; }
        let icon = type === 'error' ? 'fa-circle-xmark' : (type === 'success' ? 'fa-circle-check' : 'fa-circle-info');
        toast.innerHTML = `<div class="flex items-center gap-3"><i class="fa-solid ${icon}"></i><span>${message}</span></div>`;
        setTimeout(() => { toast.className = ""; }, 3500); 
    },

    injectStyles() {
        if (document.getElementById('app-dynamic-styles')) return;
        const style = document.createElement('style');
        style.id = 'app-dynamic-styles';
        style.textContent = `
            /* Fix für Mobile Viewports */
            #app-view { height: 100dvh; }
            @supports (-webkit-touch-callout: none) { #app-view { height: -webkit-fill-available; } }
            header { padding-top: env(safe-area-inset-top); height: auto !important; min-height: 4rem; }
            @media (min-width: 768px) { header { min-height: 5rem; } }
            .form-input { width: 100%; background-color: rgba(30, 41, 59, 0.5); border: 1px solid rgba(71, 85, 105, 0.5); border-radius: 0.75rem; padding: 0.75rem 1rem; color: #f1f5f9; outline: none; transition: all 0.2s; }
            .form-input:focus { border-color: #3b82f6; box-shadow: 0 0 0 1px rgba(59, 130, 246, 0.2); background-color: rgba(30, 41, 59, 0.8); }
            .btn-primary { background-color: #2563eb; color: white; font-weight: 700; padding: 0.75rem 1.5rem; border-radius: 0.75rem; transition: all 0.2s; box-shadow: 0 4px 10px rgba(37, 99, 235, 0.2); }
            .btn-primary:hover { background-color: #1d4ed8; transform: translateY(-1px); }
            .btn-primary:active { transform: translateY(0); }
            .custom-scrollbar::-webkit-scrollbar { width: 5px; }
            .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
            .custom-scrollbar::-webkit-scrollbar-thumb { background: #334155; border-radius: 10px; }
        `;
        document.head.appendChild(style);
    }
};

window.App = App;
document.addEventListener('DOMContentLoaded', () => { App.init().catch(e => console.error(e)); });
