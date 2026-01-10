/**
 * =============================================================================
 * GROUPS VIEW (Hybrid: Old Design + New Security Logic + Group Calendar Fixed)
 * Features: 
 * - Gruppen-Verwaltung (RBAC)
 * - Mitglieder-Verwaltung
 * - Gruppen-Chat
 * - Gruppen-Kalender (FIX: Enddatum, Ganztägig, Abstimmung)
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

        const canManageAll = App.can('manage_all_groups'); 
        const allGroups = Store.state.groups || [];
        const currentUser = App.user || (App.state && App.state.currentUser);
        const myGroupNames = currentUser ? (Array.isArray(currentUser.groups) ? currentUser.groups : []) : [];

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
            const canManageThisGroup = App.can('manage_group_content', group.name);
            const hasAccess = isMember || canManageThisGroup;
            
            const cardStyle = hasAccess 
                ? 'cursor-pointer hover:border-blue-500/50 hover:shadow-lg hover:shadow-blue-900/10 bg-dark-card' 
                : 'cursor-not-allowed opacity-50 bg-dark-bg border-dashed grayscale-[0.8]';

            const deleteButton = canManageThisGroup 
                ? `<button onclick="event.stopPropagation(); GroupsView.delete('${group.id}')" class="text-dark-muted hover:text-red-400 p-2 rounded-lg hover:bg-red-500/10 transition-colors z-10" title="Löschen">
                    <i class="fa-regular fa-trash-can"></i>
                   </button>`
                : '';

            const lockIcon = !hasAccess ? '<i class="fa-solid fa-lock text-dark-muted mr-2"></i>' : '';
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

    // --- TAB: KALENDER (FIXED) ---
    renderTabCalendar(group) {
        const allEvents = Store.state.events || [];
        const groupEvents = allEvents
            .filter(e => e.group === group.name)
            .sort((a, b) => new Date(a.date) - new Date(b.date));

        const canManage = App.can('manage_group_content', group.name);

        const addButton = canManage 
            ? `<button onclick="GroupsView.openEventAddModal('${group.id}')" class="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg text-xs md:text-sm font-bold transition-colors shadow-lg flex items-center">
                 <i class="fa-solid fa-plus mr-2"></i> Termin anlegen
               </button>`
            : '';

        return `
            <div class="flex flex-col h-full">
                <div class="flex justify-between items-center mb-6">
                    <h3 class="text-lg font-bold text-white">Veranstaltungen</h3>
                    ${addButton}
                </div>
                
                <div class="space-y-3 flex-1 overflow-y-auto pr-1 custom-scrollbar">
                    ${groupEvents.length > 0 ? groupEvents.map(e => this.renderEventCard(e)).join('') : 
                    `<div class="text-center py-12 text-dark-muted border border-dashed border-dark-border rounded-xl bg-dark-bg/20">
                        <i class="fa-regular fa-calendar-times text-4xl mb-3 opacity-50"></i>
                        <p class="text-sm">Keine Termine in dieser Gruppe.</p>
                    </div>`}
                </div>
            </div>
        `;
    },

    renderEventCard(e) {
        const startDate = new Date(e.date);
        const endDate = e.endDate ? new Date(e.endDate) : null;
        const dateDisplayMonth = startDate.toLocaleString('de-DE', { month: 'short' });
        const dateDisplayDay = startDate.getDate();
        
        // Anzeige End-Datum wenn unterschiedlich
        let dateRangeText = '';
        if (endDate && (endDate.getDate() !== startDate.getDate() || endDate.getMonth() !== startDate.getMonth())) {
            dateRangeText = `<div class="text-[9px] mt-1 border-t border-dark-border pt-1 text-dark-muted">bis ${endDate.getDate()}.${endDate.toLocaleString('de-DE', { month: 'numeric' })}.</div>`;
        }
        
        const attendance = e.attendance || {};
        const yesCount = Object.values(attendance).filter(v => v === 'yes').length;
        const maybeCount = Object.values(attendance).filter(v => v === 'maybe').length;
        const currentUser = App.user || (App.state && App.state.currentUser);
        const myStatus = currentUser && attendance[currentUser.id] ? attendance[currentUser.id] : null;
        
        let statusBadge = '';
        if(myStatus === 'yes') statusBadge = '<span class="text-[10px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded border border-emerald-500/30 ml-2">Zugesagt</span>';
        else if(myStatus === 'maybe') statusBadge = '<span class="text-[10px] bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded border border-amber-500/30 ml-2">Vielleicht</span>';
        else if(myStatus === 'no') statusBadge = '<span class="text-[10px] bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded border border-red-500/30 ml-2">Abgesagt</span>';

        return `
            <div onclick="GroupsView.openEventDetailModal('${e.id}')" class="bg-dark-card p-4 rounded-xl border border-dark-border flex items-start gap-4 hover:border-blue-500/50 transition-all cursor-pointer group relative">
                <div class="absolute left-0 top-3 bottom-3 w-1 bg-blue-500 rounded-r-full opacity-0 group-hover:opacity-100 transition-opacity"></div>
                
                <div class="bg-dark-bg/50 border border-dark-border rounded-lg px-3 py-2 text-center min-w-[60px]">
                    <div class="text-[10px] font-bold uppercase text-blue-400">${dateDisplayMonth}</div>
                    <div class="text-xl font-bold text-white leading-none mt-0.5">${dateDisplayDay}</div>
                    ${dateRangeText}
                </div>

                <div class="flex-1 min-w-0">
                    <div class="flex justify-between items-start">
                        <h4 class="text-white font-bold text-base truncate pr-2">${e.title}</h4>
                    </div>
                    
                    <div class="flex flex-wrap gap-x-3 gap-y-1 text-xs text-dark-muted mt-1">
                        <span class="flex items-center"><i class="fa-regular fa-clock mr-1"></i> ${e.allDay ? 'Ganztägig' : e.time + ' Uhr'}</span>
                        ${e.location ? `<span class="flex items-center truncate"><i class="fa-solid fa-location-dot mr-1"></i> ${e.location}</span>` : ''}
                    </div>

                    <div class="mt-2 flex items-center gap-2 text-xs">
                        <span class="text-dark-muted"><i class="fa-solid fa-user-check text-emerald-500 mr-1"></i> ${yesCount}</span>
                        ${maybeCount > 0 ? `<span class="text-dark-muted"><i class="fa-solid fa-question text-amber-500 mr-1"></i> ${maybeCount}</span>` : ''}
                        ${statusBadge}
                    </div>
                </div>
                
                <div class="text-dark-muted group-hover:text-white transition-colors self-center">
                    <i class="fa-solid fa-chevron-right text-sm"></i>
                </div>
            </div>
        `;
    },

    // --- FIX: Add Event mit Enddatum & Ganztägig ---
    openEventAddModal(groupId) {
        const group = Store.state.groups.find(g => g.id == groupId);
        if(!group || !App.can('manage_group_content', group.name)) return;

        const html = `
            <div class="p-6 max-h-[85vh] overflow-y-auto custom-scrollbar">
                <div class="flex justify-between items-center mb-6 border-b border-dark-border pb-4">
                    <h3 class="text-xl font-bold text-white">Neuer Gruppentermin</h3>
                    <button onclick="App.closeModal()" class="text-dark-muted hover:text-white p-2 transition-colors"><i class="fa-solid fa-times text-xl"></i></button>
                </div>
                
                <form onsubmit="GroupsView.handleEventAdd(event, '${groupId}')" class="space-y-5">
                    <div>
                        <label class="text-muted text-xs uppercase font-bold">Titel</label>
                        <input type="text" name="title" required class="form-input" placeholder="z.B. Gruppentreffen">
                    </div>
                    
                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <label class="text-muted text-xs uppercase font-bold">Start Datum</label>
                            <input type="date" name="date" required class="form-input dark-date" onchange="document.getElementById('endDateInput').min = this.value; if(!document.getElementById('endDateInput').value) document.getElementById('endDateInput').value = this.value;">
                        </div>
                        <div>
                            <label class="text-muted text-xs uppercase font-bold">Ende Datum</label>
                            <input type="date" name="endDate" id="endDateInput" class="form-input dark-date">
                        </div>
                    </div>

                    <div class="grid grid-cols-2 gap-4 items-end">
                        <div>
                            <label class="text-muted text-xs uppercase font-bold">Uhrzeit</label>
                            <input type="time" name="time" id="eventTimeInput" class="form-input dark-date">
                        </div>
                        <div class="h-[42px] flex items-center bg-dark-bg border border-dark-border rounded-xl px-3">
                             <input type="checkbox" name="allDay" id="eventAllDay" class="w-4 h-4 rounded bg-dark-bg border-dark-border accent-blue-600" 
                                onchange="const t = document.getElementById('eventTimeInput'); t.disabled = this.checked; if(this.checked) t.value = ''; else t.focus();">
                             <label for="eventAllDay" class="ml-2 text-sm text-white cursor-pointer select-none">Ganztägig</label>
                        </div>
                    </div>

                    <div>
                         <label class="text-muted text-xs uppercase font-bold">Ort</label>
                         <input type="text" name="location" class="form-input" placeholder="Ort...">
                    </div>
                    
                    <div>
                        <label class="text-muted text-xs uppercase font-bold">Beschreibung / Infos</label>
                        <textarea name="description" class="form-input h-24" placeholder="Infos..."></textarea>
                    </div>

                    <button type="submit" class="btn-primary w-full mt-2">Termin erstellen</button>
                </form>
            </div>
        `;
        App.openModal(html);
    },

    handleEventAdd(e, groupId) {
        e.preventDefault();
        const group = Store.state.groups.find(g => g.id == groupId);
        const fd = new FormData(e.target);
        
        const isAllDay = fd.get('allDay') === 'on';
        let startDate = fd.get('date');
        let endDate = fd.get('endDate');
        
        // Fallback wenn kein Enddatum gesetzt
        if (!endDate) endDate = startDate;
        
        const newEvent = {
            title: fd.get('title'),
            date: startDate,
            endDate: endDate, // NEU
            time: isAllDay ? null : (fd.get('time') || '00:00'),
            allDay: isAllDay, // NEU
            location: fd.get('location'),
            description: fd.get('description'),
            group: group.name, 
            attendance: {} 
        };
        
        Store.add('events', newEvent);
        App.closeModal();
        App.showToast('Termin erstellt');
        this.render(document.getElementById('content'));
    },

    openEventDetailModal(eventId) {
        const e = Store.state.events.find(ev => ev.id == eventId);
        if(!e) return;

        const group = Store.state.groups.find(g => g.name === e.group);
        const canManage = group && App.can('manage_group_content', group.name);
        
        const d = new Date(e.date);
        const dateStr = d.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
        
        let endStr = '';
        if (e.endDate) {
            const ed = new Date(e.endDate);
            // Zeige Enddatum nur wenn es vom Startdatum abweicht
            if (ed.getTime() !== d.getTime()) {
                endStr = ' - ' + ed.toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'long' });
            }
        }

        const attendance = e.attendance || {};
        const currentUser = App.user || (App.state && App.state.currentUser);
        const myStatus = currentUser ? attendance[currentUser.id] : null;

        const members = Store.state.members || [];
        const getNamesByStatus = (status) => {
            const ids = Object.keys(attendance).filter(id => attendance[id] === status);
            return ids.map(id => {
                const m = members.find(mem => mem.id == id);
                return m ? `${m.firstName} ${m.lastName}` : 'Unbekannt';
            });
        };

        const yesNames = getNamesByStatus('yes');
        const maybeNames = getNamesByStatus('maybe');
        const noNames = getNamesByStatus('no');

        const btnClass = (active) => active 
            ? 'bg-blue-600 text-white border-blue-600 shadow-md' 
            : 'bg-dark-bg text-dark-muted border-dark-border hover:border-blue-500/50 hover:text-white';

        const deleteBtn = canManage ? 
            `<button onclick="GroupsView.deleteGroupEvent('${e.id}')" class="text-red-400 hover:text-red-300 text-xs flex items-center gap-1 bg-red-500/10 px-3 py-1.5 rounded-lg border border-red-500/20"><i class="fa-regular fa-trash-can"></i> Löschen</button>` : '';

        const html = `
            <div class="p-6 h-full flex flex-col max-h-[90vh]">
                <div class="flex justify-between items-start mb-6 border-b border-dark-border pb-4">
                    <div class="pr-4">
                        <div class="text-blue-400 text-xs font-bold uppercase tracking-wider mb-1">${dateStr} ${endStr}</div>
                        <h3 class="text-xl md:text-2xl font-bold text-white break-words">${e.title}</h3>
                        <div class="flex items-center gap-4 text-sm text-dark-muted mt-2">
                            <span><i class="fa-regular fa-clock mr-1"></i> ${e.allDay ? 'Ganztägig' : e.time + ' Uhr'}</span>
                            ${e.location ? `<span><i class="fa-solid fa-location-dot mr-1"></i> ${e.location}</span>` : ''}
                        </div>
                    </div>
                    <button onclick="App.closeModal()" class="text-dark-muted hover:text-white p-2 flex-shrink-0"><i class="fa-solid fa-times text-xl"></i></button>
                </div>
                
                <div class="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-6">
                    ${e.description ? `
                    <div class="bg-dark-bg/50 p-4 rounded-xl border border-dark-border text-sm leading-relaxed text-white whitespace-pre-wrap">
                        ${e.description}
                    </div>` : ''}

                    <!-- Abstimmung -->
                    <div>
                        <h4 class="text-xs font-bold text-dark-muted uppercase mb-3">Deine Antwort</h4>
                        <div class="grid grid-cols-3 gap-3">
                            <button onclick="GroupsView.setAttendance('${e.id}', 'yes')" class="p-3 rounded-xl border font-bold text-sm transition-all flex flex-col items-center gap-1 ${btnClass(myStatus === 'yes')}">
                                <i class="fa-solid fa-check text-lg"></i> Dabei
                            </button>
                            <button onclick="GroupsView.setAttendance('${e.id}', 'maybe')" class="p-3 rounded-xl border font-bold text-sm transition-all flex flex-col items-center gap-1 ${btnClass(myStatus === 'maybe')}">
                                <i class="fa-solid fa-question text-lg"></i> Vielleicht
                            </button>
                            <button onclick="GroupsView.setAttendance('${e.id}', 'no')" class="p-3 rounded-xl border font-bold text-sm transition-all flex flex-col items-center gap-1 ${btnClass(myStatus === 'no')}">
                                <i class="fa-solid fa-xmark text-lg"></i> Absage
                            </button>
                        </div>
                    </div>

                    <!-- Teilnehmerliste -->
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <div class="flex items-center justify-between mb-2">
                                <h4 class="text-xs font-bold text-emerald-400 uppercase">Zusagen (${yesNames.length})</h4>
                            </div>
                            <div class="bg-dark-bg p-3 rounded-xl border border-dark-border min-h-[60px] max-h-[150px] overflow-y-auto custom-scrollbar text-sm space-y-1">
                                ${yesNames.length ? yesNames.map(n => `<div class="text-white flex items-center gap-2"><div class="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>${n}</div>`).join('') : '<span class="text-dark-muted italic text-xs">Noch keine Zusagen</span>'}
                            </div>
                        </div>
                        
                        <div>
                            <div class="flex items-center justify-between mb-2">
                                <h4 class="text-xs font-bold text-red-400 uppercase">Absagen (${noNames.length})</h4>
                                ${maybeNames.length > 0 ? `<span class="text-xs text-amber-500 font-bold">${maybeNames.length} Vielleicht</span>` : ''}
                            </div>
                            <div class="bg-dark-bg p-3 rounded-xl border border-dark-border min-h-[60px] max-h-[150px] overflow-y-auto custom-scrollbar text-sm space-y-1">
                                ${noNames.length ? noNames.map(n => `<div class="text-dark-muted flex items-center gap-2"><div class="w-1.5 h-1.5 rounded-full bg-red-500"></div>${n}</div>`).join('') : '<span class="text-dark-muted italic text-xs">Keine Absagen</span>'}
                                ${maybeNames.length ? `<div class="border-t border-dark-border my-2 pt-2"></div>` + maybeNames.map(n => `<div class="text-amber-400 flex items-center gap-2"><div class="w-1.5 h-1.5 rounded-full bg-amber-500"></div>${n} (Vielleicht)</div>`).join('') : ''}
                            </div>
                        </div>
                    </div>
                </div>

                ${deleteBtn ? `<div class="mt-6 pt-4 border-t border-dark-border flex justify-end">${deleteBtn}</div>` : ''}
            </div>
        `;

        App.openModal(html);
        
        const modalContainer = document.getElementById('modal-content');
        if(modalContainer) {
            modalContainer.classList.remove('max-w-md');
            modalContainer.classList.add('max-w-2xl', 'w-full');
        }
    },

    // --- FIX: "Column 'id' can only be updated to default" ---
    // Lösung: Wir entfernen die ID aus dem Update-Payload
    async setAttendance(eventId, status) {
        const currentUser = App.user || (App.state && App.state.currentUser);
        if(!currentUser) {
            App.showToast("Fehler: User nicht identifiziert", "error");
            return;
        }

        const e = Store.state.events.find(ev => ev.id == eventId);
        if(e) {
            // Anwesenheitsobjekt klonen
            const updatedAttendance = { ...(e.attendance || {}) };
            
            // Toggle Logik
            if (updatedAttendance[currentUser.id] === status) {
                delete updatedAttendance[currentUser.id];
            } else {
                updatedAttendance[currentUser.id] = status;
            }

            // WICHTIG: Erstelle ein Update-Objekt OHNE die ID
            // Postgres mag es nicht, wenn man versucht, die ID zu updaten
            const { id, ...eventDataWithoutId } = e;
            const updatePayload = {
                ...eventDataWithoutId,
                attendance: updatedAttendance
            };

            try {
                // Direkter Supabase Aufruf für maximale Kontrolle
                const _sb = supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY);
                const { error } = await _sb.from('events').update(updatePayload).eq('id', eventId);

                if (error) throw error;

                // Lokales Objekt aktualisieren (Referenz)
                e.attendance = updatedAttendance;
                
                // UI neu laden
                this.openEventDetailModal(eventId);
                this.render(document.getElementById('content'));
            } catch(err) {
                console.error(err);
                App.showToast("Fehler beim Speichern: " + err.message, "error");
            }
        }
    },

    async deleteGroupEvent(id) {
        if(confirm("Termin wirklich löschen?")) {
            await Store.remove('events', id);
            App.closeModal();
            this.render(document.getElementById('content'));
            App.showToast('Termin gelöscht');
        }
    },

    // --- TAB: CHAT & DATEIEN ---
    
    renderTabChat(group) {
        const messages = group.chat || [];
        return `<div class="flex flex-col h-[65vh] md:h-[500px]"><div id="chat-messages" class="flex-1 overflow-y-auto space-y-4 pr-2 mb-4 custom-scrollbar">${messages.map(m => `<div class="bg-dark-bg p-2 rounded">${m.text}</div>`).join('')}</div><form onsubmit="GroupsView.sendMessage(event, '${group.id}')" class="flex gap-2"><input name="message" class="form-input" placeholder="Nachricht..."><button class="btn-primary">Senden</button></form></div>`;
    },
    async sendMessage(e, groupId) { e.preventDefault(); /* ... */ },

    renderTabFiles(group) {
        return `<div>Dateien (Platzhalter)</div>`;
    },

    // --- NAVIGATION & HELPERS ---

    openGroup(id) { 
        const group = Store.state.groups.find(g => g.id == id);
        if(!group) return;

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
        if(!App.can('manage_groups')) return; 
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
    async handleUpdateGroup(e, groupId) { /* ... */ },

    // --- MODAL: Mitglied hinzufügen ---
    openAddMemberModal(groupId) {
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

    async addMemberDirect(groupId, memberId) {
        const group = Store.state.groups.find(g => g.id == groupId);
        if (!group || !App.can('manage_group_content', group.name)) {
             App.showToast("Keine Berechtigung", "error");
             return;
        }

        const member = Store.state.members.find(m => m.id == memberId);

        if (member && group) {
            try {
                App.showToast("Speichere...", "info");
                let currentGroups = Array.isArray(member.groups) ? [...member.groups] : [];
                if (member.group && member.group !== 'Keine' && !currentGroups.includes(member.group)) {
                    currentGroups.push(member.group);
                }
                if (!currentGroups.includes(group.name)) {
                    currentGroups.push(group.name);
                }
                
                const _sb = supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY);
                const { data, error } = await _sb.from('members').update({ groups: currentGroups }).eq('id', member.id).select();

                if (error) throw new Error("DB Error: " + error.message);
                if (!data || data.length === 0) throw new Error("Update verweigert (RLS).");

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
        if (!group || !App.can('manage_group_content', group.name)) return;

        if(confirm(`Entfernen aus '${group.name}'?`)) {
            const member = Store.state.members.find(m => m.id == memberId);
            if(member) {
                try {
                    App.showToast("Entferne...", "info");
                    let currentGroups = Array.isArray(member.groups) ? [...member.groups] : [];
                    if (member.group && member.group !== 'Keine' && !currentGroups.includes(member.group)) {
                        currentGroups.push(member.group);
                    }
                    currentGroups = currentGroups.filter(g => g !== group.name);
                    
                    const _sb = supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY);
                    const { data, error } = await _sb.from('members').update({ groups: currentGroups }).eq('id', member.id).select();

                    if (error) throw new Error(error.message);
                    if (!data || data.length === 0) throw new Error("Löschen blockiert (RLS).");
                    
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
    }
};

window.GroupsView = GroupsView;
