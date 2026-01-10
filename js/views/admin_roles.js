/**
 * =============================================================================
 * ADMIN ROLES VIEW
 * Verwaltung von Rollen und deren Berechtigungen (RBAC)
 * NEU: Unterstützt jetzt spezifische Gruppen-Berechtigungen
 * =============================================================================
 */

const AdminRolesView = {
    // Globale System-Rechte
    systemPermissions: [
        { key: 'admin_global', label: '👑 Super-Admin (Alles erlaubt)' },
        { key: 'manage_members', label: '👥 Mitglieder verwalten' },
        { key: 'manage_workhours', label: '⏱️ Arbeitsstunden verwalten' },
        { key: 'manage_all_groups', label: '🌐 Alle Gruppen bearbeiten (Vorstand)' },
        // 'manage_own_group' entfernt oder optional, da wir jetzt spezifisch werden wollen
        { key: 'manage_news', label: '📰 News & Events erstellen' },
        { key: 'manage_docs', label: '📁 Dokumente hochladen' },
    ],

    render(container) {
        if (!App.can('admin_global')) {
            container.innerHTML = `<div class="p-10 text-center text-red-400">Zugriff verweigert.</div>`;
            return;
        }

        const roles = Store.state.roles || [];

        container.innerHTML = `
            <div class="flex justify-between items-center mb-6 fade-in">
                <div>
                    <h3 class="text-xl font-bold text-white">Rollen & Rechte</h3>
                    <p class="text-xs text-dark-muted">Definiere präzise, wer welche Gruppe bearbeiten darf.</p>
                </div>
                <button onclick="AdminRolesView.openModal()" class="btn-primary flex items-center gap-2 text-sm">
                    <i class="fa-solid fa-shield-halved"></i> Neue Rolle
                </button>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4 fade-in">
                ${roles.map(role => this.renderRoleCard(role)).join('')}
            </div>
            
            ${roles.length === 0 ? '<div class="text-center p-10 text-dark-muted opacity-50">Noch keine Rollen definiert.</div>' : ''}
        `;
    },

    renderRoleCard(role) {
        const perms = Array.isArray(role.permissions) ? role.permissions : [];
        
        // Anzeige aufhübschen
        let badgeCount = 0;
        const badges = [];

        // 1. System Rechte anzeigen
        this.systemPermissions.forEach(sp => {
            if(perms.includes(sp.key)) {
                badges.push(`<span class="text-[10px] bg-blue-500/10 border border-blue-500/20 px-1.5 py-0.5 rounded text-blue-300">${sp.label.split(' ')[0]}</span>`);
                badgeCount++;
            }
        });

        // 2. Gruppen Rechte anzeigen (Prefix 'manage_group:')
        const groupPerms = perms.filter(p => p.startsWith('manage_group:'));
        groupPerms.forEach(gp => {
            if(badgeCount < 4) {
                const groupName = gp.replace('manage_group:', '');
                badges.push(`<span class="text-[10px] bg-green-500/10 border border-green-500/20 px-1.5 py-0.5 rounded text-green-300">${groupName}</span>`);
                badgeCount++;
            }
        });

        const moreCount = perms.length - badgeCount;

        return `
            <div class="bg-dark-card p-5 rounded-xl border border-dark-border hover:border-blue-500/30 transition-all group relative">
                <div class="flex justify-between items-start mb-3">
                    <h4 class="font-bold text-white text-lg">${role.name}</h4>
                    <button onclick="AdminRolesView.deleteRole('${role.id}')" class="text-dark-muted hover:text-red-400 p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <i class="fa-regular fa-trash-can"></i>
                    </button>
                </div>
                
                <div class="flex flex-wrap gap-1 mb-4 h-6 overflow-hidden">
                    ${perms.includes('admin_global') 
                        ? '<span class="text-[10px] bg-red-500/20 text-red-400 border border-red-500/30 px-2 py-0.5 rounded font-bold">SUPER ADMIN</span>' 
                        : badges.join('') + (moreCount > 0 ? `<span class="text-[10px] text-dark-muted self-center ml-1">+${moreCount}</span>` : '')
                    }
                </div>

                <button onclick="AdminRolesView.openModal('${role.id}')" class="w-full py-2 bg-dark-bg hover:bg-dark-hover border border-dark-border rounded-lg text-sm text-blue-400 font-bold transition-colors">
                    Bearbeiten
                </button>
            </div>
        `;
    },

    openModal(roleId = null) {
        const isEdit = !!roleId;
        const role = roleId ? Store.state.roles.find(r => r.id == roleId) : { name: '', permissions: [] };
        if (roleId && !role) return;

        const currentPerms = role.permissions || [];
        const groups = Store.state.groups || [];

        // System Checkboxen
        const systemChecks = this.systemPermissions.map(p => {
            const checked = currentPerms.includes(p.key) ? 'checked' : '';
            return `
                <label class="flex items-center gap-3 p-2 hover:bg-dark-bg/50 rounded cursor-pointer transition-colors">
                    <input type="checkbox" name="perms" value="${p.key}" ${checked} class="w-4 h-4 rounded border-dark-border bg-slate-800 text-blue-600 focus:ring-blue-500">
                    <span class="text-sm text-white">${p.label}</span>
                </label>
            `;
        }).join('');

        // Gruppen Checkboxen (Dynamisch)
        const groupChecks = groups.length > 0 ? groups.map(g => {
            const key = `manage_group:${g.name}`; // Spezieller Key für jede Gruppe
            const checked = currentPerms.includes(key) ? 'checked' : '';
            return `
                <label class="flex items-center gap-3 p-2 hover:bg-dark-bg/50 rounded cursor-pointer transition-colors">
                    <input type="checkbox" name="perms" value="${key}" ${checked} class="w-4 h-4 rounded border-dark-border bg-slate-800 text-green-500 focus:ring-green-500">
                    <span class="text-sm text-dark-muted group-hover:text-white truncate">Gruppe: <span class="text-white font-medium">${g.name}</span></span>
                </label>
            `;
        }).join('') : '<p class="text-xs text-dark-muted italic p-2">Keine Gruppen angelegt.</p>';

        const html = `
            <div class="p-6 md:p-8 max-h-[85vh] overflow-y-auto custom-scrollbar">
                <div class="flex justify-between items-center mb-6 border-b border-dark-border pb-4">
                    <h3 class="text-xl font-bold text-white">${isEdit ? 'Rolle bearbeiten' : 'Neue Rolle erstellen'}</h3>
                    <button onclick="App.closeModal()" class="text-dark-muted hover:text-white"><i class="fa-solid fa-times text-xl"></i></button>
                </div>
                
                <form onsubmit="AdminRolesView.save(event, '${roleId || ''}')" class="space-y-6">
                    <div>
                        <label class="text-xs font-bold text-dark-muted uppercase mb-1 block">Rollen-Name</label>
                        <input type="text" name="name" value="${role.name}" class="form-input" placeholder="z.B. Leiter Nachtkrabb" required>
                    </div>

                    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <!-- System Rechte -->
                        <div>
                            <label class="text-xs font-bold text-blue-400 uppercase mb-2 block border-b border-blue-500/20 pb-1">Allgemeine Rechte</label>
                            <div class="space-y-1">
                                ${systemChecks}
                            </div>
                        </div>

                        <!-- Gruppen Rechte -->
                        <div>
                            <label class="text-xs font-bold text-green-400 uppercase mb-2 block border-b border-green-500/20 pb-1">Spezifische Gruppen</label>
                            <div class="space-y-1 max-h-60 overflow-y-auto custom-scrollbar bg-dark-card/50 rounded-lg border border-dark-border p-2">
                                ${groupChecks}
                            </div>
                            <p class="text-[10px] text-dark-muted mt-2">Hake hier die Gruppen an, die diese Rolle bearbeiten darf.</p>
                        </div>
                    </div>

                    <button type="submit" class="btn-primary w-full">Speichern</button>
                </form>
            </div>
        `;
        App.openModal(html);
    },

    async save(e, id) {
        e.preventDefault();
        const fd = new FormData(e.target);
        
        const perms = [];
        e.target.querySelectorAll('input[name="perms"]:checked').forEach(cb => perms.push(cb.value));

        const roleData = {
            name: fd.get('name'),
            permissions: perms
        };

        if (id) {
            roleData.id = id;
            await Store.update('roles', roleData);
        } else {
            await Store.add('roles', roleData);
        }

        App.closeModal();
        this.render(document.getElementById('content'));
    },

    async deleteRole(id) {
        if(confirm("Rolle wirklich löschen?")) {
            await Store.remove('roles', id);
            this.render(document.getElementById('content'));
        }
    }
};

window.AdminRolesView = AdminRolesView;
