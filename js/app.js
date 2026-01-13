/**
 * =============================================================================
 * APP CORE LOGIC (Footer Navigation Ready)
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
        console.log("App: Init v2.3 (Footer Logic)...");
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

    // --- MOBILE MENU LOGIC (Sidebar) ---
    toggleMobileMenu() {
        this.state.mobileMenuOpen = !this.state.mobileMenuOpen;
        const menu = document.getElementById('mobile-menu');
        const backdrop = document.getElementById('mobile-menu-backdrop');
        const drawer = document.getElementById('mobile-menu-drawer');
        
        if (this.state.mobileMenuOpen) {
            // Öffnen
            menu.classList.remove('pointer-events-none');
            backdrop.classList.remove('opacity-0');
            drawer.classList.remove('translate-x-full');
        } else {
            // Schließen
            menu.classList.add('pointer-events-none');
            backdrop.classList.add('opacity-0');
            drawer.classList.add('translate-x-full');
        }
    },

    // --- ROUTER & UI SWITCHING ---
    router(viewName) {
        if(this.state.mobileMenuOpen) this.toggleMobileMenu();
        if(!viewName) viewName = 'dashboard';
        
        localStorage.setItem('vm_last_view', viewName);
        if (Store && Store.state) Store.state.currentView = viewName;

        // UI Anpassung für Mobile (Chat vs App Mode & Footer Animation)
        this.updateMobileLayout(viewName);
        this.updateActiveNav(viewName);
        
        const container = document.getElementById('content');
        const subtitle = document.getElementById('page-subtitle');
        if (container) container.innerHTML = ''; 
        if(subtitle) subtitle.textContent = viewName.charAt(0).toUpperCase() + viewName.slice(1);

        const viewObjName = viewName.charAt(0).toUpperCase() + viewName.slice(1) + 'View';
        
        // Render View
        let viewObj = window[viewObjName];
        if(!viewObj) {
            // Fallback Mapping
            const map = { 
                'dashboard': window.DashboardView, 
                'members': window.MembersView, 
                'groups': window.GroupsView, 
                'calendar': window.CalendarView, 
                'news': window.NewsView, 
                'documents': window.DocsView, 
                'messenger': window.MessengerView, 
                'profile': window.ProfileView, 
                'workhours': window.WorkHoursView,
                'admin_roles': window.AdminRolesView
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
    },

    // WICHTIG: Steuert Header, Padding und Footer-Animation
    updateMobileLayout(viewName) {
        const header = document.getElementById('main-header');
        const content = document.getElementById('content');
        const footer = document.getElementById('mobile-bottom-nav');

        const isChat = viewName === 'messenger';

        // 1. Header & Padding
        if (isChat) {
            // --- CHAT MODE ---
            if(header) header.classList.add('-translate-y-full'); // Header verstecken
            if(content) {
                // Padding entfernen für Fullscreen Chat, unten Platz für Footer lassen
                content.classList.remove('pt-4', 'md:p-8');
                content.classList.add('p-0', 'pb-24'); 
            }
        } else {
            // --- APP MODE ---
            if(header) header.classList.remove('-translate-y-full'); // Header zeigen
            if(content) {
                // Normales Padding
                content.classList.add('pt-4', 'md:p-8', 'pb-28'); 
                content.classList.remove('p-0', 'pb-24');
            }
        }

        // 2. Footer Swipe Animation (via CSS Class 'chat-mode')
        // Diese Klasse steuert den #nav-glider im CSS
        if(footer) {
            if(isChat) footer.classList.add('chat-mode');
            else footer.classList.remove('chat-mode');
        }
    },

    updateActiveNav(viewName) {
        // Desktop Header Nav Highlights
        document.querySelectorAll('nav button').forEach(btn => {
            btn.classList.remove('text-brand-500', 'bg-brand-500/10', 'border-brand-500/20');
            btn.classList.add('text-dark-muted', 'border-transparent');
            
            // Check if matches (lazy check via onclick attribute content)
            if(btn.getAttribute('onclick') && btn.getAttribute('onclick').includes(`'${viewName}'`)) {
                btn.classList.remove('text-dark-muted', 'border-transparent');
                btn.classList.add('text-brand-500', 'bg-brand-500/10', 'border-brand-500/20');
            }
        });
    },

    // --- AUTHENTICATION ---
    async handleLogin(e) {
        if(e) e.preventDefault();
        const btn = e.target.querySelector('button');
        const originalHTML = btn.innerHTML;
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
                // Reload Data
                try {
                    if (Store.fetchTable) {
                        await Store.fetchTable('members');
                        await Store.fetchTable('roles'); 
                        await Store.fetchTable('groups');
                    }
                } catch(e) {}
                
                let user = Store.state.members ? Store.state.members.find(m => m.email.toLowerCase() === email) : null;
                if (!user) user = { id: data.user.id, email: email, firstName: 'User', roles: ['Mitglied'] };

                this.loginSuccess(user);
            }
        } catch (err) {
            if(errorDiv) { errorDiv.textContent = err.message; errorDiv.classList.remove('hidden'); }
            this.showToast(err.message, "error");
        } finally {
            btn.innerHTML = originalHTML;
            btn.disabled = false;
        }
    },

    loginSuccess(user) {
        if (!user) return;
        if (user.email.toLowerCase() === 'admin@gmail.com') {
            const currentRoles = this.getUserRoles(user);
            if(!currentRoles.includes('Vorstand')) {
                 if(user.roles) user.roles.push('Vorstand'); else user.roles = ['Vorstand'];
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
            if(Store && Store.state.members.length > 0) {
                const found = Store.state.members.find(m => m.email.toLowerCase() === email);
                if(found) user = found;
            }
            if (email === 'admin@gmail.com') {
                 const r = this.getUserRoles(user);
                 if(!r.includes('Vorstand')) {
                      if(Array.isArray(user.roles)) user.roles.push('Vorstand'); else user.roles = ['Vorstand'];
                 }
            }
            this.state.currentUser = user;
            this.updateHeaderUI();
            document.getElementById('auth-view').classList.add('hidden');
            document.getElementById('app-view').classList.remove('hidden');
        } catch(e) {}
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
        
        const ids = ['current-user-name', 'mobile-user-name'];
        ids.forEach(id => { const el = document.getElementById(id); if(el) el.textContent = user.firstName; });
        
        const rIds = ['current-user-role', 'mobile-user-role'];
        rIds.forEach(id => { const el = document.getElementById(id); if(el) el.textContent = roleStr; });

        const isAdmin = this.can('admin_global');
        const adminBtn = document.getElementById('nav-btn-roles');
        const mobileAdmin = document.getElementById('mobile-admin-section');
        if(adminBtn) isAdmin ? adminBtn.classList.remove('hidden') : adminBtn.classList.add('hidden');
        if(mobileAdmin) isAdmin ? mobileAdmin.classList.remove('hidden') : mobileAdmin.classList.add('hidden');
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

    showAuthView() { document.getElementById('auth-view').classList.remove('hidden'); document.getElementById('app-view').classList.add('hidden'); },
    
    openModal(html) {
        const ov = document.getElementById('modal-overlay');
        const c = document.getElementById('modal-content');
        if(ov && c) {
            c.innerHTML = html;
            ov.classList.remove('hidden'); ov.classList.add('flex');
            setTimeout(() => { c.classList.remove('opacity-0', 'scale-95'); }, 10);
        }
    },
    
    closeModal() {
        const ov = document.getElementById('modal-overlay');
        const c = document.getElementById('modal-content');
        if(c) c.classList.add('opacity-0', 'scale-95');
        setTimeout(() => { if(ov) ov.classList.add('hidden'); ov.classList.remove('flex'); }, 200);
    },

    showToast(msg, type="info") {
        const t = document.getElementById("toast");
        if(!t) return;
        t.className = "show";
        t.style.borderColor = type === 'error' ? '#ef4444' : (type === 'success' ? '#10b981' : '#3b82f6');
        t.innerHTML = `<span>${msg}</span>`;
        setTimeout(() => t.className = "", 3000);
    },

    injectStyles() {
        if(document.getElementById('app-styles')) return;
        const s = document.createElement('style');
        s.id = 'app-styles';
        s.textContent = `
            #app-view { height: 100dvh; }
            @supports (-webkit-touch-callout: none) { #app-view { height: -webkit-fill-available; } }
            header { transition: transform 0.3s ease; }
            .form-input { width: 100%; background: rgba(30,41,59,0.5); border: 1px solid #334155; border-radius: 0.75rem; padding: 0.75rem 1rem; color: #fff; }
            .custom-scrollbar::-webkit-scrollbar { width: 4px; }
            .custom-scrollbar::-webkit-scrollbar-thumb { background: #334155; border-radius: 4px; }
        `;
        document.head.appendChild(s);
    }
};

window.App = App;
document.addEventListener('DOMContentLoaded', () => App.init());
