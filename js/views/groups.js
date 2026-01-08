/**
 * =============================================================================
 * GROUPS VIEW
 * Verwaltung der Abteilungen mit Detailansicht (Chat, Cloud, Kalender)
 * =============================================================================
 */

const GroupsView = {
    // Lokaler State für die View-Steuerung
    state: {
        activeGroupId: null,
        activeTab: 'members', // 'members', 'chat', 'calendar', 'files'
        currentFolderId: null, // null = Root-Verzeichnis
        myId: 1 // Fallback
    },

    /**
     * Haupt-Render Funktion
     */
    render(container) {
        if (this.state.activeGroupId) {
            this.renderDetail(container);
        } else {
            this.renderList(container);
        }
    },

    // =========================================================================
    // 1. LISTEN-ANSICHT (Kacheln)
    // =========================================================================
    renderList(container) {
        // Zähle Mitglieder pro Gruppe
        const counts = {};
        const members = Store.state.members || [];
        
        members.forEach(m => {
            const memberGroups = Array.isArray(m.groups) ? m.groups : (m.group && m.group !== 'Keine' ? [m.group] : []);
            memberGroups.forEach(gName => {
                if (!counts[gName]) counts[gName] = 0;
                counts[gName]++;
            });
        });

        // Berechtigungen & Eigene Mitgliedschaft prüfen
        const canManage = App.can('manage_groups'); // Admin-Recht
        const currentUser = App.state.currentUser;
        
        // Eigene Gruppen laden (sicherer Zugriff)
        let myGroupNames = [];
        if (currentUser) {
            if (Array.isArray(currentUser.groups)) {
                myGroupNames = currentUser.groups;
            } else if (currentUser.group) {
                myGroupNames = [currentUser.group];
            }
        }

        // Gruppen aufteilen
        const allGroups = Store.state.groups || [];
        const myGroups = [];
        const otherGroups = [];

        allGroups.forEach(group => {
            if (myGroupNames.includes(group.name)) {
                myGroups.push(group);
            } else {
                otherGroups.push(group);
            }
        });

        // Add Button (Minimalistisch)
        const addGroupButton = canManage 
            ? `<button onclick="GroupsView.openAddModal()" class="group flex flex-col items-center justify-center p-6 rounded-2xl border border-dashed border-dark-border hover:border-blue-500/50 hover:bg-dark-hover/30 transition-all min-h-[140px]">
                <div class="w-10 h-10 rounded-full bg-dark-bg border border-dark-border flex items-center justify-center text-dark-muted group-hover:text-blue-500 group-hover:border-blue-500/50 mb-3 transition-colors">
                    <i class="fa-solid fa-plus"></i>
                </div>
                <span class="text-sm font-medium text-dark-muted group-hover:text-blue-400">Neue Abteilung</span>
               </button>`
            : '';

        // Helper für Card-HTML
        const renderGroupCard = (group, isMember) => {
            const count = counts[group.name] || 0;
            const hasAccess = isMember || canManage;
            
            const cardStyle = hasAccess 
                ? 'cursor-pointer hover:border-blue-500/50 hover:shadow-lg hover:shadow-blue-900/10 bg-dark-card' 
                : 'cursor-not-allowed opacity-50 bg-dark-bg border-dashed';

            const deleteButton = canManage 
                ? `<button onclick="event.stopPropagation(); GroupsView.delete(${group.id})" class="text-dark-muted hover:text-red-400 p-2 rounded-lg hover:bg-red-500/10 transition-colors" title="Löschen">
                    <i class="fa-regular fa-trash-can"></i>
                   </button>`
                : '';

            const lockIcon = !hasAccess ? '<i class="fa-solid fa-lock text-dark-muted mr-2"></i>' : '';

            return `
            <div onclick="${hasAccess ? `GroupsView.openGroup(${group.id})` : `App.showToast('Kein Zugriff')`}" 
                 class="p-5 rounded-2xl border border-dark-border transition-all flex flex-col justify-between min-h-[140px] ${cardStyle}">
                
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
                    ${hasAccess ? `<i class="fa-solid fa-arrow-right text-dark-muted opacity-50"></i>` : ''}
                </div>
            </div>
            `;
        };

        container.innerHTML = `
            <!-- Sektion: Meine Gruppen -->
            <div class="mb-8">
                <div class="flex items-center gap-2 mb-4 px-1">
                    <h3 class="text-lg font-bold text-white">Meine Gruppen</h3>
                    <span class="bg-blue-500/10 text-blue-400 text-xs font-bold px-2 py-0.5 rounded-md border border-blue-500/20">${myGroups.length}</span>
                </div>
                
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 fade-in">
                    ${myGroups.map(g => renderGroupCard(g, true)).join('')}
                    ${addGroupButton}
                </div>
            </div>

            <!-- Sektion: Weitere Gruppen (nur wenn vorhanden) -->
            ${otherGroups.length > 0 ? `
            <div class="mb-8 pt-6 border-t border-dark-border/50">
                <h3 class="text-sm font-bold text-dark-muted uppercase tracking-wider mb-4 px-1">Weitere Gruppen</h3>
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 fade-in opacity-80">
                    ${otherGroups.map(g => renderGroupCard(g, false)).join('')}
                </div>
            </div>
            ` : ''}
        `;
    },

    // =========================================================================
    // 2. DETAIL-ANSICHT (Tabs)
    // =========================================================================
    renderDetail(container) {
        const group = Store.state.groups ? Store.state.groups.find(g => g.id === this.state.activeGroupId) : null;
        if (!group) { this.closeGroup(); return; }

        if (!group.chat) group.chat = [];
        if (!group.files) group.files = []; 

        const canManage = App.can('manage_groups');
        const editButton = canManage
            ? `<button onclick="GroupsView.openEditGroupModal(${group.id})" class="w-10 h-10 rounded-full bg-dark-bg border border-dark-border text-dark-muted hover:text-blue-400 hover:border-blue-500/50 flex items-center justify-center transition-all flex-shrink-0" title="Gruppe bearbeiten"><i class="fa-solid fa-pen"></i></button>`
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

                <!-- Tabs -->
                <div class="flex gap-2 mb-4 md:mb-6 overflow-x-auto pb-2 border-b border-dark-border/50 no-scrollbar">
                    ${tabs.map(tab => `
                        <button onclick="GroupsView.switchTab('${tab.id}')" 
                            class="px-3 md:px-4 py-2 rounded-xl text-xs md:text-sm font-bold flex items-center transition-all whitespace-nowrap flex-shrink-0
                            ${this.state.activeTab === tab.id 
                                ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' 
                                : 'bg-transparent text-dark-muted hover:bg-dark-hover hover:text-white'}">
                            <i class="fa-solid ${tab.icon} mr-2"></i> ${tab.label}
                        </button>
                    `).join('')}
                </div>

                <!-- Content Area -->
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

    // --- TAB 1: MITGLIEDER ---
    renderTabMembers(group) {
        const members = (Store.state.members || []).filter(m => {
            if (Array.isArray(m.groups) && m.groups.includes(group.name)) return true;
            if (m.group === group.name) return true;
            return false;
        });

        const canManage = App.can('manage_groups');
        const addButton = canManage 
            ? `<button onclick="GroupsView.openAddMemberModal(${group.id})" class="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg text-xs font-bold transition-colors flex items-center shadow-lg shadow-blue-900/20 whitespace-nowrap">
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
                                            <div class="min-w-0">
                                                <span class="font-medium block truncate">${m.firstName} ${m.lastName}</span>
                                                <span class="text-xs text-dark-muted sm:hidden">${m.role}</span>
                                            </div>
                                        </td>
                                        <td class="p-4 text-dark-muted hidden sm:table-cell">${m.role}</td>
                                        <td class="p-4 text-right">
                                            ${canManage ? `<button onclick="GroupsView.removeMemberFromGroup(${m.id})" class="text-dark-muted hover:text-red-400 md:opacity-0 group-hover/row:opacity-100 transition-opacity p-2 bg-dark-bg md:bg-transparent rounded-lg" title="Entfernen"><i class="fa-solid fa-user-minus"></i></button>` : ''}
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

    openAddMemberModal(groupId) {
        if(!App.can('manage_groups')) return;
        const group = Store.state.groups.find(g => g.id === groupId);
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
                                <div class="w-8 h-8 rounded-full bg-slate-700 text-slate-300 flex items-center justify-center text-xs font-bold flex-shrink-0">
                                    ${m.firstName.charAt(0)}${m.lastName.charAt(0)}
                                </div>
                                <div class="overflow-hidden">
                                    <p class="text-sm font-bold text-white member-name truncate">${m.firstName} ${m.lastName}</p>
                                </div>
                            </div>
                            <button onclick="GroupsView.addMemberDirect(${groupId}, ${m.id})" class="bg-blue-600 hover:bg-blue-700 text-white p-2 rounded-lg text-xs transition-colors shadow-lg shadow-blue-900/20 flex-shrink-0">
                                <i class="fa-solid fa-plus"></i>
                            </button>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
        App.openModal(html);
    },

    filterMemberSelect(input) {
        const filter = input.value.toLowerCase();
        const items = document.querySelectorAll('#member-select-list .member-item');
        items.forEach(item => {
            const name = item.querySelector('.member-name').textContent.toLowerCase();
            if(name.includes(filter)) {
                item.classList.remove('hidden');
                item.classList.add('flex');
            } else {
                item.classList.add('hidden');
                item.classList.remove('flex');
            }
        });
    },

    // --- FIX: Async & Await für sicheres Speichern & Error Handling ---
    async addMemberDirect(groupId, memberId) {
        if(!App.can('manage_groups')) return;
        const group = Store.state.groups.find(g => g.id === groupId);
        const member = Store.state.members.find(m => m.id === memberId);

        if (member && group) {
            try {
                // Arrays initialisieren falls nötig
                if (!Array.isArray(member.groups)) {
                    member.groups = [];
                    if (member.group && member.group !== 'Keine') member.groups.push(member.group);
                }
                // Doppelte Einträge verhindern
                if (!member.groups.includes(group.name)) {
                    member.groups.push(group.name);
                }
                
                // Aufräumen alter Felder
                member.group = null; // Falls Spalte existiert, leeren
                
                // WICHTIG: Await nutzen, damit die Aktion abgeschlossen wird
                await Store.update('members', member);
                
                // Sicherheitshalber neu laden
                if(Store.fetchTable) await Store.fetchTable('members');

                App.closeModal();
                App.showToast(`${member.firstName} hinzugefügt`);
                this.render(document.getElementById('content'));
            } catch (e) {
                console.error(e);
                App.showToast("Fehler beim Speichern: " + e.message, "error");
            }
        }
    },

    async removeMemberFromGroup(memberId) {
        if(!App.can('manage_groups')) return;
        const group = Store.state.groups.find(g => g.id === this.state.activeGroupId);
        if (!group) return;

        if(confirm(`Entfernen aus '${group.name}'?`)) {
            const member = Store.state.members.find(m => m.id === memberId);
            if(member) {
                try {
                    if (Array.isArray(member.groups)) {
                        member.groups = member.groups.filter(g => g !== group.name);
                    } else if (member.group === group.name) {
                        member.group = 'Keine';
                    }
                    
                    await Store.update('members', member);
                    if(Store.fetchTable) await Store.fetchTable('members');
                    
                    this.render(document.getElementById('content'));
                    App.showToast("Entfernt");
                } catch (e) {
                    console.error(e);
                    App.showToast("Fehler beim Entfernen: " + e.message, "error");
                }
            }
        }
    },

    // --- TAB 2: CHAT ---
    renderTabChat(group) {
        const messages = group.chat || [];
        return `
            <div class="flex flex-col h-[65vh] md:h-[500px]">
                <div id="chat-messages" class="flex-1 overflow-y-auto space-y-4 pr-2 mb-4 custom-scrollbar">
                    ${messages.length === 0 ? '<div class="text-center text-dark-muted text-sm mt-10">Schreibe die erste Nachricht...</div>' : ''}
                    ${messages.map(msg => `
                        <div class="flex flex-col ${msg.isMe ? 'items-end' : 'items-start'}">
                            <div class="flex items-end gap-2 max-w-[85%] md:max-w-[80%]">
                                ${!msg.isMe ? `<div class="w-6 h-6 rounded-full bg-indigo-500/20 text-indigo-400 text-xs flex items-center justify-center border border-indigo-500/30 font-bold flex-shrink-0">${msg.sender.charAt(0)}</div>` : ''}
                                <div class="px-4 py-2 rounded-2xl text-sm ${msg.isMe ? 'bg-blue-600 text-white rounded-br-none' : 'bg-dark-hover text-dark-text rounded-bl-none'}">
                                    ${msg.text}
                                </div>
                            </div>
                            <span class="text-[10px] text-dark-muted mt-1 px-1">${new Date(msg.time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                        </div>
                    `).join('')}
                </div>
                <form onsubmit="GroupsView.sendMessage(event, ${group.id})" class="flex gap-2 mt-auto pt-4 border-t border-dark-border">
                    <input type="text" name="message" placeholder="Nachricht..." autocomplete="off"
                        class="flex-1 bg-dark-bg border border-dark-border rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-colors shadow-inner">
                    <button type="submit" class="bg-blue-600 hover:bg-blue-700 text-white px-4 rounded-xl transition-colors shadow-lg">
                        <i class="fa-solid fa-paper-plane"></i>
                    </button>
                </form>
            </div>
        `;
    },

    async sendMessage(e, groupId) {
        e.preventDefault();
        const input = e.target.elements.message;
        const text = input.value.trim();
        if (!text) return;

        const group = Store.state.groups.find(g => g.id === groupId);
        if (group) {
            if(!group.chat) group.chat = [];
            group.chat.push({
                id: Date.now(),
                text: text,
                sender: 'Ich',
                isMe: true,
                time: new Date().toISOString()
            });
            
            await Store.update('groups', group);
            
            this.render(document.getElementById('content'));
            input.focus();
        }
    },

    // --- TAB 3: KALENDER ---
    renderTabCalendar(group) {
        const events = (Store.state.events || []).filter(e => 
            e.group === group.name || 
            (!e.group && e.title.includes(group.name))
        ).sort((a,b) => new Date(a.date) - new Date(b.date));

        const canManage = App.can('manage_groups');
        const addButton = canManage
            ? `<button onclick="GroupsView.addEvent(${group.id})" class="text-xs bg-slate-700 hover:bg-slate-600 text-white px-3 py-2 rounded-lg transition-colors flex items-center">
                <i class="fa-solid fa-plus mr-1"></i> Termin
               </button>`
            : '';

        return `
            <div class="flex justify-between items-center mb-6">
                <h3 class="font-bold text-white">Termine</h3>
                ${addButton}
            </div>

            <div class="space-y-3">
                ${events.length === 0 ? '<p class="text-dark-muted text-sm italic text-center py-4">Keine Termine.</p>' : ''}
                ${events.map(e => {
                    const attendance = e.attendance || {};
                    const acceptedCount = Object.values(attendance).filter(v => v === 'accepted').length;
                    const declinedCount = Object.values(attendance).filter(v => v === 'declined').length;
                    
                    const deleteButton = canManage 
                        ? `<button onclick="event.stopPropagation(); GroupsView.deleteGroupEvent(${e.id})" class="text-dark-muted hover:text-red-400 md:opacity-0 group-hover/event:opacity-100 transition-opacity p-2 bg-dark-card md:bg-transparent rounded-lg"><i class="fa-regular fa-trash-can"></i></button>`
                        : '';
                    
                    return `
                    <div onclick="GroupsView.openEventDetail(${e.id})" class="bg-dark-bg p-4 rounded-xl border border-dark-border flex items-center gap-4 cursor-pointer hover:border-blue-500/50 transition-all group/event">
                        <div class="text-center bg-dark-card rounded-lg p-2 min-w-[50px] border border-dark-border flex-shrink-0">
                            <div class="text-[10px] text-blue-400 font-bold uppercase">${new Date(e.date).toLocaleString('de-DE', {month:'short'})}</div>
                            <div class="text-xl font-bold text-white leading-none">${new Date(e.date).getDate()}</div>
                        </div>
                        <div class="flex-1 min-w-0">
                            <h4 class="text-white font-bold group-hover/event:text-blue-400 transition-colors truncate">${e.title}</h4>
                            <div class="flex flex-wrap gap-x-4 gap-y-1 text-xs text-dark-muted mt-1">
                                <span><i class="fa-regular fa-clock mr-1"></i> ${e.allDay ? 'Ganztägig' : e.time + ' Uhr'}</span>
                                ${e.location ? `<span class="truncate"><i class="fa-solid fa-location-dot mr-1"></i> ${e.location}</span>` : ''}
                            </div>
                            <div class="flex gap-2 mt-2">
                                ${acceptedCount > 0 ? `<span class="px-2 py-0.5 rounded text-[10px] bg-green-500/10 text-green-400 border border-green-500/20"><i class="fa-solid fa-check mr-1"></i> ${acceptedCount}</span>` : ''}
                                ${declinedCount > 0 ? `<span class="px-2 py-0.5 rounded text-[10px] bg-red-500/10 text-red-400 border border-red-500/20"><i class="fa-solid fa-xmark mr-1"></i> ${declinedCount}</span>` : ''}
                                ${acceptedCount === 0 && declinedCount === 0 ? `<span class="text-[10px] text-dark-muted opacity-50">Keine Rückmeldungen</span>` : ''}
                            </div>
                        </div>
                        <div class="flex gap-2">
                            ${canManage ? `<button onclick="event.stopPropagation(); GroupsView.openEditEventModal(${e.id})" class="text-dark-muted hover:text-blue-400 md:opacity-0 group-hover/event:opacity-100 transition-opacity p-2 bg-dark-card md:bg-transparent rounded-lg"><i class="fa-solid fa-pen"></i></button>` : ''}
                            ${deleteButton}
                        </div>
                    </div>
                `}).join('')}
            </div>
        `;
    },

    openEventDetail(eventId) {
        const e = Store.state.events.find(ev => ev.id === eventId);
        if(!e) return;

        if(!e.attendance) e.attendance = {};
        const myStatus = e.attendance[App.state.currentUser ? App.state.currentUser.id : 1];
        
        const acceptedMembers = [];
        Store.state.members.forEach(m => { if(e.attendance[m.id] === 'accepted') acceptedMembers.push(m); });
        const declinedMembers = [];
        Store.state.members.forEach(m => { if(e.attendance[m.id] === 'declined') declinedMembers.push(m); });
        
        const renderMemberList = (list, color) => {
            if(list.length === 0) return `<p class="text-xs text-dark-muted italic">Niemand</p>`;
            return list.map(m => `<span class="inline-block px-2 py-1 bg-${color}-500/10 text-${color}-400 text-xs rounded border border-${color}-500/20 mb-1 mr-1">${m.firstName}</span>`).join('');
        };

        const canManage = App.can('manage_groups');
        const editButton = canManage
            ? `<div class="mt-4 pt-4 border-t border-dark-border">
                <button onclick="GroupsView.openEditEventModal(${e.id})" class="w-full bg-slate-700 hover:bg-slate-600 text-white py-3 rounded-xl font-bold transition-colors">
                    Bearbeiten
                </button>
               </div>`
            : '';

        const html = `
            <div class="p-4 md:p-8 h-full flex flex-col">
                <div class="flex justify-between items-start mb-6 border-b border-dark-border pb-4">
                    <h3 class="text-xl md:text-2xl font-bold text-white break-words pr-2">${e.title}</h3>
                    <button onclick="App.closeModal()" class="text-dark-muted hover:text-white p-2"><i class="fa-solid fa-times text-xl"></i></button>
                </div>

                <div class="flex-1 overflow-y-auto custom-scrollbar pr-2">
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                        <div class="bg-dark-bg p-3 rounded-lg border border-dark-border">
                            <span class="text-xs text-dark-muted block">Wann?</span>
                            <span class="text-sm text-white font-bold">
                                ${new Date(e.date).toLocaleDateString('de-DE')} 
                                ${e.allDay ? '' : ', ' + e.time + ' Uhr'}
                            </span>
                        </div>
                        ${e.location ? `
                        <div class="bg-dark-bg p-3 rounded-lg border border-dark-border">
                            <span class="text-xs text-dark-muted block">Wo?</span>
                            <span class="text-sm text-white font-bold">${e.location}</span>
                        </div>` : ''}
                    </div>

                    ${e.comment ? `<div class="bg-dark-bg/50 p-4 rounded-xl border border-dark-border mb-6 text-sm text-dark-muted italic">"${e.comment}"</div>` : ''}

                    <h4 class="text-sm font-bold text-white uppercase tracking-wider mb-3 border-b border-dark-border pb-2">Deine Antwort</h4>
                    <div class="flex gap-2 mb-6">
                        <button onclick="GroupsView.setAttendance(${e.id}, 'accepted')" class="flex-1 py-3 rounded-xl font-bold border transition-all text-sm ${myStatus === 'accepted' ? 'bg-green-600 text-white border-green-500' : 'bg-dark-bg text-dark-muted border-dark-border'}">
                            <i class="fa-solid fa-check"></i> Ja
                        </button>
                        <button onclick="GroupsView.setAttendance(${e.id}, 'declined')" class="flex-1 py-3 rounded-xl font-bold border transition-all text-sm ${myStatus === 'declined' ? 'bg-red-600 text-white border-red-500' : 'bg-dark-bg text-dark-muted border-dark-border'}">
                            <i class="fa-solid fa-xmark"></i> Nein
                        </button>
                        <button onclick="GroupsView.setAttendance(${e.id}, 'maybe')" class="flex-1 py-3 rounded-xl font-bold border transition-all text-sm ${myStatus === 'maybe' ? 'bg-yellow-600 text-white border-yellow-500' : 'bg-dark-bg text-dark-muted border-dark-border'}">
                            <i class="fa-solid fa-question"></i> Vlt
                        </button>
                    </div>

                    <h4 class="text-sm font-bold text-white uppercase tracking-wider mb-3 border-b border-dark-border pb-2">Zusagen</h4>
                    <div>${renderMemberList(acceptedMembers, 'green')}</div>
                    
                    <h4 class="text-sm font-bold text-white uppercase tracking-wider mb-3 border-b border-dark-border pb-2 mt-4">Absagen</h4>
                    <div>${renderMemberList(declinedMembers, 'red')}</div>
                </div>

                ${editButton}
            </div>
        `;
        App.openModal(html);
        
        const modalContainer = document.getElementById('modal-content');
        if(modalContainer) {
            modalContainer.classList.remove('max-w-md');
            modalContainer.classList.add('max-w-lg', 'w-full');
        }
    },

    async setAttendance(eventId, status) {
        const e = Store.state.events.find(ev => ev.id === eventId);
        if(e) {
            if(!e.attendance) e.attendance = {};
            const myId = App.state.currentUser ? App.state.currentUser.id : 1;
            if (e.attendance[myId] === status) delete e.attendance[myId];
            else e.attendance[myId] = status;
            
            await Store.update('events', e);
            
            this.openEventDetail(eventId);
            this.render(document.getElementById('content'));
        }
    },

    addEvent(groupId) {
        if(!App.can('manage_groups')) return;
        const group = Store.state.groups.find(g => g.id === groupId);
        
        const html = `
            <div class="p-4 md:p-8">
                <div class="flex justify-between items-center mb-6 border-b border-dark-border pb-4">
                    <h3 class="text-xl font-bold text-white">Termin</h3>
                    <button onclick="App.closeModal()" class="text-dark-muted hover:text-white p-2"><i class="fa-solid fa-times text-xl"></i></button>
                </div>
                <form onsubmit="GroupsView.handleCalendarAdd(event, '${group.name}')" class="space-y-4">
                    <div><label class="text-muted">Titel</label><input type="text" name="title" required class="form-input"></div>
                    <div class="grid grid-cols-2 gap-4"><div><label class="text-muted">Datum</label><input type="date" name="date" required class="form-input dark-date"></div><div><label class="text-muted">Zeit</label><input type="time" name="time" id="grpEventTime" required class="form-input dark-date"></div></div>
                    <div><label class="text-muted">Ort</label><input type="text" name="location" class="form-input"></div>
                    <button type="submit" class="btn-primary w-full mt-2">Erstellen</button>
                </form>
            </div>`;
        App.openModal(html);
    },

    openEditEventModal(eventId) {
        if(!App.can('manage_groups')) return;
        const e = Store.state.events.find(ev => ev.id === eventId);
        if(!e) return;
        
        const timeValue = e.time || '';
        const allDayChecked = e.allDay ? 'checked' : '';
        const timeDisabled = e.allDay ? 'disabled' : '';

        const html = `<div class="p-4 md:p-8"><div class="flex justify-between items-center mb-6 border-b border-dark-border pb-4"><h3 class="text-xl font-bold text-white">Bearbeiten</h3><button onclick="App.closeModal()" class="text-dark-muted hover:text-white p-2"><i class="fa-solid fa-times text-xl"></i></button></div><form onsubmit="GroupsView.handleUpdateEvent(event, ${eventId})" class="space-y-4"><div><label class="text-muted">Titel</label><input type="text" name="title" value="${e.title}" required class="form-input"></div><div class="grid grid-cols-2 gap-4"><div><label class="text-muted">Datum</label><input type="date" name="date" value="${e.date}" required class="form-input dark-date"></div><div><label class="text-muted">Zeit</label><input type="time" name="time" id="editGrpEventTime" value="${timeValue}" ${timeDisabled} required class="form-input dark-date"></div></div><div class="flex items-center mt-2"><input type="checkbox" name="allDay" id="editGrpAllDay" ${allDayChecked} class="w-4 h-4 rounded bg-dark-bg border-dark-border accent-blue-600" onchange="const t = document.getElementById('editGrpEventTime'); t.disabled = this.checked; if(this.checked) t.value = ''; else t.focus(); t.required = !this.checked;"><label for="editGrpAllDay" class="ml-2 text-xs text-dark-muted cursor-pointer select-none">Ganztägig</label></div><div><label class="text-muted">Ort</label><input type="text" name="location" value="${e.location || ''}" class="form-input"></div><button type="submit" class="btn-primary w-full mt-4">Speichern</button></form></div>`;
        App.openModal(html);
    },

    async handleUpdateEvent(e, eventId) {
        e.preventDefault();
        const fd = new FormData(e.target);
        const isAllDay = fd.get('allDay') === 'on';

        const index = Store.state.events.findIndex(ev => ev.id === eventId);
        if(index !== -1) {
            const updatedEvent = {
                ...Store.state.events[index],
                title: fd.get('title'),
                date: fd.get('date'),
                time: isAllDay ? null : fd.get('time'),
                allDay: isAllDay,
                location: fd.get('location')
            };
            
            await Store.update('events', updatedEvent);
            
            App.closeModal();
            this.render(document.getElementById('content'));
            App.showToast("Termin aktualisiert");
        }
    },

    async handleCalendarAdd(e, groupName) {
        e.preventDefault();
        const fd = new FormData(e.target);
        const isAllDay = fd.get('allDay') === 'on';

        await Store.add('events', { id: Date.now(), title: fd.get('title'), date: fd.get('date'), time: isAllDay ? null : fd.get('time'), allDay: isAllDay, location: fd.get('location'), comment: fd.get('comment'), group: groupName, attendance: {} });
        App.closeModal();
        this.render(document.getElementById('content'));
    },

    async deleteGroupEvent(id) {
        if(!App.can('manage_groups')) return;
        if(confirm("Löschen?")) { 
            await Store.remove('events', id); 
            this.render(document.getElementById('content')); 
        }
    },

    // --- TAB 4: CLOUD / DATEIEN ---
    renderTabFiles(group) {
        const canManage = App.can('manage_groups');
        const currentFolderId = this.state.currentFolderId;
        const allFiles = group.files || [];
        const contents = allFiles.filter(f => f.parentId === currentFolderId);
        
        let breadcrumbs = [{id: null, name: 'Home'}]; 
        let tempId = currentFolderId;
        while(tempId) { const f = allFiles.find(fo => fo.id === tempId); if(f) { breadcrumbs.unshift({id:f.id,name:f.name}); tempId=f.parentId; } else tempId=null; }

        const actions = canManage ? `<div class="flex gap-2"><button onclick="GroupsView.createFolder(${group.id})" class="bg-dark-bg hover:bg-dark-hover text-white px-3 py-2 rounded-lg text-xs border border-dark-border transition-colors"><i class="fa-solid fa-folder-plus mr-1"></i></button><button onclick="GroupsView.uploadFile(${group.id})" class="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg text-xs transition-colors"><i class="fa-solid fa-cloud-arrow-up"></i></button></div>` : '';

        return `<div class="flex flex-col h-full"><div class="flex justify-between items-center mb-4 pb-4 border-b border-dark-border"><div class="flex items-center text-sm text-dark-muted overflow-x-auto whitespace-nowrap"><i class="fa-solid fa-cloud mr-2 text-blue-400"></i>${breadcrumbs.map((b,i)=>`<span onclick="GroupsView.openFolder(${b.id === null ? 'null' : b.id})" class="cursor-pointer hover:text-white hover:underline">${b.name}</span>${i<breadcrumbs.length-1?'<i class="fa-solid fa-chevron-right text-[10px] mx-2"></i>':''}`).join('')}</div>${actions}</div><div class="grid grid-cols-2 sm:grid-cols-3 gap-3 md:gap-4">${contents.map(item => {
            const isFolder=item.type==='folder'; const icon=isFolder?'fa-folder text-yellow-400':'fa-file-lines text-blue-400'; const click=isFolder?`onclick="GroupsView.openFolder(${item.id})"`:'';
            const del = canManage ? `<button onclick="event.stopPropagation(); GroupsView.deleteFile(${group.id}, ${item.id})" class="absolute top-1 right-1 text-dark-muted hover:text-red-400 opacity-0 group-hover:opacity-100 p-1"><i class="fa-solid fa-xmark"></i></button>` : '';
            return `<div ${click} class="group relative flex flex-col items-center p-3 rounded-xl hover:bg-dark-bg border border-transparent hover:border-dark-border transition-all cursor-pointer bg-dark-bg/20">${del}<i class="fa-solid ${icon} text-3xl md:text-4xl mb-2 drop-shadow-lg"></i><span class="text-xs text-center text-dark-text truncate w-full px-1">${item.name}</span></div>`;
        }).join('')}</div></div>`;
    },

    openFolder(folderId) { this.state.currentFolderId = folderId; this.render(document.getElementById('content')); },
    
    async createFolder(groupId) { 
        if(!App.can('manage_groups')) return; 
        const name = prompt("Name des Ordners:"); 
        if (name) { 
            const group = Store.state.groups.find(g => g.id === groupId); 
            if(!group.files) group.files = [];
            group.files.push({ id: Date.now(), parentId: this.state.currentFolderId, name: name, type: 'folder' }); 
            await Store.update('groups', group); 
            this.render(document.getElementById('content')); 
        } 
    },
    
    async uploadFile(groupId) { 
        if(!App.can('manage_groups')) return; 
        const name = prompt("Dateiname:"); 
        if (name) { 
            const group = Store.state.groups.find(g => g.id === groupId); 
            if(!group.files) group.files = [];
            group.files.push({ id: Date.now(), parentId: this.state.currentFolderId, name: name, type: 'file' }); 
            await Store.update('groups', group); 
            this.render(document.getElementById('content')); 
        } 
    },
    
    async deleteFile(groupId, itemId) { 
        if(!App.can('manage_groups')) return; 
        if(!confirm("Löschen?")) return; 
        const group = Store.state.groups.find(g => g.id === groupId); 
        group.files = group.files.filter(f => f.id !== itemId); 
        await Store.update('groups', group); 
        this.render(document.getElementById('content')); 
    },

    // Navigation & Helpers
    openGroup(id) { this.state.activeGroupId = id; this.state.activeTab = 'members'; this.state.currentFolderId = null; this.render(document.getElementById('content')); },
    closeGroup() { this.state.activeGroupId = null; this.render(document.getElementById('content')); },
    switchTab(id) { this.state.activeTab = id; this.render(document.getElementById('content')); },
    
    async delete(id) { 
        if(!App.can('manage_groups')) return; 
        if(confirm("Löschen?")) { 
            await Store.remove('groups', id); 
            this.render(document.getElementById('content')); 
        } 
    },
    
    openAddModal() { if(!App.can('manage_groups')) return; App.openModal(`<div class="p-4"><div class="flex justify-between items-center mb-6"><h3 class="text-xl font-bold text-white">Neu</h3><button onclick="App.closeModal()"><i class="fa-solid fa-times text-xl"></i></button></div><form onsubmit="GroupsView.handleAdd(event)" class="space-y-4"><div><label class="text-muted">Name</label><input type="text" name="name" required class="form-input"></div><button type="submit" class="btn-green w-full">Erstellen</button></form></div>`); },
    
    async handleAdd(e) { 
        e.preventDefault(); 
        const name = new FormData(e.target).get('name'); 
        await Store.add('groups', { id: Date.now(), name: name, chat: [], files: [] }); 
        App.closeModal(); 
        this.render(document.getElementById('content')); 
    },

    openEditGroupModal(groupId) { if(!App.can('manage_groups')) return; const group = Store.state.groups.find(g => g.id === groupId); App.openModal(`<div class="p-4"><div class="flex justify-between items-center mb-6"><h3 class="text-xl font-bold text-white">Bearbeiten</h3><button onclick="App.closeModal()"><i class="fa-solid fa-times text-xl"></i></button></div><form onsubmit="GroupsView.handleUpdateGroup(event, ${groupId})" class="space-y-4"><div><label class="text-muted">Name</label><input type="text" name="name" value="${group.name}" required class="form-input"></div><button type="submit" class="btn-primary w-full">Speichern</button></form></div>`); },
    
    async handleUpdateGroup(e, groupId) { 
        e.preventDefault(); 
        const name = new FormData(e.target).get('name'); 
        const group = Store.state.groups.find(g => g.id === groupId); 
        if(group) { 
            group.name = name; 
            await Store.update('groups', group); 
            App.closeModal(); 
            this.render(document.getElementById('content')); 
        } 
    }
};

// WICHTIG: Global verfügbar machen für die neue App.js
window.GroupsView = GroupsView;
