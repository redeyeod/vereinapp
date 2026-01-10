/**
 * =============================================================================
 * ADMIN ROLES VIEW
 * Verwaltung von Rollen und deren Berechtigungen (RBAC)
 * =============================================================================
 */

const AdminRolesView = {
    // Verfügbare Berechtigungs-Flags für das System
    availablePermissions: [
        { key: 'admin_global', label: '👑 Super-Admin (Alles erlaubt)' },
        { key: 'manage_members', label: '👥 Mitglieder verwalten' },
        { key: 'manage_workhours', label: '⏱️ Arbeitsstunden verwalten/genehmigen' },
        { key: 'manage_all_groups', label: 'dunkelblau_Alle Gruppen bearbeiten' },
        { key: 'manage_own_group', label: '🔵 Nur eigene Gruppen bearbeiten' },
        { key: 'manage_news', label: '📰 News & Events erstellen' },
        { key: 'manage_docs', label: 'bei_Dokumente hochladen' },
    ],

    render(container) {
        // Sicherheitscheck: Nur Admins dürfen hier rein
        if (!App.can('admin_global')) {
            container.innerHTML = `<div class="p-10 text-center text-red-400">Zugriff verweigert.</div>`;
            return;
        }

        const roles = Store.state.roles || [];

        container.innerHTML = `
            <div class="flex justify-between items-center mb-6 fade-in">
                <div>
                    <h3 class="text-xl font-bold text-white">Rollen & Rechte</h3>
                    <p class="text-xs text-dark-muted">Definiere, was welche Rolle darf.</p>
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
        
        // Zähle Berechtigungen für Anzeige
        const permBadges = perms.slice(0, 3).map(p => {
            const def = this.availablePermissions.find(ap => ap.key === p);
            return `<span class="text-[10px] bg-dark-bg border border-dark-border px-1.5 py-0.5 rounded text-dark-muted">${def ? def.label.split(' ')[0] : p}</span>`;
        }).join('');
        
        const moreCount = perms.length > 3 ? `+${perms.length - 3}` : '';

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
                        : permBadges + (moreCount ? `<span class="text-[10px] text-dark-muted self-center ml-1">${moreCount}</span>` : '')
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

        const checksHtml = this.availablePermissions.map(p => {
            const checked = currentPerms.includes(p.key) ? 'checked' : '';
            return `
                <label class="flex items-center gap-3 p-3 bg-dark-bg/50 rounded-lg border border-dark-border cursor-pointer hover:border-blue-500/30 transition-colors">
                    <input type="checkbox" name="perms" value="${p.key}" ${checked} class="w-4 h-4 rounded border-dark-border bg-slate-800 text-blue-600 focus:ring-blue-500">
                    <span class="text-sm text-white">${p.label}</span>
                </label>
            `;
        }).join('');

        const html = `
            <div class="p-6 md:p-8 max-h-[85vh] overflow-y-auto custom-scrollbar">
                <div class="flex justify-between items-center mb-6 border-b border-dark-border pb-4">
                    <h3 class="text-xl font-bold text-white">${isEdit ? 'Rolle bearbeiten' : 'Neue Rolle erstellen'}</h3>
                    <button onclick="App.closeModal()" class="text-dark-muted hover:text-white"><i class="fa-solid fa-times text-xl"></i></button>
                </div>
                
                <form onsubmit="AdminRolesView.save(event, '${roleId || ''}')" class="space-y-6">
                    <div>
                        <label class="text-xs font-bold text-dark-muted uppercase mb-1 block">Bezeichnung der Rolle</label>
                        <input type="text" name="name" value="${role.name}" class="form-input" placeholder="z.B. Gruppenleiter" required>
                        <p class="text-[10px] text-dark-muted mt-1">Dieser Name wird den Mitgliedern angezeigt.</p>
                    </div>

                    <div>
                        <label class="text-xs font-bold text-dark-muted uppercase mb-3 block">Berechtigungen</label>
                        <div class="space-y-2">
                            ${checksHtml}
                        </div>
                    </div>

                    <div class="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg text-xs text-blue-300">
                        <i class="fa-solid fa-circle-info mr-1"></i>
                        "Nur eigene Gruppen bearbeiten" greift nur, wenn der Benutzer auch Mitglied in der entsprechenden Gruppe ist.
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
        
        // Checkboxen einsammeln
        const perms = [];
        e.target.querySelectorAll('input[name="perms"]:checked').forEach(cb => perms.push(cb.value));

        const roleData = {
            name: fd.get('name'),
            permissions: perms
        };

        if (id) {
            // Update
            roleData.id = id;
            await Store.update('roles', roleData);
        } else {
            // Create
            await Store.add('roles', roleData);
        }

        App.closeModal();
        this.render(document.getElementById('content'));
    },

    async deleteRole(id) {
        if(confirm("Rolle wirklich löschen? Mitglieder mit dieser Rolle verlieren ihre Rechte.")) {
            await Store.remove('roles', id);
            this.render(document.getElementById('content'));
        }
    }
};

window.AdminRolesView = AdminRolesView;
