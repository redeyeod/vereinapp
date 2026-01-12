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

    // --- TAB: KALENDER ---
    renderTabCalendar(group) {
        const allEvents = Store.state.events || [];
        const groupEvents = allEvents
            .filter(e => e.group === group.name)
            .sort((a, b) => new Date(a.date) - new Date(b.date));

        const canManage = App.can('manage_group_content', group.name);

        return `
            <div class="flex flex-col h-full">
                <div class="flex justify-between items-center mb-4">
                    <span class="text-xs font-bold text-dark-muted uppercase tracking-wider">Nächste Termine</span>
                    ${canManage ? `
                    <button onclick="GroupsView.openEventAddModal('${group.id}')" class="bg-brand-600 hover:bg-brand-500 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-lg flex items-center gap-2">
                        <i class="fa-solid fa-plus"></i> Neu
                    </button>` : ''}
                </div>
                
                <div class="space-y-3 flex-1 overflow-y-auto pr-1 custom-scrollbar">
                    ${groupEvents.length > 0 ? groupEvents.map(e => this.renderEventCard(e)).join('') : 
                    `<div class="text-center py-12 text-dark-muted border border-dashed border-dark-border rounded-2xl bg-dark-bg/20">
                        <i class="fa-regular fa-calendar-times text-3xl mb-2 opacity-50"></i>
                        <p class="text-sm">Keine Termine geplant.</p>
                    </div>`}
                </div>
            </div>
        `;
    },

    renderEventCard(e) {
        const startDate = new Date(e.date);
        const endDate = e.endDate ? new Date(e.endDate) : null;
        
        let dateRangeText = '';
        if (endDate && (endDate.getDate() !== startDate.getDate() || endDate.getMonth() !== startDate.getMonth())) {
            dateRangeText = `<span class="block text-[9px] text-dark-muted border-t border-white/10 mt-1 pt-1">bis ${endDate.getDate()}.${endDate.toLocaleString('de-DE', { month: 'numeric' })}.</span>`;
        }
        
        const attendance = e.attendance || {};
        const yesCount = Object.values(attendance).filter(v => v === 'yes').length;
        const currentUser = App.state.currentUser;
        const myStatus = currentUser && attendance[currentUser.id] ? attendance[currentUser.id] : null;
        
        let statusBadge = '';
        if(myStatus === 'yes') statusBadge = '<i class="fa-solid fa-circle-check text-emerald-500 ml-2"></i>';
        else if(myStatus === 'maybe') statusBadge = '<i class="fa-solid fa-circle-question text-amber-500 ml-2"></i>';
        else if(myStatus === 'no') statusBadge = '<i class="fa-solid fa-circle-xmark text-red-500 ml-2"></i>';

        return `
            <div onclick="GroupsView.openEventDetailModal('${e.id}')" class="bg-dark-bg/50 hover:bg-dark-hover/50 border border-dark-border p-3 rounded-xl flex items-center gap-4 cursor-pointer group transition-all">
                <div class="bg-dark-card border border-dark-border rounded-lg p-2 text-center min-w-[56px] group-hover:border-brand-500/30 transition-colors">
                    <div class="text-[10px] font-bold uppercase text-brand-500">${startDate.toLocaleString('de-DE', { month: 'short' })}</div>
                    <div class="text-lg font-bold text-white leading-none mt-0.5">${startDate.getDate()}</div>
                    ${dateRangeText}
                </div>

                <div class="flex-1 min-w-0">
                    <div class="flex justify-between items-start">
                        <h4 class="text-white font-bold text-sm truncate">${e.title}</h4>
                        <div class="text-xs">${statusBadge}</div>
                    </div>
                    
                    <div class="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-dark-muted mt-1">
                        <span class="flex items-center"><i class="fa-regular fa-clock mr-1.5 opacity-70"></i> ${e.allDay ? 'Ganztägig' : e.time}</span>
                        ${e.location ? `<span class="flex items-center truncate"><i class="fa-solid fa-location-dot mr-1.5 opacity-70"></i> ${e.location}</span>` : ''}
                    </div>
                    
                    ${yesCount > 0 ? `<div class="mt-1.5 text-[10px] text-dark-muted flex items-center"><i class="fa-solid fa-user-check text-emerald-500/70 mr-1.5"></i> ${yesCount} Zusagen</div>` : ''}
                </div>
                
                <i class="fa-solid fa-chevron-right text-dark-muted text-xs opacity-50 group-hover:opacity-100 group-hover:translate-x-1 transition-all"></i>
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

                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <label class="text-muted text-xs uppercase font-bold">Start</label>
                            <input type="date" name="date" id="startDateInput" class="form-input dark-date" required onchange="document.getElementById('endDateInput').min = this.value; if(!document.getElementById('endDateInput').value) document.getElementById('endDateInput').value = this.value;">
                        </div>
                        <div>
                            <label class="text-muted text-xs uppercase font-bold">Ende</label>
                            <input type="date" name="endDate" id="endDateInput" class="form-input dark-date">
                        </div>
                    </div>

                    <div class="grid grid-cols-2 gap-4 items-end">
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

        const btnBase = "flex-1 py-3 rounded-xl border text-sm font-bold flex flex-col items-center justify-center gap-1 transition-all";
        const btnInactive = "bg-dark-bg/50 border-dark-border text-dark-muted hover:text-white hover:bg-dark-hover";
        
        const btnYes = myStatus === 'yes' 
            ? "bg-emerald-600 border-emerald-500 text-white shadow-lg shadow-emerald-900/20 scale-105 z-10" 
            : btnInactive;
            
        const btnMaybe = myStatus === 'maybe' 
            ? "bg-amber-600 border-amber-500 text-white shadow-lg shadow-amber-900/20 scale-105 z-10" 
            : btnInactive;
            
        const btnNo = myStatus === 'no' 
            ? "bg-red-600 border-red-500 text-white shadow-lg shadow-red-900/20 scale-105 z-10" 
            : btnInactive;

        const renderVoterList = (title, voters, colorClass, icon) => {
            if (voters.length === 0) return '';
            return `
                <div class="mt-4">
                    <h5 class="text-xs font-bold ${colorClass} uppercase mb-2 flex items-center gap-2">
                        <i class="fa-solid ${icon}"></i> ${title} (${voters.length})
                    </h5>
                    <div class="flex flex-wrap gap-2">
                        ${voters.map(m => `
                            <div class="flex items-center gap-2 bg-dark-bg/50 border border-dark-border rounded-full pr-3 pl-1 py-1">
                                <div class="w-6 h-6 rounded-full bg-slate-700 text-slate-300 flex items-center justify-center text-[10px] font-bold">
                                    ${(m.firstName || '?').charAt(0)}${(m.lastName || '?').charAt(0)}
                                </div>
                                <span class="text-xs text-white">${m.firstName} ${m.lastName}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        };

        const html = `
            <div class="p-6 h-full flex flex-col">
                <div class="flex justify-between items-start mb-6 border-b border-dark-border pb-4">
                    <div>
                        <div class="text-brand-400 text-xs font-bold uppercase tracking-wider mb-1">${dateStr}${endStr}</div>
                        <h3 class="text-xl md:text-2xl font-bold text-white leading-tight">${e.title}</h3>
                        <div class="flex items-center gap-4 text-sm text-dark-muted mt-2">
                            <span><i class="fa-regular fa-clock mr-1"></i> ${e.allDay ? 'Ganztägig' : e.time + ' Uhr'}</span>
                            ${e.location ? `<span><i class="fa-solid fa-location-dot mr-1"></i> ${e.location}</span>` : ''}
                        </div>
                    </div>
                    <button onclick="App.closeModal()" class="text-dark-muted hover:text-white p-2"><i class="fa-solid fa-times text-xl"></i></button>
                </div>

                <div class="flex-1 overflow-y-auto custom-scrollbar space-y-6">
                    ${e.description ? `
                    <div class="bg-dark-bg/50 p-4 rounded-xl border border-dark-border text-sm leading-relaxed text-white whitespace-pre-wrap">
                        ${e.description}
                    </div>` : ''}

                    <div>
                        <h4 class="text-xs font-bold text-dark-muted uppercase mb-3">Deine Antwort</h4>
                        <div class="flex gap-2">
                            <button onclick="GroupsView.setAttendance('${e.id}', 'yes')" class="${btnBase} ${btnYes}">
                                <i class="fa-solid fa-check text-lg"></i> Dabei
                            </button>
                            <button onclick="GroupsView.setAttendance('${e.id}', 'maybe')" class="${btnBase} ${btnMaybe}">
                                <i class="fa-solid fa-question text-lg"></i> Vielleicht
                            </button>
                            <button onclick="GroupsView.setAttendance('${e.id}', 'no')" class="${btnBase} ${btnNo}">
                                <i class="fa-solid fa-xmark text-lg"></i> Absage
                            </button>
                        </div>
                    </div>

                    <div class="space-y-2">
                        ${renderVoterList('Zusagen', yesVoters, 'text-emerald-400', 'fa-circle-check')}
                        ${renderVoterList('Vielleicht', maybeVoters, 'text-amber-400', 'fa-circle-question')}
                        ${renderVoterList('Absagen', noVoters, 'text-red-400', 'fa-circle-xmark')}
                        
                        ${(yesVoters.length === 0 && maybeVoters.length === 0 && noVoters.length === 0) ? 
                            '<p class="text-sm text-dark-muted italic text-center py-4">Noch keine Rückmeldungen.</p>' : ''}
                    </div>
                </div>

                ${canManage ? `
                <div class="mt-6 pt-4 border-t border-dark-border">
                    <button onclick="GroupsView.deleteGroupEvent('${e.id}')" class="w-full py-3 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-xl font-bold border border-red-500/20 transition-all flex items-center justify-center gap-2">
                        <i class="fa-regular fa-trash-can"></i> Termin löschen
                    </button>
                </div>` : ''}
            </div>
        `;
        App.openModal(html);
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
