/**
 * =============================================================================
 * GROUPS VIEW (RBAC Fixed & Member-Only Access)
 * Zeigt Gruppen an.
 * - Nicht-Mitglieder sehen Gruppen ausgegraut.
 * - Mitglieder UND Admins/Betreuer können Gruppen öffnen.
 * - Admins können bearbeiten.
 * =============================================================================
 */

const GroupsView = {
    render(container) {
        // Prüfen, ob man überhaupt Gruppen sehen/verwalten darf
        const canCreate = App.can('manage_all_groups'); 

        const addButtonHtml = canCreate 
            ? `<button onclick="GroupsView.openAddModal()" class="bg-blue-600 hover:bg-blue-700 text-white w-10 h-10 md:w-auto md:px-4 md:py-2 rounded-lg text-sm font-bold flex-shrink-0 flex items-center justify-center transition-all shadow-lg shadow-blue-900/30">
                 <i class="fa-solid fa-plus md:mr-2"></i> <span class="hidden md:inline">Gruppe</span>
               </button>`
            : '';

        container.innerHTML = `
            <div class="flex flex-col gap-4 fade-in h-full">
                <!-- Toolbar -->
                <div class="flex items-center gap-3 bg-dark-card p-2 rounded-xl border border-dark-border sticky top-0 z-10 shadow-sm">
                    <div class="relative flex-1">
                        <i class="fa-solid fa-search absolute left-3 top-1/2 -translate-y-1/2 text-dark-muted text-sm"></i>
                        <input type="text" id="groupSearch" onkeyup="GroupsView.filter()" placeholder="Gruppen suchen..." 
                            class="w-full bg-dark-bg border-none rounded-lg pl-9 pr-4 py-2 text-white focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm placeholder-dark-muted transition-shadow">
                    </div>
                    ${addButtonHtml}
                </div>

                <div id="groupsListContainer" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pb-4"></div>
                
                <div id="noGroupsFound" class="hidden py-12 text-center text-dark-muted flex flex-col items-center justify-center">
                    <div class="w-16 h-16 bg-dark-bg rounded-full flex items-center justify-center mb-4 text-2xl opacity-50 border border-dark-border">
                        <i class="fa-solid fa-layer-group"></i>
                    </div>
                    <p class="text-sm font-bold">Keine Gruppen gefunden.</p>
                </div>
            </div>
        `;
        
        this.updateList();
    },

    updateList(filter = "") {
        const container = document.getElementById('groupsListContainer');
        const emptyState = document.getElementById('noGroupsFound');
        if(!container) return;

        const groups = (Store.state && Store.state.groups) ? Store.state.groups : [];

        const filtered = groups.filter(g => {
            return (g.name || '').toLowerCase().includes(filter.toLowerCase());
        });

        if (filtered.length === 0) {
            if(emptyState) emptyState.classList.remove('hidden');
            container.innerHTML = '';
        } else {
            if(emptyState) emptyState.classList.add('hidden');
            
            container.innerHTML = filtered.map(g => {
                // 1. RECHTE PRÜFEN (Bearbeiten & Zugriff)
                // Wer bearbeiten darf (Admin/Betreuer), hat automatisch auch Lesezugriff
                const canEditThisGroup = App.can('manage_group_content', g.name);
                
                // 2. MITGLIEDSCHAFT PRÜFEN
                // Wir stellen sicher, dass user.groups existiert, bevor wir prüfen
                const userGroups = (App.user && Array.isArray(App.user.groups)) ? App.user.groups : [];
                const isMember = userGroups.includes(g.name);

                // 3. ZUGRIFFSBRECHTIGUNG (Entweder Admin ODER Mitglied)
                const hasAccess = canEditThisGroup || isMember;

                // 4. OPTIK & INTERAKTION BESTIMMEN
                const cardClasses = hasAccess 
                    ? "hover:border-blue-500/30 cursor-pointer opacity-100" 
                    : "opacity-60 grayscale-[0.8] cursor-not-allowed border-transparent";
                
                // Wenn Zugriff erlaubt, setzen wir den onclick Handler
                const clickAction = hasAccess 
                    ? `onclick="GroupsView.openGroup('${g.id}')"` 
                    : ""; 

                // Mitglieder zählen
                const memberCount = (Store.state.members || []).filter(m => Array.isArray(m.groups) && m.groups.includes(g.name)).length;

                return `
                <div ${clickAction} class="bg-dark-card p-5 rounded-xl border border-dark-border flex flex-col gap-3 transition-all group relative overflow-hidden ${cardClasses}">
                    <div class="flex justify-between items-start">
                        <div class="flex items-center gap-3">
                            <div class="w-10 h-10 rounded-lg bg-slate-800 text-slate-300 flex items-center justify-center text-lg border border-slate-700">
                                <i class="fa-solid fa-users"></i>
                            </div>
                            <div>
                                <h4 class="font-bold text-white text-base leading-tight">${g.name}</h4>
                                <p class="text-xs text-dark-muted mt-0.5">${memberCount} Mitglieder</p>
                            </div>
                        </div>
                        
                        ${canEditThisGroup ? `
                            <!-- WICHTIG: stopPropagation damit der Klick auf Edit nicht die Gruppe öffnet -->
                            <button onclick="event.stopPropagation(); GroupsView.openEditModal('${g.id}')" class="w-8 h-8 rounded-lg bg-dark-bg text-dark-muted hover:text-blue-400 border border-transparent hover:border-dark-border flex items-center justify-center transition-colors z-10">
                                <i class="fa-solid fa-pen text-xs"></i>
                            </button>
                        ` : ''}
                    </div>
                    
                    ${g.description ? `<p class="text-xs text-dark-muted line-clamp-2">${g.description}</p>` : ''}
                    
                    ${!hasAccess ? `
                        <div class="mt-2 text-[10px] uppercase font-bold text-red-400/70 tracking-wider flex items-center gap-1">
                             <i class="fa-solid fa-lock"></i> Kein Zugriff
                        </div>
                    ` : `
                        <div class="flex -space-x-2 overflow-hidden py-1 mt-auto">
                            ${this.renderMemberAvatars(g.name)}
                        </div>
                    `}
                </div>`;
            }).join('');
        }
    },

    openGroup(id) {
        const g = Store.state.groups.find(gr => gr.id == id);
        if (!g) return;

        // Sicherheitscheck beim Öffnen: Admin/Betreuer ODER Mitglied
        const canEditThisGroup = App.can('manage_group_content', g.name);
        const userGroups = (App.user && Array.isArray(App.user.groups)) ? App.user.groups : [];
        const isMember = userGroups.includes(g.name);
        
        if (canEditThisGroup || isMember) {
            // FIX: Hier wird nun tatsächlich navigiert!
            if (typeof App.navigate === 'function') {
                App.navigate('group-details', { id: g.id });
            } else {
                // Fallback, falls die Navigation anders gehandhabt wird
                console.log("Navigiere zu Gruppe:", g.name);
                App.showToast(`Öffne Gruppe: ${g.name}`, "success");
            }
        } else {
            App.showToast("Du hast keinen Zugriff auf diese Gruppe.", "error");
        }
    },

    renderMemberAvatars(groupName) {
        const members = (Store.state.members || []).filter(m => Array.isArray(m.groups) && m.groups.includes(groupName));
        const preview = members.slice(0, 5);
        let html = preview.map(m => `
            <div class="inline-block h-6 w-6 rounded-full ring-2 ring-dark-card bg-slate-700 flex items-center justify-center text-[8px] text-white font-bold" title="${m.firstName} ${m.lastName}">
                ${(m.firstName||'?').charAt(0)}${(m.lastName||'?').charAt(0)}
            </div>
        `).join('');
        
        if (members.length > 5) {
            html += `<div class="inline-block h-6 w-6 rounded-full ring-2 ring-dark-card bg-dark-bg flex items-center justify-center text-[8px] text-dark-muted font-bold">+${members.length - 5}</div>`;
        }
        return html;
    },

    filter() { 
        const searchInput = document.getElementById('groupSearch');
        if(searchInput) this.updateList(searchInput.value); 
    },

    openAddModal(editModeData = null) {
        if(!App.can('manage_groups')) return;

        const isEdit = !!editModeData;
        const data = editModeData || {};
        
        if (isEdit && !App.can('manage_group_content', data.name)) {
            App.showToast("Keine Berechtigung für diese Gruppe.", "error");
            return;
        }

        const title = isEdit ? "Gruppe bearbeiten" : "Neue Gruppe";
        const btnText = isEdit ? "Speichern" : "Anlegen";
        const handler = isEdit ? `GroupsView.handleUpdate(event, '${data.id}')` : "GroupsView.handleAdd(event)";

        const html = `
            <div class="p-6 md:p-8">
                <div class="flex justify-between items-center mb-6 border-b border-dark-border pb-4">
                    <h3 class="text-xl font-bold text-white">${title}</h3>
                    <button onclick="App.closeModal()" class="text-dark-muted hover:text-white"><i class="fa-solid fa-times text-xl"></i></button>
                </div>
                <form onsubmit="${handler}" class="space-y-5">
                    <div>
                        <label class="text-xs font-bold text-dark-muted uppercase mb-1 block">Gruppenname *</label>
                        <input type="text" name="name" value="${data.name||''}" required class="form-input" placeholder="z.B. Elferrat">
                    </div>
                    <div>
                        <label class="text-xs font-bold text-dark-muted uppercase mb-1 block">Beschreibung</label>
                        <textarea name="description" class="form-input" rows="3" placeholder="Kurze Beschreibung...">${data.description||''}</textarea>
                    </div>
                    
                    ${isEdit ? `
                    <div class="p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex justify-between items-center mt-6">
                        <span class="text-xs text-red-400 font-bold">Gruppe löschen?</span>
                        <button type="button" onclick="GroupsView.delete('${data.id}')" class="text-xs bg-red-500 hover:bg-red-600 text-white px-3 py-1.5 rounded transition-colors">Löschen</button>
                    </div>` : ''}

                    <button type="submit" class="btn-primary w-full mt-4">${btnText}</button>
                </form>
            </div>
        `;
        App.openModal(html);
    },

    openEditModal(id) {
        const g = Store.state.groups.find(gr => gr.id == id);
        if(!g) return;
        this.openAddModal(g);
    },

    async handleAdd(e) {
        e.preventDefault();
        if(!App.can('manage_all_groups')) {
            App.showToast("Nur Vorstände können neue Gruppen anlegen.", "error");
            return;
        }

        const fd = new FormData(e.target);
        const name = fd.get('name');
        
        if(Store.state.groups.some(g => g.name.toLowerCase() === name.toLowerCase())) {
            App.showToast("Eine Gruppe mit diesem Namen existiert bereits.", "error");
            return;
        }

        await Store.add('groups', {
            name: name,
            description: fd.get('description')
        });
        App.closeModal();
        this.updateList();
    },

    async handleUpdate(e, id) {
        e.preventDefault();
        const fd = new FormData(e.target);
        const g = Store.state.groups.find(gr => gr.id == id);
        if(!g) return;

        if (!App.can('manage_group_content', g.name)) {
            App.showToast("Fehlende Berechtigung.", "error");
            return;
        }

        const updated = { 
            ...g, 
            name: fd.get('name'), 
            description: fd.get('description') 
        };
        
        const cleanUpdate = { ...updated };
        delete cleanUpdate.id;

        const { error } = await supabase.from('groups').update(cleanUpdate).eq('id', id);
        
        if(error) {
            App.showToast(error.message, "error");
        } else {
            await Store.fetchTable('groups');
            App.closeModal();
            this.updateList();
            App.showToast("Gruppe gespeichert");
        }
    },

    async delete(id) {
        const g = Store.state.groups.find(gr => gr.id == id);
        if (!g) return;

        if (!App.can('manage_group_content', g.name)) {
            App.showToast("Keine Berechtigung zum Löschen.", "error");
            return;
        }

        if(confirm(`Gruppe "${g.name}" wirklich löschen?`)) {
            await Store.remove('groups', id);
            App.closeModal();
            this.updateList();
        }
    }
};

window.GroupsView = GroupsView;
