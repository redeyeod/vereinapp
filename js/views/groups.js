/**
 * =============================================================================
 * GROUPS VIEW (Clean & Mobile First)
 * Modernes Design für Gruppen, Chat und Kalender.
 * =============================================================================
 */

const GroupsView = {
    state: {
        activeGroupId: null,
        activeTab: 'members', 
        currentFolderId: null
    },

    render(container) {
        if (!container) return;

        if (this.state.activeGroupId) {
            this.renderDetail(container);
        } else {
            this.renderList(container);
        }
    },

    // -------------------------------------------------------------------------
    // LISTEN-ANSICHT (GRID)
    // -------------------------------------------------------------------------
    renderList(container) {
        const members = (Store.state && Store.state.members) ? Store.state.members : [];
        const groups = (Store.state && Store.state.groups) ? Store.state.groups : [];
        
        const counts = {};
        members.forEach(m => {
            const memberGroups = Array.isArray(m.groups) ? m.groups : [];
            if (m.group && m.group !== 'Keine' && !memberGroups.includes(m.group)) {
                memberGroups.push(m.group);
            }
            memberGroups.forEach(gName => {
                counts[gName] = (counts[gName] || 0) + 1;
            });
        });

        const canManageAll = App.can('manage_all_groups'); 
        const currentUser = App.state.currentUser;
        
        let myGroupNames = [];
        if (currentUser && Array.isArray(currentUser.groups)) {
            myGroupNames = currentUser.groups;
        }

        const myGroups = groups.filter(g => myGroupNames.includes(g.name));
        const otherGroups = groups.filter(g => !myGroupNames.includes(g.name));

        const addButtonHtml = canManageAll 
            ? `<button onclick="GroupsView.openAddModal()" class="w-full bg-dark-card hover:bg-dark-hover border border-dashed border-dark-border hover:border-brand-500/50 rounded-2xl p-6 flex flex-col items-center justify-center gap-3 transition-all group min-h-[160px]">
                <div class="w-12 h-12 rounded-full bg-dark-bg border border-dark-border flex items-center justify-center text-dark-muted group-hover:text-brand-500 group-hover:border-brand-500/50 transition-colors">
                    <i class="fa-solid fa-plus text-xl"></i>
                </div>
                <span class="text-sm font-bold text-dark-muted group-hover:text-white">Neue Abteilung</span>
               </button>`
            : '';

        const renderCard = (group, isMyGroup) => {
            const count = counts[group.name] || 0;
            const canManage = App.can('manage_group_content', group.name);
            const hasAccess = isMyGroup || canManage || App.can('admin_global');
            
            const baseClass = "relative flex flex-col justify-between p-5 rounded-2xl border transition-all min-h-[160px] group overflow-hidden";
            const stateClass = hasAccess 
                ? "bg-dark-card border-dark-border hover:border-brand-500/50 hover:shadow-lg cursor-pointer" 
                : "bg-dark-bg/50 border-dark-border/50 opacity-60 cursor-not-allowed";
            
            const iconColor = hasAccess ? "text-brand-500 bg-brand-500/10" : "text-dark-muted bg-dark-bg";
            const clickAction = hasAccess ? `onclick="GroupsView.openGroup('${group.id}')"` : `onclick="App.showToast('Kein Zugriff', 'error')"`;

            return `
            <div ${clickAction} class="${baseClass} ${stateClass}">
                <div class="flex justify-between items-start z-10">
                    <div class="w-10 h-10 rounded-xl ${iconColor} flex items-center justify-center border border-white/5">
                        <i class="fa-solid ${hasAccess ? 'fa-layer-group' : 'fa-lock'}"></i>
                    </div>
                    ${canManage ? `
                    <button onclick="event.stopPropagation(); GroupsView.delete('${group.id}')" class="w-8 h-8 rounded-lg hover:bg-red-500/10 text-dark-muted hover:text-red-400 flex items-center justify-center transition-colors">
                        <i class="fa-regular fa-trash-can"></i>
                    </button>` : ''}
                </div>
                
                <div class="z-10 mt-4">
                    <h3 class="text-lg font-bold text-white leading-tight mb-1 truncate">${group.name}</h3>
                    <p class="text-xs text-dark-muted font-medium">${count} Mitglieder</p>
                </div>

                ${hasAccess ? `<div class="absolute bottom-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity transform translate-y-2 group-hover:translate-y-0 text-brand-500"><i class="fa-solid fa-arrow-right"></i></div>` : ''}
            </div>`;
        };

        container.innerHTML = `
            <div class="fade-in space-y-8 pb-20">
                <div class="flex items-center justify-between">
                    <div>
                        <h2 class="text-2xl md:text-3xl font-bold text-white">Gruppen</h2>
                        <p class="text-dark-muted text-sm mt-1">Verwalte Abteilungen und Teams.</p>
                    </div>
                </div>

                <div>
                    <h3 class="text-xs font-bold text-dark-muted uppercase tracking-wider mb-4 px-1">Meine Mitgliedschaften</h3>
                    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        ${myGroups.length > 0 ? myGroups.map(g => renderCard(g, true)).join('') : '<div class="col-span-full p-6 text-center text-dark-muted border border-dashed border-dark-border rounded-2xl bg-dark-bg/20">Du bist noch in keiner Gruppe.</div>'}
                        ${addButtonHtml}
                    </div>
                </div>

                ${otherGroups.length > 0 ? `
                <div class="pt-4 border-t border-dark-border/50">
                    <h3 class="text-xs font-bold text-dark-muted uppercase tracking-wider mb-4 px-1">Weitere Gruppen</h3>
                    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        ${otherGroups.map(g => renderCard(g, false)).join('')}
                    </div>
                </div>` : ''}
            </div>
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

        const canManage = App.can('manage_group_content', group.name);
        
        const tabs = [
            { id: 'members', label: 'Mitglieder', icon: 'fa-users' },
            { id: 'chat', label: 'Chat', icon: 'fa-comments' },
            { id: 'calendar', label: 'Termine', icon: 'fa-calendar-days' },
            { id: 'files', label: 'Dateien', icon: 'fa-folder-open' }
        ];

        container.innerHTML = `
            <div class="fade-in flex flex-col h-full max-h-[calc(100vh-140px)] md:max-h-none pb-20">
                <div class="flex items-center gap-3 mb-6">
                    <button onclick="GroupsView.closeGroup()" class="w-10 h-10 rounded-xl bg-dark-card border border-dark-border text-dark-muted hover:text-white hover:bg-dark-hover flex items-center justify-center transition-all flex-shrink-0 shadow-sm">
                        <i class="fa-solid fa-arrow-left"></i>
                    </button>
                    <div class="flex-1 min-w-0">
                        <h2 class="text-xl font-bold text-white truncate leading-tight">${group.name}</h2>
                    </div>
                    ${canManage ? `
                    <button onclick="GroupsView.openEditGroupModal('${group.id}')" class="w-10 h-10 rounded-xl bg-dark-bg border border-dark-border text-dark-muted hover:text-brand-500 hover:border-brand-500/30 flex items-center justify-center transition-all">
                        <i class="fa-solid fa-gear"></i>
                    </button>` : ''}
                </div>

                <div class="flex gap-2 mb-6 overflow-x-auto pb-1 no-scrollbar -mx-4 px-4 md:mx-0 md:px-0">
                    ${tabs.map(tab => `
                        <button onclick="GroupsView.switchTab('${tab.id}')" 
                            class="px-4 py-2 rounded-full text-xs font-bold flex items-center gap-2 whitespace-nowrap transition-all border
                            ${this.state.activeTab === tab.id 
                                ? 'bg-brand-600 text-white border-brand-600 shadow-lg shadow-brand-500/20' 
                                : 'bg-dark-card text-dark-muted border-dark-border hover:bg-dark-hover hover:text-white'}">
                            <i class="fa-solid ${tab.icon}"></i> ${tab.label}
                        </button>
                    `).join('')}
                </div>

                <div class="flex-1 bg-dark-card/50 border border-dark-border rounded-2xl p-4 md:p-6 overflow-y-auto custom-scrollbar relative">
                    ${this.getTabContent(group)}
                </div>
            </div>
        `;
        
        if(this.state.activeTab === 'chat') {
            setTimeout(() => {
                const chatBox = document.getElementById('chat-messages');
                if(chatBox) chatBox.scrollTop = chatBox.scrollHeight;
            }, 100);
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
            if (m.group === group.name) return true; 
            return groups.includes(group.name);
        });

        const canManage = App.can('manage_group_content', group.name);
        
        return `
            <div class="flex flex-col h-full">
                <div class="flex justify-between items-center mb-4">
                    <span class="text-xs font-bold text-dark-muted uppercase tracking-wider">${members.length} Mitglieder</span>
                    ${canManage ? `
                    <button onclick="GroupsView.openAddMemberModal('${group.id}')" class="bg-brand-600 hover:bg-brand-500 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-lg flex items-center gap-2">
                        <i class="fa-solid fa-plus"></i> Hinzufügen
                    </button>` : ''}
                </div>

                <div class="space-y-2">
                    ${members.length === 0 
                        ? `<div class="text-center py-12 text-dark-muted opacity-60"><i class="fa-solid fa-users-slash text-3xl mb-2"></i><p class="text-sm">Keine Mitglieder in dieser Gruppe.</p></div>` 
                        : members.map(m => `
                        <div class="flex items-center justify-between p-3 bg-dark-bg/50 border border-dark-border rounded-xl group hover:border-brand-500/30 transition-colors">
                            <div class="flex items-center gap-3 min-w-0">
                                <div class="w-9 h-9 rounded-lg bg-gradient-to-br from-slate-700 to-slate-800 text-slate-300 flex items-center justify-center text-xs font-bold border border-white/5 flex-shrink-0">
                                    ${(m.firstName || '?').charAt(0)}${(m.lastName || '?').charAt(0)}
                                </div>
                                <div class="min-w-0">
                                    <p class="text-sm font-bold text-white truncate">${m.firstName} ${m.lastName}</p>
                                    <p class="text-[10px] text-dark-muted truncate">${m.role || 'Mitglied'}</p>
                                </div>
                            </div>
                            ${canManage ? `
                            <button onclick="GroupsView.removeMemberFromGroup('${m.id}')" class="w-8 h-8 rounded-lg bg-dark-card hover:bg-red-500/10 text-dark-muted hover:text-red-400 flex items-center justify-center transition-colors">
                                <i class="fa-solid fa-user-minus text-xs"></i>
                            </button>` : ''}
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    },

    // --- TAB: KALENDER (TIMELINE VIEW) ---
    renderTabCalendar(group) {
        const allEvents = Store.state.events || [];
        const groupEvents = allEvents
            .filter(e => e.group === group.name)
            .sort((a, b) => new Date(a.date) - new Date(b.date));

        const canManage = App.can('manage_group_content', group.name);

        const groupedEvents = {};
        groupEvents.forEach(e => {
            const date = new Date(e.date);
            const key = date.toLocaleString('de-DE', { month: 'long', year: 'numeric' });
            if (!groupedEvents[key]) groupedEvents[key] = [];
            groupedEvents[key].push(e);
        });

        const renderEventItem = (e) => {
            const startDate = new Date(e.date);
            const dayName = startDate.toLocaleDateString('de-DE', { weekday: 'short' });
            const dayNum = startDate.getDate();
            
            const attendance = e.attendance || {};
            const yesIds = Object.keys(attendance).filter(id => attendance[id] === 'yes');
            const userStatus = App.state.currentUser ? attendance[App.state.currentUser.id] : null;

            let borderClass = 'border-dark-border';
            if (userStatus === 'yes') borderClass = 'border-emerald-500/50';
            else if (userStatus === 'no') borderClass = 'border-red-500/30 opacity-60';

            return `
                <div onclick="GroupsView.openEventDetailModal('${e.id}')" class="bg-dark-bg/50 hover:bg-dark-hover/50 border ${borderClass} rounded-2xl p-4 cursor-pointer transition-all mb-3 relative overflow-hidden group">
                     ${userStatus === 'yes' ? '<div class="absolute left-0 top-0 bottom-0 w-1 bg-emerald-500"></div>' : ''}
                     
                     <div class="flex items-start gap-4">
                        <div class="flex flex-col items-center justify-center bg-dark-card border border-dark-border rounded-xl w-14 h-14 shrink-0 shadow-sm">
                            <span class="text-[10px] uppercase font-bold text-dark-muted leading-none">${dayName}</span>
                            <span class="text-xl font-bold text-white leading-none mt-1">${dayNum}</span>
                        </div>

                        <div class="flex-1 min-w-0">
                            <h4 class="text-white font-bold text-sm md:text-base leading-tight mb-1 truncate pr-6">${e.title}</h4>
                            <div class="flex flex-wrap gap-x-3 gap-y-1 text-xs text-dark-muted">
                                <span class="flex items-center"><i class="fa-regular fa-clock mr-1.5 text-brand-400"></i> ${e.allDay ? 'Ganztägig' : e.time}</span>
                                ${e.location ? `<span class="flex items-center truncate max-w-[150px]"><i class="fa-solid fa-location-dot mr-1.5 text-brand-400"></i> ${e.location}</span>` : ''}
                            </div>
                            
                            <div class="mt-2 flex gap-3 text-[10px] text-dark-muted">
                                <span class="flex items-center"><i class="fa-solid fa-check text-emerald-500 mr-1"></i> ${yesIds.length}</span>
                            </div>
                        </div>

                        ${yesIds.length > 0 ? `
                        <div class="hidden sm:flex -space-x-2 shrink-0">
                            ${yesIds.slice(0, 3).map(id => {
                                const m = Store.state.members.find(mem => mem.id == id);
                                if (!m) return '';
                                return `<div class="w-6 h-6 rounded-full bg-slate-700 border border-dark-bg flex items-center justify-center text-[8px] text-white font-bold" title="${m.firstName}">${m.firstName.charAt(0)}</div>`;
                            }).join('')}
                            ${yesIds.length > 3 ? `<div class="w-6 h-6 rounded-full bg-dark-card border border-dark-bg flex items-center justify-center text-[8px] text-dark-muted font-bold">+${yesIds.length - 3}</div>` : ''}
                        </div>` : ''}
                    </div>
                </div>
            `;
        };

        return `
            <div class="flex flex-col h-full">
                <div class="flex justify-between items-center mb-6">
                    <span class="text-xs font-bold text-dark-muted uppercase tracking-wider">Planung</span>
                    ${canManage ? `
                    <button onclick="GroupsView.openEventAddModal('${group.id}')" class="bg-brand-600 hover:bg-brand-500 text-white px-4 py-2 rounded-xl text-sm font-bold transition-all shadow-lg flex items-center gap-2">
                        <i class="fa-solid fa-calendar-plus"></i> Termin
                    </button>` : ''}
                </div>
                
                <div class="flex-1 overflow-y-auto pr-1 custom-scrollbar">
                    ${Object.keys(groupedEvents).length > 0 ? Object.keys(groupedEvents).map(month => `
                        <div class="mb-6">
                            <h5 class="text-sm font-bold text-white mb-3 sticky top-0 bg-dark-card/95 backdrop-blur py-2 z-10 border-b border-dark-border/50 w-full">
                                ${month}
                            </h5>
                            ${groupedEvents[month].map(e => renderEventItem(e)).join('')}
                        </div>
                    `).join('') : 
                    `<div class="flex flex-col items-center justify-center py-16 text-dark-muted bg-dark-bg/20 rounded-3xl border border-dashed border-dark-border">
                        <div class="w-16 h-16 bg-dark-card rounded-full flex items-center justify-center mb-4 text-2xl shadow-sm">
                            <i class="fa-regular fa-calendar"></i>
                        </div>
                        <p class="font-bold text-white mb-1">Keine Termine</p>
                        <p class="text-xs">In dieser Gruppe steht aktuell nichts an.</p>
                    </div>`}
                </div>
            </div>
        `;
    },

    // --- TAB: CHAT ---
    renderTabChat(group) {
        const messages = group.chat || [];
        const user = App.state.currentUser;

        return `
            <div class="flex flex-col h-[60vh] md:h-[500px]">
                <div id="chat-messages" class="flex-1 overflow-y-auto space-y-3 pr-2 mb-4 custom-scrollbar">
                    ${messages.length === 0 ? '<div class="text-center text-dark-muted text-sm mt-10 italic">Schreib die erste Nachricht...</div>' : ''}
                    ${messages.map(m => {
                        const isMe = m.userId === user.id;
                        return `
                            <div class="flex flex-col ${isMe ? 'items-end' : 'items-start'}">
                                <div class="max-w-[85%] rounded-2xl px-4 py-2 text-sm ${isMe ? 'bg-brand-600 text-white rounded-tr-sm' : 'bg-dark-bg border border-dark-border text-dark-text rounded-tl-sm'}">
                                    ${!isMe ? `<div class="text-[10px] font-bold text-brand-400 mb-0.5">${m.userName}</div>` : ''}
                                    ${m.text}
                                </div>
                                <span class="text-[9px] text-dark-muted mt-1 px-1">${new Date(m.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                            </div>
                        `;
                    }).join('')}
                </div>
                <form onsubmit="GroupsView.sendMessage(event, '${group.id}')" class="flex gap-2 relative">
                    <input name="message" class="form-input pr-12 rounded-full bg-dark-bg border-dark-border focus:bg-dark-card" placeholder="Nachricht..." autocomplete="off" required>
                    <button type="submit" class="absolute right-1 top-1 bottom-1 w-10 bg-brand-600 hover:bg-brand-500 text-white rounded-full flex items-center justify-center transition-transform active:scale-90">
                        <i class="fa-solid fa-paper-plane text-xs"></i>
                    </button>
                </form>
            </div>
        `;
    },

    async sendMessage(e, groupId) {
        e.preventDefault();
        const input = e.target.elements.message;
        const text = input.value.trim();
        if(!text) return;

        const group = Store.state.groups.find(g => g.id == groupId);
        const user = App.state.currentUser;
        
        const newMessage = {
            id: Date.now(),
            userId: user.id,
            userName: user.firstName,
            text: text,
            timestamp: new Date().toISOString()
        };

        const chat = group.chat || [];
        const updatedChat = [...chat, newMessage];
        group.chat = updatedChat;
        this.render(document.getElementById('content'));

        try {
            const _sb = supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY);
            await _sb.from('groups').update({ chat: updatedChat }).eq('id', groupId);
        } catch(err) {
            console.error("Chat Error", err);
            App.showToast("Nachricht konnte nicht gesendet werden", "error");
        }
    },

    renderTabFiles(group) {
        return `
            <div class="flex flex-col items-center justify-center h-48 text-dark-muted">
                <i class="fa-solid fa-cloud-arrow-up text-3xl mb-3 opacity-50"></i>
                <p class="text-sm">Dateien kommen bald...</p>
            </div>
        `;
    },

    // --- NAVIGATION & LOGIC ---

    openGroup(id) { 
        const group = Store.state.groups.find(g => g.id == id);
        
        if(!group) {
            App.showToast("Gruppe nicht gefunden", "error");
            return;
        }

        const user = App.state.currentUser;
        const myGroupNames = user ? (Array.isArray(user.groups) ? user.groups : []) : [];
        const isMember = myGroupNames.includes(group.name);
        const canManage = App.can('manage_group_content', group.name);
        const isAdmin = App.can('admin_global');

        if (isMember || canManage || isAdmin) {
            this.state.activeGroupId = id; 
            this.state.activeTab = 'members'; 
            this.render(document.getElementById('content')); 
        } else {
            App.showToast("Zugriff verweigert", "error");
        }
    },

    closeGroup() { this.state.activeGroupId = null; this.render(document.getElementById('content')); },
    switchTab(id) { this.state.activeTab = id; this.render(document.getElementById('content')); },
    
    async delete(id) { 
        if(!App.can('manage_groups')) return; 
        if(confirm("Gruppe wirklich löschen?")) { 
            await Store.remove('groups', id); 
            this.state.activeGroupId = null;
            this.render(document.getElementById('content')); 
        } 
    },
    
    openAddModal() { 
        if(!App.can('manage_all_groups')) return; 
        const html = `
            <div class="p-6">
                <h3 class="text-xl font-bold text-white mb-6">Neue Gruppe</h3>
                <form onsubmit="GroupsView.handleAdd(event)" class="space-y-4">
                    <div>
                        <label class="text-xs font-bold text-dark-muted uppercase mb-1 block">Name</label>
                        <input name="name" class="form-input" placeholder="z.B. Elferrat" required>
                    </div>
                    <button class="btn-primary w-full mt-2">Erstellen</button>
                </form>
            </div>`;
        App.openModal(html); 
    },
    
    async handleAdd(e) { 
        e.preventDefault(); 
        const name = new FormData(e.target).get('name'); 
        await Store.add('groups', { id: Date.now(), name: name, chat: [], files: [] }); 
        App.closeModal(); 
        this.render(document.getElementById('content')); 
    },

    openEditGroupModal(groupId) {
        const group = Store.state.groups.find(g => g.id == groupId);
        if(!group) return;
        
        const html = `
            <div class="p-6">
                <div class="flex justify-between items-center mb-6 border-b border-dark-border pb-4">
                    <h3 class="text-xl font-bold text-white">Gruppe bearbeiten</h3>
                    <button onclick="App.closeModal()" class="text-dark-muted hover:text-white"><i class="fa-solid fa-times text-xl"></i></button>
                </div>
                <form onsubmit="GroupsView.handleUpdateGroup(event, '${groupId}')" class="space-y-4">
                    <div>
                        <label class="text-xs font-bold text-dark-muted uppercase mb-1 block">Name</label>
                        <input type="text" name="name" value="${group.name}" required class="form-input">
                    </div>
                    <button type="submit" class="btn-primary w-full">Speichern</button>
                </form>
            </div>
        `;
        App.openModal(html);
    },

    async handleUpdateGroup(e, groupId) {
        e.preventDefault();
        const fd = new FormData(e.target);
        const newName = fd.get('name');
        
        const _sb = supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY);
        await _sb.from('groups').update({ name: newName }).eq('id', groupId);
        
        const group = Store.state.groups.find(g => g.id == groupId);
        if(group) group.name = newName;
        
        App.closeModal();
        this.render(document.getElementById('content'));
        App.showToast("Gespeichert");
    },

    // --- MEMBER MANAGEMENT ---
    openAddMemberModal(groupId) {
        const group = Store.state.groups.find(g => g.id == groupId);
        const members = Store.state.members || [];
        
        const available = members.filter(m => {
            const grps = Array.isArray(m.groups) ? m.groups : [];
            return !grps.includes(group.name) && m.group !== group.name;
        });

        const html = `
            <div class="p-6 h-[500px] flex flex-col">
                <div class="flex justify-between items-center mb-4">
                    <h3 class="font-bold text-white">Mitglied hinzufügen</h3>
                    <button onclick="App.closeModal()"><i class="fa-solid fa-times text-dark-muted"></i></button>
                </div>
                <input type="text" placeholder="Suchen..." onkeyup="GroupsView.filterMembers(this)" class="form-input mb-4 text-sm">
                <div id="add-member-list" class="flex-1 overflow-y-auto custom-scrollbar space-y-2">
                    ${available.map(m => `
                        <div class="member-item flex justify-between items-center p-3 bg-dark-bg/50 rounded-xl border border-dark-border">
                            <span class="text-sm text-white font-bold member-name">${m.firstName} ${m.lastName}</span>
                            <button onclick="GroupsView.addMemberDirect('${groupId}', '${m.id}')" class="w-8 h-8 bg-brand-600 rounded-lg text-white flex items-center justify-center"><i class="fa-solid fa-plus"></i></button>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
        App.openModal(html);
    },

    filterMembers(input) {
        const val = input.value.toLowerCase();
        document.querySelectorAll('#add-member-list .member-item').forEach(el => {
            const name = el.querySelector('.member-name').textContent.toLowerCase();
            el.style.display = name.includes(val) ? 'flex' : 'none';
        });
    },

    async addMemberDirect(groupId, memberId) {
        const group = Store.state.groups.find(g => g.id == groupId);
        const member = Store.state.members.find(m => m.id == memberId);
        
        let groups = Array.isArray(member.groups) ? [...member.groups] : [];
        if(member.group && member.group !== 'Keine' && !groups.includes(member.group)) groups.push(member.group);
        if(!groups.includes(group.name)) groups.push(group.name);

        const _sb = supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY);
        await _sb.from('members').update({ groups: groups }).eq('id', memberId);
        
        member.groups = groups;
        App.closeModal();
        App.showToast("Hinzugefügt");
        this.render(document.getElementById('content'));
    },

    async removeMemberFromGroup(memberId) {
        if(!confirm("Entfernen?")) return;
        const group = Store.state.groups.find(g => g.id == this.state.activeGroupId);
        const member = Store.state.members.find(m => m.id == memberId);
        
        let groups = Array.isArray(member.groups) ? [...member.groups] : [];
        groups = groups.filter(g => g !== group.name);

        const _sb = supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY);
        await _sb.from('members').update({ groups: groups }).eq('id', memberId);
        
        member.groups = groups;
        this.render(document.getElementById('content'));
        App.showToast("Entfernt");
    },

    // --- EVENT MODALS (mit Ganztägig, Enddatum, Abbruch) ---
    openEventAddModal(groupId) {
        const html = `
            <div class="p-6 max-h-[85vh] overflow-y-auto custom-scrollbar">
                <div class="flex justify-between items-center mb-6 border-b border-dark-border pb-4">
                    <h3 class="text-xl font-bold text-white">Neuer Termin</h3>
                    <button onclick="App.closeModal()" class="text-dark-muted hover:text-white p-2"><i class="fa-solid fa-times text-xl"></i></button>
                </div>
                
                <form onsubmit="GroupsView.handleEventAdd(event, '${groupId}')" class="space-y-5">
                    <div>
                        <label class="text-muted text-xs uppercase font-bold">Titel</label>
                        <input name="title" class="form-input" placeholder="Titel" required>
                    </div>

                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label class="text-muted text-xs uppercase font-bold">Start</label>
                            <input type="date" name="date" id="startDateInput" class="form-input dark-date" required onchange="document.getElementById('endDateInput').min = this.value; if(!document.getElementById('endDateInput').value) document.getElementById('endDateInput').value = this.value;">
                        </div>
                        <div>
                            <label class="text-muted text-xs uppercase font-bold">Ende</label>
                            <input type="date" name="endDate" id="endDateInput" class="form-input dark-date">
                        </div>
                    </div>

                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end">
                        <div>
                            <label class="text-muted text-xs uppercase font-bold">Uhrzeit</label>
                            <input type="time" name="time" id="eventTimeInput" class="form-input dark-date" required>
                        </div>
                        <label class="flex items-center gap-3 p-3 bg-dark-bg/50 border border-dark-border rounded-xl cursor-pointer hover:border-brand-500/50 transition-colors h-[46px]">
                            <input type="checkbox" name="allDay" class="w-5 h-5 rounded border-dark-border bg-dark-bg text-brand-600 focus:ring-brand-500" 
                                onchange="const t = document.getElementById('eventTimeInput'); t.disabled = this.checked; if(this.checked) t.value = ''; else t.focus(); t.required = !this.checked;">
                            <span class="text-sm font-medium text-white">Ganztägig</span>
                        </label>
                    </div>

                    <div>
                        <label class="text-muted text-xs uppercase font-bold">Ort</label>
                        <input name="location" class="form-input" placeholder="Ort">
                    </div>
                    
                    <div>
                        <label class="text-muted text-xs uppercase font-bold">Beschreibung</label>
                        <textarea name="description" class="form-input h-24" placeholder="Infos..."></textarea>
                    </div>

                    <div class="flex gap-3 pt-2">
                        <button type="button" onclick="App.closeModal()" class="flex-1 py-3 border border-dark-border rounded-xl text-dark-muted hover:text-white transition-colors">Abbrechen</button>
                        <button type="submit" class="flex-1 btn-primary">Erstellen</button>
                    </div>
                </form>
            </div>
        `;
        App.openModal(html);
    },

    // NEU: Bearbeiten Modal
    openEventEditModal(eventId) {
        const e = Store.state.events.find(ev => ev.id == eventId);
        if(!e) return;
        
        // Berechtigungs-Check
        const group = Store.state.groups.find(g => g.name === e.group);
        if (!group || !App.can('manage_group_content', group.name)) {
             App.showToast("Keine Berechtigung", "error");
             return;
        }

        const html = `
            <div class="p-6 max-h-[85vh] overflow-y-auto custom-scrollbar">
                <div class="flex justify-between items-center mb-6 border-b border-dark-border pb-4">
                    <h3 class="text-xl font-bold text-white">Termin bearbeiten</h3>
                    <button onclick="GroupsView.openEventDetailModal('${eventId}')" class="text-dark-muted hover:text-white text-sm flex items-center gap-1"><i class="fa-solid fa-arrow-left"></i> Zurück</button>
                </div>
                
                <form onsubmit="GroupsView.handleEventUpdate(event, '${eventId}')" class="space-y-5">
                    <div>
                        <label class="text-muted text-xs uppercase font-bold">Titel</label>
                        <input name="title" value="${e.title}" class="form-input" required>
                    </div>

                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label class="text-muted text-xs uppercase font-bold">Start</label>
                            <input type="date" name="date" value="${e.date}" id="editStartDateInput" class="form-input dark-date" required onchange="document.getElementById('editEndDateInput').min = this.value">
                        </div>
                        <div>
                            <label class="text-muted text-xs uppercase font-bold">Ende</label>
                            <input type="date" name="endDate" value="${e.endDate || e.date}" id="editEndDateInput" class="form-input dark-date">
                        </div>
                    </div>

                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end">
                        <div>
                            <label class="text-muted text-xs uppercase font-bold">Uhrzeit</label>
                            <input type="time" name="time" value="${e.time === '00:00' && e.allDay ? '' : e.time}" id="editEventTimeInput" class="form-input dark-date" ${e.allDay ? 'disabled' : ''} ${!e.allDay ? 'required' : ''}>
                        </div>
                        <label class="flex items-center gap-3 p-3 bg-dark-bg/50 border border-dark-border rounded-xl cursor-pointer hover:border-brand-500/50 transition-colors h-[46px]">
                            <input type="checkbox" name="allDay" ${e.allDay ? 'checked' : ''} class="w-5 h-5 rounded border-dark-border bg-dark-bg text-brand-600 focus:ring-brand-500" 
                                onchange="const t = document.getElementById('editEventTimeInput'); t.disabled = this.checked; if(this.checked) t.value = ''; else t.focus(); t.required = !this.checked;">
                            <span class="text-sm font-medium text-white">Ganztägig</span>
                        </label>
                    </div>

                    <div>
                        <label class="text-muted text-xs uppercase font-bold">Ort</label>
                        <input name="location" value="${e.location || ''}" class="form-input" placeholder="Ort">
                    </div>
                    
                    <div>
                        <label class="text-muted text-xs uppercase font-bold">Beschreibung</label>
                        <textarea name="description" class="form-input h-24" placeholder="Infos...">${e.description || ''}</textarea>
                    </div>

                    <div class="flex gap-3 pt-2">
                        <button type="submit" class="w-full btn-primary">Speichern</button>
                    </div>
                </form>
            </div>
        `;
        App.openModal(html);
    },

    async handleEventUpdate(e, eventId) {
        e.preventDefault();
        const fd = new FormData(e.target);
        
        const isAllDay = fd.get('allDay') === 'on';
        let startDate = fd.get('date');
        let endDate = fd.get('endDate');
        if (!endDate) endDate = startDate;

        // Objekt ohne ID für Update
        const updates = {
            title: fd.get('title'),
            date: startDate,
            endDate: endDate,
            time: isAllDay ? null : fd.get('time'),
            allDay: isAllDay,
            location: fd.get('location'),
            description: fd.get('description')
        };

        const originalEvent = Store.state.events.find(ev => ev.id == eventId);
        if(!originalEvent) return;

        try {
            const _sb = supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY);
            const { error } = await _sb.from('events').update(updates).eq('id', eventId);

            if (error) throw error;

            // Local Update
            Object.assign(originalEvent, updates);
            
            App.showToast("Termin aktualisiert");
            // Zurück zur Detail-Ansicht
            this.openEventDetailModal(eventId);
            this.render(document.getElementById('content'));
        } catch(err) {
            console.error(err);
            App.showToast("Fehler beim Speichern", "error");
        }
    },

    handleEventAdd(e, groupId) {
        e.preventDefault();
        const fd = new FormData(e.target);
        const group = Store.state.groups.find(g => g.id == groupId);
        
        const isAllDay = fd.get('allDay') === 'on';
        let startDate = fd.get('date');
        let endDate = fd.get('endDate');
        if (!endDate) endDate = startDate;

        const event = {
            title: fd.get('title'),
            date: startDate,
            endDate: endDate,
            time: isAllDay ? null : fd.get('time'),
            allDay: isAllDay,
            location: fd.get('location'),
            description: fd.get('description'),
            group: group.name,
            attendance: {}
        };
        
        Store.add('events', event);
        App.closeModal();
        App.showToast("Termin erstellt");
        this.render(document.getElementById('content'));
    },

    openEventDetailModal(eventId) {
        const e = Store.state.events.find(ev => ev.id == eventId);
        if(!e) return;
        
        const group = Store.state.groups.find(g => g.name === e.group);
        const canManage = group && App.can('manage_group_content', group.name);

        const startDate = new Date(e.date);
        const endDate = e.endDate ? new Date(e.endDate) : null;
        const dateStr = startDate.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
        
        let endStr = '';
        if (endDate && endDate.getTime() !== startDate.getTime()) {
            endStr = ' - ' + endDate.toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'long' });
        }

        const attendance = e.attendance || {};
        const members = Store.state.members || [];
        
        const getVoters = (status) => {
            return Object.keys(attendance)
                .filter(id => attendance[id] === status)
                .map(id => members.find(m => m.id == id))
                .filter(m => m);
        };

        const yesVoters = getVoters('yes');
        const maybeVoters = getVoters('maybe');
        const noVoters = getVoters('no');
        
        const currentUser = App.state.currentUser;
        const myStatus = currentUser ? attendance[currentUser.id] : null;

        // Große Buttons für Abstimmung
        const btnBase = "flex-1 py-4 rounded-xl border text-sm font-bold flex flex-col items-center justify-center gap-2 transition-all active:scale-95";
        const btnInactive = "bg-dark-bg/50 border-dark-border text-dark-muted hover:text-white hover:bg-dark-hover";
        
        const btnYes = myStatus === 'yes' 
            ? "bg-emerald-600 border-emerald-500 text-white shadow-lg shadow-emerald-900/20 ring-2 ring-emerald-500/50" 
            : btnInactive;
            
        const btnMaybe = myStatus === 'maybe' 
            ? "bg-amber-600 border-amber-500 text-white shadow-lg shadow-amber-900/20 ring-2 ring-amber-500/50" 
            : btnInactive;
            
        const btnNo = myStatus === 'no' 
            ? "bg-red-600 border-red-500 text-white shadow-lg shadow-red-900/20 ring-2 ring-red-500/50" 
            : btnInactive;

        const renderParticipantList = (title, voters, colorClass) => {
            if (voters.length === 0) return '';
            return `
                <div class="mb-4">
                    <h5 class="text-xs font-bold text-dark-muted uppercase mb-2 pl-1">${title} <span class="${colorClass} ml-1">${voters.length}</span></h5>
                    <div class="flex flex-col gap-2">
                        ${voters.map(m => `
                            <div class="flex items-center gap-3 p-2 rounded-lg bg-dark-bg/30 border border-dark-border/50">
                                <div class="w-8 h-8 rounded-full bg-slate-700 text-slate-300 flex items-center justify-center text-xs font-bold border border-white/5">
                                    ${(m.firstName || '?').charAt(0)}${(m.lastName || '?').charAt(0)}
                                </div>
                                <span class="text-sm text-white font-medium">${m.firstName} ${m.lastName}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        };

        const html = `
            <div class="p-6 md:p-8 h-full flex flex-col">
                <!-- Header Image/Gradient -->
                <div class="absolute top-0 left-0 w-full h-32 bg-gradient-to-b from-brand-900/20 to-transparent pointer-events-none"></div>

                <div class="flex justify-between items-start mb-6 relative z-10">
                    <div class="flex-1 min-w-0 pr-4">
                        <div class="text-brand-400 text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-2">
                            <i class="fa-regular fa-calendar"></i> ${dateStr}${endStr}
                        </div>
                        <h3 class="text-2xl md:text-3xl font-bold text-white leading-tight break-words">${e.title}</h3>
                        <div class="flex flex-wrap gap-4 text-sm text-dark-muted mt-3">
                            <span class="flex items-center bg-dark-bg/50 px-2 py-1 rounded-md border border-dark-border/50">
                                <i class="fa-regular fa-clock mr-2 text-brand-500"></i> ${e.allDay ? 'Ganztägig' : e.time + ' Uhr'}
                            </span>
                            ${e.location ? `<span class="flex items-center bg-dark-bg/50 px-2 py-1 rounded-md border border-dark-border/50"><i class="fa-solid fa-location-dot mr-2 text-red-400"></i> ${e.location}</span>` : ''}
                        </div>
                    </div>
                    <button onclick="App.closeModal()" class="w-8 h-8 rounded-full bg-dark-bg text-dark-muted hover:text-white flex items-center justify-center transition-colors shadow-sm border border-dark-border"><i class="fa-solid fa-times text-lg"></i></button>
                </div>

                <div class="flex-1 overflow-y-auto custom-scrollbar space-y-8 relative z-10">
                    
                    <!-- Abstimmung -->
                    <div>
                        <h4 class="text-xs font-bold text-white uppercase mb-3 flex items-center gap-2">
                            <i class="fa-solid fa-check-to-slot text-brand-500"></i> Deine Entscheidung
                        </h4>
                        <div class="flex gap-3">
                            <button onclick="GroupsView.setAttendance('${e.id}', 'yes')" class="${btnBase} ${btnYes}">
                                <i class="fa-solid fa-circle-check text-2xl mb-1"></i> Dabei
                            </button>
                            <button onclick="GroupsView.setAttendance('${e.id}', 'maybe')" class="${btnBase} ${btnMaybe}">
                                <i class="fa-solid fa-circle-question text-2xl mb-1"></i> Vielleicht
                            </button>
                            <button onclick="GroupsView.setAttendance('${e.id}', 'no')" class="${btnBase} ${btnNo}">
                                <i class="fa-solid fa-circle-xmark text-2xl mb-1"></i> Absage
                            </button>
                        </div>
                    </div>

                    <!-- Beschreibung -->
                    ${e.description ? `
                    <div>
                        <h4 class="text-xs font-bold text-dark-muted uppercase mb-2 pl-1">Infos</h4>
                        <div class="bg-dark-bg/50 p-4 rounded-xl border border-dark-border text-sm leading-relaxed text-white whitespace-pre-wrap text-left break-words w-full">
                            ${e.description}
                        </div>
                    </div>` : ''}

                    <!-- Teilnehmer Listen -->
                    <div>
                        <div class="flex items-center justify-between mb-4 border-b border-dark-border pb-2">
                            <h4 class="text-xs font-bold text-white uppercase tracking-wider">Teilnehmer</h4>
                            <span class="text-xs text-dark-muted bg-dark-bg px-2 py-1 rounded-md border border-dark-border">${yesVoters.length + maybeVoters.length + noVoters.length} Rückmeldungen</span>
                        </div>
                        
                        ${(yesVoters.length === 0 && maybeVoters.length === 0 && noVoters.length === 0) ? 
                            '<p class="text-sm text-dark-muted italic text-center py-8 bg-dark-bg/20 rounded-xl border border-dashed border-dark-border">Noch keine Rückmeldungen.</p>' : ''}
                            
                        <div class="grid grid-cols-1 sm:grid-cols-2 gap-6">
                            <div>${renderParticipantList('Zusagen', yesVoters, 'text-emerald-400')}</div>
                            <div>
                                ${renderParticipantList('Vielleicht', maybeVoters, 'text-amber-400')}
                                ${renderParticipantList('Absagen', noVoters, 'text-red-400')}
                            </div>
                        </div>
                    </div>
                </div>

                ${canManage ? `
                <div class="mt-6 pt-4 border-t border-dark-border flex gap-3">
                    <button onclick="GroupsView.openEventEditModal('${e.id}')" class="flex-1 py-3 bg-dark-bg hover:bg-dark-hover text-white rounded-xl font-bold border border-dark-border transition-all flex items-center justify-center gap-2">
                        <i class="fa-solid fa-pen"></i> Bearbeiten
                    </button>
                    <button onclick="GroupsView.deleteGroupEvent('${e.id}')" class="flex-1 py-3 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-xl font-bold border border-red-500/20 transition-all flex items-center justify-center gap-2">
                        <i class="fa-regular fa-trash-can"></i> Löschen
                    </button>
                </div>` : ''}
            </div>
        `;
        
        App.openModal(html);
        
        // Modal Größe anpassen
        const modalContainer = document.getElementById('modal-content');
        if(modalContainer) {
            modalContainer.classList.remove('max-w-md');
            modalContainer.classList.add('max-w-3xl', 'w-full', 'max-h-[90vh]');
        }
    },

    // Attendance Logik (wie im CalendarView)
    async setAttendance(eventId, status) {
        const currentUser = App.state.currentUser;
        if(!currentUser) return;

        const e = Store.state.events.find(ev => ev.id == eventId);
        if(e) {
            const updatedAttendance = { ...(e.attendance || {}) };
            
            if (updatedAttendance[currentUser.id] === status) {
                delete updatedAttendance[currentUser.id]; // Toggle Off
            } else {
                updatedAttendance[currentUser.id] = status; // Set Status
            }

            const { id, ...eventDataWithoutId } = e;
            const updatePayload = {
                ...eventDataWithoutId,
                attendance: updatedAttendance
            };

            try {
                const _sb = supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY);
                const { error } = await _sb.from('events').update(updatePayload).eq('id', eventId);

                if (error) throw error;

                // Local Update & Refresh
                e.attendance = updatedAttendance;
                this.openEventDetailModal(eventId);
                this.render(document.getElementById('content'));
            } catch(err) {
                console.error(err);
                App.showToast("Fehler: " + err.message, "error");
            }
        }
    },

    async deleteGroupEvent(id) {
        if(confirm("Löschen?")) {
            await Store.remove('events', id);
            App.closeModal();
            this.render(document.getElementById('content'));
        }
    }
};

window.GroupsView = GroupsView;
