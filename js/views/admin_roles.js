/**
 * =============================================================================
 * ADMIN ROLES VIEW (Clean & Mobile First)
 * Verwaltung von Rollen und deren Berechtigungen (RBAC)
 * =============================================================================
 */

const AdminRolesView = {
    // Globale System-Rechte - HIER FEHLTE 'manage_roles'
    systemPermissions: [
        { key: 'admin_global', label: '👑 Super-Admin (Alles erlaubt)' },
        { key: 'manage_roles', label: '🛡️ Rollen & Rechte verwalten' }, // NEU: Damit man auch ohne Super-Admin Rechte vergeben kann
        { key: 'manage_members', label: '👥 Mitglieder verwalten' },
        { key: 'manage_workhours', label: '⏱️ Arbeitsstunden verwalten' },
        { key: 'manage_all_groups', label: '🌐 Alle Gruppen bearbeiten' },
        { key: 'manage_events', label: '📅 Termine verwalten' },
        { key: 'manage_news', label: '📰 News & Events erstellen' },
        { key: 'manage_docs', label: '📁 Dokumente hochladen' },
    ],

    render(container) {
        // RECHTE-CHECK: Rein basierend auf Permissions, keine Namen mehr hardcodiert
        const canManage = App.can('manage_roles') || App.can('admin_global');

        if (!canManage) {
            container.innerHTML = `
                <div class="flex flex-col items-center justify-center py-20 text-center">
                    <div class="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mb-4 text-red-500 border border-red-500/20">
                        <i class="fa-solid fa-lock text-3xl"></i>
                    </div>
                    <h3 class="text-white font-bold">Zugriff verweigert</h3>
                    <p class="text-dark-muted text-sm mt-1">Du hast keine Berechtigung für diesen Bereich.</p>
                </div>`;
            return;
        }

        const roles = Store.state.roles || [];

        container.innerHTML = `
            <div class="fade-in space-y-6 pb-20">
                <!-- Header -->
                <div class="flex justify-between items-end px-1">
                    <div>
                        <h2 class="text-2xl md:text-3xl font-bold text-white">Rollen & Rechte</h2>
                        <p class="text-dark-muted text-sm mt-1">Definiere, wer was darf.</p>
                    </div>
                    <button onclick="AdminRolesView.openAddRoleModal()" class="pl-3 pr-4 py-2 bg-brand-600 hover:bg-brand-500 text-white rounded-xl text-sm font-bold shadow-lg shadow-brand-500/20 transition-all flex items-center gap-2">
                        <i class="fa-solid fa-plus"></i> <span class="hidden sm:inline">Neue Rolle</span><span class="sm:hidden">Neu</span>
                    </button>
                </div>

                <!-- Roles Grid -->
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    ${roles.map(role => this.renderRoleCard(role)).join('')}
                </div>
                
                ${roles.length === 0 ? `
                <div class="text-center py-12 text-dark-muted border border-dashed border-dark-border rounded-2xl bg-dark-bg/20">
                    <i class="fa-solid fa-shield-cat text-4xl mb-3 opacity-50"></i>
                    <p class="text-sm">Noch keine Rollen definiert.</p>
                </div>` : ''}
            </div>
        `;
    },

    renderRoleCard(role) {
        const perms = Array.isArray(role.permissions) ? role.permissions : [];
        
        let badgeCount = 0;
        const badges = [];

        // 1. System Rechte anzeigen
        this.systemPermissions.forEach(sp => {
            if(perms.includes(sp.key)) {
                if(badgeCount < 5) {
                    badges.push(`<span class="inline-flex items-center px-2 py-1 rounded-md text-[10px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20">${sp.label.split(' ')[0].replace(/[^a-zA-ZäöüÄÖÜ]/g, '')}</span>`);
                    badgeCount++;
                }
            }
        });

        // 2. Gruppen Rechte anzeigen (Prefix 'manage_group:')
        const groupPerms = perms.filter(p => p.startsWith('manage_group:'));
        groupPerms.forEach(gp => {
            if(badgeCount < 5) {
                const groupName = gp.replace('manage_group:', '');
                badges.push(`<span class="inline-flex items-center px-2 py-1 rounded-md text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 truncate max-w-[100px]">${groupName}</span>`);
                badgeCount++;
            }
        });

        const moreCount = perms.length - badgeCount;

        // Systemrollen schützen (optional, hier nur visuell)
        const isSystemRole = ['Mitglied'].includes(role.name); 

        return `
            <div class="bg-dark-card hover:bg-dark-hover border border-dark-border p-5 rounded-2xl flex flex-col justify-between h-full group transition-all relative overflow-hidden">
                <!-- Top Actions -->
                <div class="flex justify-between items-start mb-3">
                    <div>
                        <h4 class="font-bold text-white text-lg leading-tight">${role.name}</h4>
                        <p class="text-[10px] text-dark-muted uppercase font-bold tracking-wider mt-1">${perms.length} Berechtigungen</p>
                    </div>
                    
                    ${!isSystemRole ? `
                    <button onclick="AdminRolesView.deleteRole('${role.id}')" class="text-dark-muted hover:text-red-400 p-2 -mr-2 -mt-2 rounded-lg hover:bg-red-500/10 transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100">
                        <i class="fa-regular fa-trash-can"></i>
                    </button>` : '<span class="text-[10px] bg-dark-bg border border-dark-border text-dark-muted px-2 py-1 rounded uppercase font-bold tracking-wider">System</span>'}
                </div>
                
                <!-- Badges Area -->
                <div class="flex flex-wrap gap-1.5 mb-6 content-start flex-1">
                    ${perms.includes('admin_global') 
                        ? '<span class="inline-flex items-center px-2 py-1 rounded-md text-[10px] font-bold bg-red-500/20 text-red-400 border border-red-500/30 w-full justify-center"><i class="fa-solid fa-crown mr-1.5"></i> SUPER ADMIN</span>' 
                        : badges.join('') + (moreCount > 0 ? `<span class="inline-flex items-center px-2 py-1 rounded-md text-[10px] font-bold text-dark-muted bg-dark-bg border border-dark-border">+${moreCount}</span>` : '')
                    }
                    ${perms.length === 0 ? '<span class="text-xs text-dark-muted italic">Keine Rechte zugewiesen.</span>' : ''}
                </div>

                <!-- Footer Action -->
                <button onclick="AdminRolesView.openEditPermissionsModal('${role.id}')" class="w-full py-2 bg-dark-bg hover:bg-brand-500/10 border border-dark-border hover:border-brand-500/30 rounded-xl text-sm text-dark-muted hover:text-brand-400 font-bold transition-all flex items-center justify-center gap-2">
                    <i class="fa-solid fa-list-check text-xs"></i> Rechte bearbeiten
                </button>
            </div>
        `;
    },

    openAddRoleModal() {
        const html = `
            <div class="p-6">
                <h3 class="text-xl font-bold text-white mb-6">Neue Rolle erstellen</h3>
                <form onsubmit="AdminRolesView.handleAddRole(event)">
                    <label class="block text-xs font-bold text-dark-muted uppercase mb-2">Bezeichnung</label>
                    <input type="text" name="name" required class="form-input mb-6" placeholder="z.B. Kassenwart">
                    <button type="submit" class="btn-primary w-full">Erstellen</button>
                </form>
            </div>
        `;
        App.openModal(html);
    },

    async handleAddRole(e) {
        e.preventDefault();
        const fd = new FormData(e.target);
        const newRole = {
            name: fd.get('name'),
            permissions: []
        };
        await Store.add('roles', newRole);
        App.closeModal();
        this.render(document.getElementById('content'));
    },

    async deleteRole(id) {
        if(confirm("Rolle wirklich löschen? Dies kann Auswirkungen auf bestehende Mitglieder haben.")) {
            await Store.remove('roles', id);
            this.render(document.getElementById('content'));
            App.showToast("Rolle gelöscht");
        }
    },

    openEditPermissionsModal(roleId) {
        const role = Store.state.roles.find(r => r.id == roleId);
        if(!role) return;

        const currentPerms = role.permissions || [];
        const groups = Store.state.groups || [];

        // System Checkboxen
        const systemChecks = this.systemPermissions.map(p => {
            const checked = currentPerms.includes(p.key) ? 'checked' : '';
            return `
                <label class="flex items-center gap-3 p-3 bg-dark-bg/50 hover:bg-dark-bg border border-dark-border rounded-xl cursor-pointer transition-colors">
                    <input type="checkbox" name="perms" value="${p.key}" ${checked} class="w-5 h-5 rounded border-dark-border bg-dark-bg text-blue-600 focus:ring-blue-500">
                    <span class="text-sm font-medium text-white">${p.label}</span>
                </label>
            `;
        }).join('');

        // Gruppen Checkboxen (Dynamisch)
        const groupChecks = groups.length > 0 ? groups.map(g => {
            const key = `manage_group:${g.name}`; 
            const checked = currentPerms.includes(key) ? 'checked' : '';
            return `
                <label class="flex items-center gap-3 p-3 bg-dark-bg/50 hover:bg-dark-bg border border-dark-border rounded-xl cursor-pointer transition-colors">
                    <input type="checkbox" name="perms" value="${key}" ${checked} class="w-5 h-5 rounded border-dark-border bg-dark-bg text-emerald-500 focus:ring-emerald-500">
                    <span class="text-sm text-dark-muted group-hover:text-white truncate">Gruppe: <span class="text-white font-bold">${g.name}</span></span>
                </label>
            `;
        }).join('') : '<div class="text-center p-4 text-dark-muted bg-dark-bg/30 rounded-xl border border-dashed border-dark-border text-sm">Keine Gruppen vorhanden.</div>';

        const html = `
            <div class="p-6 md:p-8 max-h-[85vh] overflow-y-auto custom-scrollbar flex flex-col">
                <div class="flex justify-between items-center mb-6 border-b border-dark-border pb-4 sticky top-0 bg-dark-card z-10">
                    <div>
                        <h3 class="text-xl font-bold text-white">Rechte: ${role.name}</h3>
                        <p class="text-xs text-dark-muted mt-1">Wähle die Berechtigungen für diese Rolle.</p>
                    </div>
                    <button onclick="App.closeModal()" class="text-dark-muted hover:text-white p-2"><i class="fa-solid fa-times text-xl"></i></button>
                </div>
                
                <form onsubmit="AdminRolesView.savePermissions(event, '${roleId}')" class="space-y-6">
                    <div class="space-y-6">
                        <!-- System Rechte -->
                        <div>
                            <div class="flex items-center gap-2 mb-3 pb-1 border-b border-blue-500/20">
                                <i class="fa-solid fa-gear text-blue-400 text-xs"></i>
                                <label class="text-xs font-bold text-blue-400 uppercase tracking-wider">Allgemeine Rechte</label>
                            </div>
                            <div class="grid grid-cols-1 gap-2">
                                ${systemChecks}
                            </div>
                        </div>

                        <!-- Gruppen Rechte -->
                        <div>
                            <div class="flex items-center gap-2 mb-3 pb-1 border-b border-emerald-500/20">
                                <i class="fa-solid fa-layer-group text-emerald-400 text-xs"></i>
                                <label class="text-xs font-bold text-emerald-400 uppercase tracking-wider">Gruppen Zugriff</label>
                            </div>
                            <p class="text-[10px] text-dark-muted mb-2">Erlaubt das Bearbeiten von Inhalten und Mitgliedern in spezifischen Gruppen.</p>
                            <div class="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-60 overflow-y-auto custom-scrollbar pr-1">
                                ${groupChecks}
                            </div>
                        </div>
                    </div>

                    <div class="pt-4 border-t border-dark-border">
                        <button type="submit" class="btn-primary w-full shadow-lg shadow-brand-500/20">Speichern</button>
                    </div>
                </form>
            </div>
        `;
        App.openModal(html);
        
        const modalContainer = document.getElementById('modal-content');
        if(modalContainer) {
            modalContainer.classList.add('max-w-2xl', 'max-h-[85vh]');
        }
    },

    async savePermissions(e, roleId) {
        e.preventDefault();
        const form = e.target;
        const checkboxes = form.querySelectorAll('input[name="perms"]:checked');
        const newPerms = Array.from(checkboxes).map(cb => cb.value);

        const role = Store.state.roles.find(r => r.id == roleId);
        if(role) {
            const updatedRole = { ...role, permissions: newPerms };
            
            // Safe update logic
            if (typeof supabase !== 'undefined') {
                const sessionStr = localStorage.getItem('vm_supabase_session');
                if(sessionStr) {
                    const token = JSON.parse(sessionStr).access_token;
                    const client = supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY, { global: { headers: { Authorization: `Bearer ${token}` } } });
                    
                    const payload = { ...updatedRole };
                    delete payload.id;
                    await client.from('roles').update(payload).eq('id', roleId);
                }
            } else {
                await Store.update('roles', updatedRole);
            }
            
            // Local update
            const idx = Store.state.roles.indexOf(role);
            if(idx !== -1) Store.state.roles[idx] = updatedRole;
            
            App.closeModal();
            App.showToast("Rechte gespeichert");
            this.render(document.getElementById('content'));
        }
    }
};

window.AdminRolesView = AdminRolesView;
