/**
 * =============================================================================
 * GROUPS VIEW (Hybrid: Old Design + New Security Logic)
 * Design: "Direct DB Diagnostic Mode" (Original)
 * Logik: Strikte RBAC Prüfung (Admin/Mitglied)
 * =============================================================================
 */

const GroupsView = {
    state: {
        activeGroupId: null,
        activeTab: 'members', 
        currentFolderId: null,
        myId: 1 // Fallback ID
    },

    render(container) {
        if (this.state.activeGroupId) {
            this.renderDetail(container);
        } else {
            this.renderList(container);
        }
    },

    // -------------------------------------------------------------------------
    // LISTEN-ANSICHT
    // -------------------------------------------------------------------------
    renderList(container) {
        const counts = {};
        const members = Store.state.members || [];
        
        // Mitglieder zählen
        members.forEach(m => {
            const memberGroups = Array.isArray(m.groups) ? m.groups : [];
            if (m.group && m.group !== 'Keine' && !memberGroups.includes(m.group)) {
                memberGroups.push(m.group);
            }
            memberGroups.forEach(gName => {
                if (!counts[gName]) counts[gName] = 0;
                counts[gName]++;
            });
        });

        // RECHTE PRÜFEN: Wer darf generell Gruppen verwalten (z.B. "Neue Gruppe")?
        const canManageAll = App.can('manage_all_groups'); 
        
        const allGroups = Store.state.groups || [];
        
        // User ermitteln (Support für App.user oder App.state.currentUser)
        const currentUser = App.user || (App.state && App.state.currentUser);
        const myGroupNames = currentUser ? (Array.isArray(currentUser.groups) ? currentUser.groups : []) : [];

        // Aufteilung in "Meine" und "Andere"
        const myGroups = allGroups.filter(g => myGroupNames.includes(g.name));
        const otherGroups = allGroups.filter(g => !myGroupNames.includes(g.name));

        const addGroupButton = canManageAll 
            ? `<button onclick="GroupsView.openAddModal()" class="group flex flex-col items-center justify-center p-6 rounded-2xl border border-dashed border-dark-border hover:border-blue-500/50 hover:bg-dark-hover/30 transition-all min-h-[140px]">
                <div class="w-10 h-10 rounded-full bg-dark-bg border border-dark-border flex items-center justify-center text-dark-muted group-hover:text-blue-500 group-hover:border-blue-500/50 mb-3 transition-colors">
                    <i class="fa-solid fa-plus"></i>
                </div>
                <span class="text-sm font-medium text-dark-muted group-hover:text-blue-400">Neue Abteilung</span>
               </button>`
            : '';

        const renderGroupCard = (group, isMember) => {
            const count = counts[group.name] || 0;
            
            // INDIVIDUELLE RECHTE PRÜFEN:
            // Darf ich DIESE Gruppe verwalten? (z.B. als Gruppen-Admin)
            const canManageThisGroup = App.can('manage_group_content', group.name);
            
            // Zugriff erlauben, wenn Mitglied ODER Manager
            const hasAccess = isMember || canManageThisGroup;
            
            const cardStyle = hasAccess 
                ? 'cursor-pointer hover:border-blue-500/50 hover:shadow-lg hover:shadow-blue-900/10 bg-dark-card' 
                : 'cursor-not-allowed opacity-50 bg-dark-bg border-dashed grayscale-[0.8]';

            // Löschen nur für Manager dieser Gruppe
            const deleteButton = canManageThisGroup 
                ? `<button onclick="event.stopPropagation(); GroupsView.delete('${group.id}')" class="text-dark-muted hover:text-red-400 p-2 rounded-lg hover:bg-red-500/10 transition-colors z-10" title="Löschen">
                    <i class="fa-regular fa-trash-can"></i>
                   </button>`
                : '';

            const lockIcon = !hasAccess ? '<i class="fa-solid fa-lock text-dark-muted mr-2"></i>' : '';

            // Onclick Logik
            const clickAction = hasAccess 
                ? `GroupsView.openGroup('${group.id}')` 
                : `App.showToast('Kein Zugriff auf diese Gruppe', 'error')`;

            return `
            <div onclick="${clickAction}" 
                 class="p-5 rounded-2xl border border-dark-border transition-all flex flex-col justify-between min-h-[140px] ${cardStyle} relative group/card">
                <div class="flex justify-between items-start mb-2">
                    <h3 class="font-bold text-lg text-white leading-tight truncate pr-2 flex items-center">
                        ${lockIcon} ${group.name}
                    </h3>
                    ${deleteButton}
                </div>
                <div class="mt-auto pt-4 flex items-end justify-between border-t border-dark-border/30">
                    <div>
                        <span class="text-2xl font-bold text-white block leading-none">${count}</span>
                        <span class="text-start text-[10px] text-dark-muted uppercase tracking-wider">Mitglieder</span>
                    </div>
                    ${hasAccess ? `<i class="fa-solid fa-arrow-right text-dark-muted opacity-50 group-hover/card:translate-x-1 transition-transform"></i>` : ''}
                </div>
            </div>
            `;
        };

        container.innerHTML = `
            <div class="mb-8 fade-in">
                <div class="flex items-center gap-2 mb-4 px-1">
                    <h3 class="text-lg font-bold text-white">Meine Gruppen</h3>
                    <span class="bg-blue-500/10 text-blue-400 text-xs font-bold px-2 py-0.5 rounded-md border border-blue-500/20">${myGroups.length}</span>
                </div>
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    ${myGroups.map(g => renderGroupCard(g, true)).join('')}
                    ${addGroupButton}
                </div>
            </div>
            ${otherGroups.length > 0 ? `
            <div class="mb-8 pt-6 border-t border-dark-border/50 fade-in" style="animation-delay: 0.1s">
                <h3 class="text-sm font-bold text-dark-muted uppercase tracking-wider mb-4 px-1">Weitere Gruppen</h3>
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 opacity-80">
                    ${otherGroups.map(g => renderGroupCard(g, false)).join('')}
                </div>
            </div>
            ` : ''}
        `;
    },

    // -------------------------------------------------------------------------
    // DETAIL-ANSICHT
    // -------------------------------------------------------------------------
    renderDetail(container) {
        const group = Store.state.groups ? Store.state.groups.find(g => g.id == this.state.activeGroupId) : null;
        if (!group) { this.closeGroup(); return; }

        if (!group.chat) group.chat = [];
        if (!group.files) group.files = []; 

        // Prüfen ob Bearbeiten erlaubt ist
        const canManageThisGroup = App.can('manage_group_content', group.name);
        
        const editButton = canManageThisGroup
            ? `<button onclick="GroupsView.openEditGroupModal('${group.id}')" class="w-10 h-10 rounded-full bg-dark-bg border border-dark-border text-dark-muted hover:text-blue-400 hover:border-blue-500/50 flex items-center justify-center transition-all flex-shrink-0"><i class="fa-solid fa-pen"></i></button>`
            : '';

        const tabs = [
            { id: 'members', label: 'Mitglieder', icon: 'fa-users' },
            { id: 'chat', label: 'Chat', icon: 'fa-comments' },
            { id: 'calendar', label: 'Termine', icon: 'fa-calendar-days' },
            { id: 'files', label: 'Dateien', icon: 'fa-folder-tree' }
        ];

        container.innerHTML = `
            <div class="fade-in h-full flex flex-col">
                <div class="flex items-center gap-3 md:gap-4 mb-4 md:mb-6">
                    <button onclick="GroupsView.closeGroup()" class="w-10 h-10 rounded-full bg-dark-card border border-dark-border text-dark-muted hover:text-white hover:bg-dark-hover flex items-center justify-center transition-colors flex-shrink-0">
                        <i class="fa-solid fa-arrow-left"></i>
                    </button>
                    <div class="flex-1 min-w-0">
                        <h2 class="text-xl md:text-2xl font-bold text-white truncate">${group.name}</h2>
                        <p class="text-xs text-dark-muted truncate">Gruppen-Dashboard</p>
                    </div>
                    ${editButton}
                </div>

                <div class="flex gap-2 mb-4 md:mb-6 overflow-x-auto pb-2 border-b border-dark-border/50 no-scrollbar">
                    ${tabs.map(tab => `
                        <button onclick="GroupsView.switchTab('${tab.id}')" 
                            class="px-3 md:px-4 py-2 rounded-xl text-xs md:text-sm font-bold flex items-center transition-all whitespace-nowrap flex-shrink-0
                            ${this.state.activeTab === tab.id ? 'bg-blue-600 text-white shadow-lg' : 'bg-transparent text-dark-muted hover:bg-dark-hover hover:text-white'}">
                            <i class="fa-solid ${tab.icon} mr-2"></i> ${tab.label}
                        </button>
                    `).join('')}
                </div>

                <div class="flex-1 overflow-y-auto bg-dark-card/50 rounded-bubble border border-dark-border p-4 md:p-6 min-h-[50vh]">
                    ${this.getTabContent(group)}
                </div>
            </div>
        `;
        
        if(this.state.activeTab === 'chat') {
            const chatBox = document.getElementById('chat-messages');
            if(chatBox) chatBox.scrollTop = chatBox.scrollHeight;
        }
    },

    getTabContent(group) {
        switch (this.state.activeTab) {
            case 'members': return this.renderTabMembers(group);
            case 'chat': return this.renderTabChat(group);
            case 'calendar': return this.renderTabCalendar(group);
            case 'files': return this.renderTabFiles(group);
            default: return '';
        }
    },

    // --- TAB: MITGLIEDER ---
    renderTabMembers(group) {
        const members = (Store.state.members || []).filter(m => {
            const groups = Array.isArray(m.groups) ? m.groups : [];
            if (m.group === group.name) return true; // Legacy
            return groups.includes(group.name);
        });

        // Hinzufügen nur wenn man Rechte hat
        const canManageThisGroup = App.can('manage_group_content', group.name);
        
        const addButton = canManageThisGroup 
            ? `<button onclick="GroupsView.openAddMemberModal('${group.id}')" class="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg text-xs font-bold transition-colors flex items-center shadow-lg whitespace-nowrap">
                <i class="fa-solid fa-plus mr-2 md:mr-0 lg:mr-2"></i> <span class="hidden md:hidden lg:inline">Mitglied hinzufügen</span><span class="md:inline lg:hidden">Neu</span>
               </button>` 
            : '';
        
        return `
            <div class="flex flex-col h-full">
                <div class="flex justify-between items-center mb-4">
                    <span class="text-sm text-dark-muted">${members.length} Mitglieder</span>
                    ${addButton}
                </div>
                ${members.length === 0 
                    ? `<div class="text-center text-dark-muted py-10 bg-dark-bg/30 rounded-xl border border-dashed border-dark-border"><i class="fa-solid fa-user-slash text-4xl mb-3 opacity-50"></i><p>Keine Mitglieder.</p></div>` 
                    : `<div class="overflow-x-auto rounded-xl border border-dark-border">
                        <table class="w-full text-left border-collapse">
                            <thead>
                                <tr class="bg-dark-bg text-dark-muted text-xs uppercase tracking-wider border-b border-dark-border">
                                    <th class="p-4 font-semibold">Name</th>
                                    <th class="p-4 font-semibold hidden sm:table-cell">Rolle</th>
                                    <th class="p-4 font-semibold text-right">Aktion</th>
                                </tr>
                            </thead>
                            <tbody class="text-sm text-dark-text divide-y divide-dark-border bg-dark-card/30">
                                ${members.map(m => `
                                    <tr class="hover:bg-dark-hover/50 transition-colors group/row">
                                        <td class="p-4 flex items-center gap-3">
                                            <div class="w-8 h-8 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center text-xs font-bold border border-blue-500/30 flex-shrink-0">
                                                ${m.firstName.charAt(0)}${m.lastName.charAt(0)}
                                            </div>
                                            <div class="min-w-0"><span class="font-medium block truncate">${m.firstName} ${m.lastName}</span></div>
                                        </td>
                                        <td class="p-4 text-dark-muted hidden sm:table-cell">${m.role}</td>
                                        <td class="p-4 text-right">
                                            ${canManageThisGroup ? `<button onclick="GroupsView.removeMemberFromGroup('${m.id}')" class="text-dark-muted hover:text-red-400 md:opacity-0 group-hover/row:opacity-100 transition-opacity p-2 bg-dark-bg md:bg-transparent rounded-lg" title="Entfernen"><i class="fa-solid fa-user-minus"></i></button>` : ''}
                                        </td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>`
                }
            </div>
        `;
    },

    // --- MODAL: Mitglied hinzufügen ---
    openAddMemberModal(groupId) {
        // Berechtigungscheck
        const group = Store.state.groups.find(g => g.id == groupId);
        if(!group) return;
        if(!App.can('manage_group_content', group.name)) return;

        const availableMembers = (Store.state.members || []).filter(m => {
            const inGroupNew = Array.isArray(m.groups) && m.groups.includes(group.name);
            const inGroupOld = m.group === group.name;
            return !inGroupNew && !inGroupOld;
        });

        const html = `
            <div class="p-4 md:p-8 h-[500px] flex flex-col">
                <div class="flex justify-between items-center mb-4 border-b border-dark-border pb-4">
                    <h3 class="text-lg md:text-xl font-bold text-white">Mitglied hinzufügen</h3>
                    <button onclick="App.closeModal()" class="text-dark-muted hover:text-white p-2"><i class="fa-solid fa-times text-xl"></i></button>
                </div>
                <div class="mb-4 relative">
                    <i class="fa-solid fa-search absolute left-3 top-3 text-dark-muted text-sm"></i>
                    <input type="text" onkeyup="GroupsView.filterMemberSelect(this)" placeholder="Mitglied suchen..." 
                        class="w-full bg-dark-bg border border-dark-border rounded-xl pl-10 pr-4 py-2 text-white focus:outline-none focus:border-blue-500 transition-colors text-sm">
                </div>
                <div id="member-select-list" class="flex-1 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                    ${availableMembers.length === 0 ? '<p class="text-center text-dark-muted text-sm mt-10">Alle verfügbaren Mitglieder sind bereits in dieser Gruppe.</p>' : ''}
                    ${availableMembers.map(m => `
                        <div class="member-item flex justify-between items-center p-3 rounded-lg bg-dark-bg border border-dark-border hover:border-blue-500/50 transition-colors group">
                            <div class="flex items-center gap-3">
                                <div class="w-8 h-8 rounded-full bg-slate-700 text-slate-300 flex items-center justify-center text-xs font-bold flex-shrink-0">${m.firstName.charAt(0)}</div>
                                <div class="overflow-hidden"><p class="text-sm font-bold text-white member-name truncate">${m.firstName} ${m.lastName}</p></div>
                            </div>
                            <button onclick="GroupsView.addMemberDirect('${groupId}', '${m.id}')" class="bg-blue-600 hover:bg-blue-700 text-white p-2 rounded-lg text-xs transition-colors shadow-lg"><i class="fa-solid fa-plus"></i></button>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
        App.openModal(html);
    },

    filterMemberSelect(input) {
        const filter = input.value.toLowerCase();
        document.querySelectorAll('#member-select-list .member-item').forEach(item => {
            const name = item.querySelector('.member-name').textContent.toLowerCase();
            item.classList.toggle('hidden', !name.includes(filter));
            item.classList.toggle('flex', name.includes(filter));
        });
    },

    // --- FIX: Direkte DB-Kommunikation für JSONB Spalte ---
    async addMemberDirect(groupId, memberId) {
        const group = Store.state.groups.find(g => g.id == groupId);
        // Security Check vor DB Operation
        if (!group || !App.can('manage_group_content', group.name)) {
             App.showToast("Keine Berechtigung", "error");
             return;
        }

        const member = Store.state.members.find(m => m.id == memberId);

        if (member && group) {
            try {
                App.showToast("Speichere...", "info");

                // Arrays sicherstellen
                let currentGroups = Array.isArray(member.groups) ? [...member.groups] : [];
                
                // Legacy Migration: Alten "Singular" Wert übernehmen
                if (member.group && member.group !== 'Keine' && !currentGroups.includes(member.group)) {
                    currentGroups.push(member.group);
                }

                if (!currentGroups.includes(group.name)) {
                    currentGroups.push(group.name);
                }
                
                // DIREKTER SUPABASE AUFRUF
                // Wir nutzen hier direkt den Client, um sicherzustellen, dass das JSONB Array korrekt übertragen wird.
                const _sb = supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY);
                
                const { data, error } = await _sb
                    .from('members')
                    .update({ 
                        groups: currentGroups // JSONB Array wird hier direkt übergeben
                    })
                    .eq('id', member.id)
                    .select();

                if (error) {
                    throw new Error("DB Error: " + error.message);
                }

                if (!data || data.length === 0) {
                    throw new Error("Update verweigert (RLS). Bitte 'UPDATE' Policy in Supabase prüfen.");
                }

                // Lokalen State aktualisieren
                member.groups = currentGroups;
                
                App.closeModal();
                App.showToast(`${member.firstName} hinzugefügt`, "success");
                this.render(document.getElementById('content'));
                
                if(Store.fetchTable) Store.fetchTable('members');

            } catch (e) {
                console.error(e);
                App.showToast("Fehler: " + e.message, "error");
            }
        }
    },

    async removeMemberFromGroup(memberId) {
        const group = Store.state.groups.find(g => g.id == this.state.activeGroupId);
        if (!group) return;
        
        // Security Check
        if (!App.can('manage_group_content', group.name)) return;

        if(confirm(`Entfernen aus '${group.name}'?`)) {
            const member = Store.state.members.find(m => m.id == memberId);
            if(member) {
                try {
                    App.showToast("Entferne...", "info");
                    
                    let currentGroups = Array.isArray(member.groups) ? [...member.groups] : [];
                    
                    // Legacy Migration
                    if (member.group && member.group !== 'Keine' && !currentGroups.includes(member.group)) {
                        currentGroups.push(member.group);
                    }

                    currentGroups = currentGroups.filter(g => g !== group.name);
                    
                    const _sb = supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY);
                    const { data, error } = await _sb
                        .from('members')
                        .update({ groups: currentGroups })
                        .eq('id', member.id)
                        .select();

                    if (error) throw new Error(error.message);
                    if (!data || data.length === 0) throw new Error("Löschen blockiert (RLS oder ID falsch).");
                    
                    member.groups = currentGroups;
                    
                    this.render(document.getElementById('content'));
                    App.showToast("Entfernt", "success");
                    
                    if(Store.fetchTable) Store.fetchTable('members');
                    
                } catch (e) {
                    console.error(e);
                    App.showToast("Fehler: " + e.message, "error");
                }
            }
        }
    },

    // --- RESTLICHE TABS (Chat, Calendar, Files) ---
    
    renderTabChat(group) {
        const messages = group.chat || [];
        return `<div class="flex flex-col h-[65vh] md:h-[500px]"><div id="chat-messages" class="flex-1 overflow-y-auto space-y-4 pr-2 mb-4 custom-scrollbar">${messages.map(m => `<div class="bg-dark-bg p-2 rounded">${m.text}</div>`).join('')}</div><form onsubmit="GroupsView.sendMessage(event, '${group.id}')" class="flex gap-2"><input name="message" class="form-input" placeholder="Nachricht..."><button class="btn-primary">Senden</button></form></div>`;
    },
    async sendMessage(e, groupId) { e.preventDefault(); /* ... */ },

    renderTabCalendar(group) {
        const events = (Store.state.events||[]).filter(e => e.group === group.name);
        return `<div><h3>Termine</h3><div class="space-y-2">${events.map(e => `<div>${e.title}</div>`).join('')}</div><button onclick="GroupsView.addEvent('${group.id}')" class="btn-primary mt-4">Termin</button></div>`;
    },
    addEvent(groupId) { /* ... */ },
    async handleCalendarAdd(e, groupName) { /* ... */ },
    async deleteGroupEvent(id) { /* ... */ },
    openEventDetail(id) { /* ... */ },
    async setAttendance(id, status) { /* ... */ },

    renderTabFiles(group) {
        return `<div>Dateien (Platzhalter)</div>`;
    },
    // ... restliche Helper ...
    
    // Navigation & Helpers
    openGroup(id) { 
        const group = Store.state.groups.find(g => g.id == id);
        if(!group) return;

        // --- HIER DIE SICHERHEITSPRÜFUNG BEIM ÖFFNEN ---
        const user = App.user || (App.state && App.state.currentUser);
        const myGroupNames = user ? (Array.isArray(user.groups) ? user.groups : []) : [];
        const isMember = myGroupNames.includes(group.name);
        const canManage = App.can('manage_group_content', group.name);

        if (isMember || canManage) {
            this.state.activeGroupId = id; 
            this.state.activeTab = 'members'; 
            this.state.currentFolderId = null; 
            this.render(document.getElementById('content')); 
        } else {
            App.showToast("Du hast keinen Zugriff auf diese Gruppe.", "error");
        }
    },

    closeGroup() { this.state.activeGroupId = null; this.render(document.getElementById('content')); },
    switchTab(id) { this.state.activeTab = id; this.render(document.getElementById('content')); },
    
    async delete(id) { 
        if(!App.can('manage_groups')) return; // Hier nutzen wir das allgemeine Recht, da Löschen kritisch ist
        if(confirm("Löschen?")) { 
            await Store.remove('groups', id); 
            this.render(document.getElementById('content')); 
        } 
    },
    
    openAddModal() { 
        if(!App.can('manage_all_groups')) return; 
        App.openModal(`<div class="p-4"><h3 class="text-white mb-4">Neu</h3><form onsubmit="GroupsView.handleAdd(event)"><input name="name" class="form-input" required><button class="btn-primary mt-2">Erstellen</button></form></div>`); 
    },
    
    async handleAdd(e) { 
        e.preventDefault(); 
        const name = new FormData(e.target).get('name'); 
        await Store.add('groups', { id: Date.now(), name: name, chat: [], files: [] }); 
        App.closeModal(); 
        this.render(document.getElementById('content')); 
    },

    openEditGroupModal(groupId) { /* ... */ },
    async handleUpdateGroup(e, groupId) { /* ... */ }
};

// Global verfügbar machen
window.GroupsView = GroupsView;
