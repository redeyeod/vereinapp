/**
 * =============================================================================
 * MESSENGER VIEW
 * Zentraler Ort für alle Kommunikation (News, Gruppen, Privat)
 * =============================================================================
 */

const MessengerView = {
    // Lokaler State
    state: {
        activeType: 'news', // 'news', 'group', 'private'
        activeId: 0,        // 0 oder null bedeutet: Kein Chat ausgewählt
        filterTerm: '',     // Für die Suche
        myId: 1,            // Fallback
        showAttachMenu: false, 
        showEmojiPicker: false 
    },

    // Helper um die aktuelle User-ID zu holen
    getMyId() {
        return (App.state.currentUser && App.state.currentUser.id) || localStorage.getItem('vm_current_user_id') || 1;
    },

    /**
     * Haupt-Render Funktion
     */
    render(container) {
        // Mobile-Logik: Wenn Chat aktiv ist, verstecke Sidebar auf kleinen Screens
        const isChatActive = this.state.activeId !== 0 && this.state.activeId !== null;
        
        const sidebarClass = isChatActive ? 'hidden md:flex' : 'flex';
        const chatAreaClass = isChatActive ? 'flex' : 'hidden md:flex';

        container.innerHTML = `
            <div class="flex h-[calc(100vh-140px)] bg-dark-card rounded-bubble border border-dark-border overflow-hidden shadow-2xl fade-in">
                
                <!-- Sidebar: Kontaktliste -->
                <div class="${sidebarClass} w-full md:w-1/3 border-r border-dark-border flex-col bg-dark-bg/30">
                    <!-- Suchleiste -->
                    <div class="p-3 md:p-4 border-b border-dark-border sticky top-0 bg-dark-card z-10">
                        <div class="relative">
                            <i class="fa-solid fa-search absolute left-3 top-1/2 -translate-y-1/2 text-dark-muted text-sm"></i>
                            <input type="text" id="messenger-search" onkeyup="MessengerView.handleSearch(this.value)" placeholder="Suchen..." 
                                class="w-full bg-dark-bg border border-dark-border rounded-xl pl-9 pr-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors placeholder-dark-muted shadow-inner"
                                value="${this.state.filterTerm}">
                        </div>
                    </div>

                    <!-- Liste -->
                    <div id="messenger-list" class="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-4">
                        <!-- Inhalt kommt durch renderSidebarList() -->
                    </div>
                </div>

                <!-- Hauptbereich: Chat Fenster -->
                <div class="${chatAreaClass} flex-1 flex-col bg-dark-card relative h-full" id="messenger-chat-area">
                    ${this.renderActiveChat()}
                </div>
            </div>
        `;

        // Liste initial befüllen
        this.renderSidebarList();
        
        // Scroll zum Ende des Chats, falls sichtbar
        if (isChatActive) {
            this.scrollToBottom();
        }
        
        // Fokus wiederherstellen
        const searchInput = document.getElementById('messenger-search');
        if(this.state.filterTerm && searchInput) {
            searchInput.focus();
            const val = searchInput.value;
            searchInput.value = '';
            searchInput.value = val;
        }
    },

    /**
     * Such-Handler
     */
    handleSearch(val) {
        this.state.filterTerm = val.toLowerCase();
        this.renderSidebarList();
    },

    /**
     * Rendert die Liste in der Sidebar
     */
    renderSidebarList() {
        const container = document.getElementById('messenger-list');
        if(!container) return;

        const term = this.state.filterTerm;
        const myId = this.getMyId();
        const members = Store.state.members || [];
        const groups = Store.state.groups || [];
        const me = members.find(m => m.id == myId) || { groups: [] };
        
        const myGroupNames = Array.isArray(me.groups) ? me.groups : (me.group && me.group !== 'Keine' ? [me.group] : []);

        // 1. ANKÜNDIGUNGEN
        let newsHTML = '';
        if ('ankündigungen'.includes(term) || term === '') {
            newsHTML = `
                <div class="mb-2">
                    <p class="px-3 mb-1 text-[10px] font-bold text-dark-muted uppercase tracking-wider opacity-70">Allgemein</p>
                    ${this.renderContactItem('news', 0, 'Ankündigungen', 'fa-bullhorn', 'red')}
                </div>`;
        }

        // 2. GRUPPEN
        const myGroups = groups.filter(g => myGroupNames.includes(g.name));
        const filteredGroups = myGroups.filter(g => g.name.toLowerCase().includes(term));
        
        let groupsHTML = '';
        if (filteredGroups.length > 0) {
            groupsHTML = `
                <div class="mb-2">
                    <p class="px-3 mb-1 text-[10px] font-bold text-dark-muted uppercase tracking-wider opacity-70">Gruppen</p>
                    <div class="space-y-1">
                        ${filteredGroups.map(g => this.renderContactItem('group', g.id, g.name, 'fa-users', 'green')).join('')}
                    </div>
                </div>`;
        }

        // 3. PRIVAT
        const allMembers = members.filter(m => m.id != myId);
        let membersToShow = [];

        if (term === '') {
            membersToShow = allMembers.filter(m => m.privateChat && m.privateChat.length > 0);
        } else {
            membersToShow = allMembers.filter(m => (m.firstName + ' ' + m.lastName).toLowerCase().includes(term));
        }

        let privateHTML = '';
        if (membersToShow.length > 0) {
            const title = term === '' ? 'Letzte Chats' : 'Suchergebnisse';
            privateHTML = `
                <div>
                    <p class="px-3 mb-1 text-[10px] font-bold text-dark-muted uppercase tracking-wider opacity-70">${title}</p>
                    <div class="space-y-1">
                        ${membersToShow.map(m => this.renderContactItem('private', m.id, `${m.firstName} ${m.lastName}`, 'fa-user', 'blue', m.status)).join('')}
                    </div>
                </div>`;
        } else if (term !== '' && membersToShow.length === 0) {
            privateHTML = `<div class="p-4 text-center text-xs text-dark-muted italic">Keine Mitglieder gefunden</div>`;
        } else if (term === '' && membersToShow.length === 0) {
            privateHTML = `<div class="p-8 text-center text-xs text-dark-muted opacity-50 flex flex-col items-center"><i class="fa-regular fa-paper-plane text-2xl mb-2"></i>Starten Sie einen Chat über die Suche.</div>`;
        }

        container.innerHTML = `
            ${newsHTML}
            ${groupsHTML}
            ${privateHTML}
        `;
    },

    renderContactItem(type, id, name, icon, color, status) {
        const isActive = this.state.activeType === type && (type === 'news' || this.state.activeId === id);
        
        let statusDot = '';
        if (type === 'private' && status) {
            const statusColor = status === 'active' ? 'bg-green-500' : 'bg-gray-500';
            statusDot = `<span class="w-2.5 h-2.5 ${statusColor} rounded-full border-2 border-dark-card absolute bottom-0 right-0 shadow-sm"></span>`;
        }

        return `
            <button onclick="MessengerView.selectChat('${type}', ${id})" 
                class="w-full flex items-center gap-3 p-2.5 rounded-xl transition-all text-left group
                ${isActive ? 'bg-blue-600/10 border border-blue-500/30 shadow-sm' : 'hover:bg-dark-hover border border-transparent'}">
                
                <div class="relative w-10 h-10 rounded-full bg-${color}-500/10 text-${color}-400 flex items-center justify-center text-sm shrink-0 border border-${color}-500/20">
                    <i class="fa-solid ${icon}"></i>
                    ${statusDot}
                </div>
                
                <div class="flex-1 min-w-0">
                    <p class="text-sm font-bold ${isActive ? 'text-blue-400' : 'text-white'} truncate">${name}</p>
                    <p class="text-[10px] text-dark-muted truncate group-hover:text-dark-text transition-colors">Klicken zum Chatten</p>
                </div>
                
                ${isActive ? '<i class="fa-solid fa-chevron-right text-[10px] text-blue-500"></i>' : ''}
            </button>
        `;
    },

    selectChat(type, id) {
        this.state.activeType = type;
        this.state.activeId = id;
        this.state.showAttachMenu = false;
        this.state.showEmojiPicker = false;
        
        // Kompletten Render aufrufen, um Mobile-Switch (Sidebar -> Chat) auszulösen
        this.render(document.getElementById('content'));
    },

    // Mobile-Helper: Zurück zur Liste
    closeChat() {
        this.state.activeId = 0; // Kein Chat aktiv
        this.render(document.getElementById('content'));
    },

    renderActiveChat() {
        // Falls kein Chat ausgewählt ist (nur auf Desktop relevant, da Mobile ausgeblendet)
        if (this.state.activeId === 0 && this.state.activeType !== 'news') {
            return `
                <div class="flex flex-col items-center justify-center h-full text-dark-muted opacity-30 select-none">
                    <i class="fa-regular fa-comments text-6xl mb-4"></i>
                    <p class="text-sm">Wählen Sie einen Chat aus</p>
                </div>
            `;
        }

        const type = this.state.activeType;
        const id = this.state.activeId;
        let title = "";
        let messages = [];
        let canWrite = true;
        let icon = "";
        
        let headerClickAction = "";
        let headerCursorClass = "";
        let headerTitleHint = "";

        if (type === 'news') {
            title = "Ankündigungen";
            icon = "fa-bullhorn";
            messages = (Store.state.news || []).map(n => ({
                id: n.id,
                sender: 'Vorstand',
                text: `<strong>${n.title}</strong><br>${n.content}`,
                time: n.date,
                isMe: false,
                isSystem: true
            })).sort((a,b) => new Date(a.time) - new Date(b.time));
            canWrite = false;

        } else if (type === 'group') {
            const group = Store.state.groups.find(g => g.id === id);
            if (group) {
                title = group.name;
                icon = "fa-users";
                messages = group.chat || [];
                headerClickAction = `onclick="App.router('groups'); GroupsView.openGroup(${id})"`;
                headerCursorClass = "cursor-pointer hover:bg-white/5 rounded-lg pr-4 transition-colors";
                headerTitleHint = '<span class="text-[9px] md:text-[10px] text-blue-400 font-normal block -mt-0.5 truncate">Zur Gruppe <i class="fa-solid fa-arrow-up-right-from-square ml-1"></i></span>';
            } else {
                return `<div class="flex items-center justify-center h-full text-dark-muted">Gruppe nicht gefunden</div>`;
            }

        } else if (type === 'private') {
            const member = Store.state.members.find(m => m.id === id);
            if (member) {
                title = `${member.firstName} ${member.lastName}`;
                icon = "fa-user";
                if (!member.privateChat) member.privateChat = [];
                messages = member.privateChat;
                headerClickAction = `onclick="MessengerView.showUserProfile(${id})"`;
                headerCursorClass = "cursor-pointer hover:bg-white/5 rounded-lg pr-4 transition-colors";
                headerTitleHint = '<span class="text-[9px] md:text-[10px] text-blue-400 font-normal block -mt-0.5 truncate">Profil <i class="fa-solid fa-arrow-up-right-from-square ml-1"></i></span>';
            } else {
                return `<div class="flex items-center justify-center h-full text-dark-muted">Mitglied nicht gefunden</div>`;
            }
        }

        return `
            <!-- Chat Header -->
            <div class="h-16 border-b border-dark-border flex items-center gap-3 px-4 md:px-6 bg-dark-bg/95 backdrop-blur-md sticky top-0 z-10 shadow-sm">
                <!-- Mobile Back Button -->
                <button onclick="MessengerView.closeChat()" class="md:hidden w-8 h-8 flex items-center justify-center rounded-full text-dark-muted hover:text-white hover:bg-white/10 transition-colors mr-1">
                    <i class="fa-solid fa-arrow-left"></i>
                </button>

                <div class="flex items-center gap-3 flex-1 min-w-0 ${headerCursorClass}" ${headerClickAction} title="Details">
                    <div class="w-9 h-9 md:w-10 md:h-10 rounded-full bg-slate-700/50 flex items-center justify-center text-slate-300 border border-slate-600/50 flex-shrink-0">
                        <i class="fa-solid ${icon} text-sm md:text-base"></i>
                    </div>
                    <div class="min-w-0">
                        <h3 class="font-bold text-white text-sm md:text-base truncate">${title}</h3>
                        ${type === 'news' ? '<span class="text-[9px] bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded border border-red-500/30">READ ONLY</span>' : headerTitleHint}
                    </div>
                </div>
            </div>

            <!-- Messages Area -->
            <div id="msg-scroll-container" class="flex-1 overflow-y-auto p-4 md:p-6 space-y-3 md:space-y-4 custom-scrollbar bg-dark-card" 
                 onclick="if(MessengerView.state.showAttachMenu || MessengerView.state.showEmojiPicker) { MessengerView.state.showAttachMenu = false; MessengerView.state.showEmojiPicker = false; MessengerView.render(document.getElementById('content')); }">
                ${messages.length === 0 
                    ? `<div class="flex flex-col items-center justify-center h-full text-dark-muted opacity-40">
                         <i class="fa-regular fa-comments text-5xl mb-3"></i>
                         <p class="text-sm">Schreiben Sie die erste Nachricht...</p>
                       </div>` 
                    : messages.map(msg => this.renderMessageBubble(msg)).join('')}
            </div>

            <!-- Input Area -->
            <div class="border-t border-dark-border bg-dark-bg/50 backdrop-blur-sm relative z-20 pb-safe">
                ${canWrite ? `
                    <!-- Attachment Menu (Dropdown) -->
                    <div id="attach-menu" class="${this.state.showAttachMenu ? 'block' : 'hidden'} absolute bottom-full left-2 md:left-4 mb-2 bg-dark-card border border-dark-border rounded-xl shadow-2xl p-2 min-w-[200px] animate-in slide-in-from-bottom-2 fade-in duration-200 z-30">
                        <div class="grid grid-cols-1 gap-1">
                            <button onclick="MessengerView.sendAttachment('camera'); MessengerView.toggleAttachMenu()" class="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-dark-hover text-sm text-white transition-colors text-left">
                                <div class="w-6 text-center"><i class="fa-solid fa-camera text-blue-400"></i></div> Kamera
                            </button>
                            <button onclick="MessengerView.sendAttachment('image'); MessengerView.toggleAttachMenu()" class="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-dark-hover text-sm text-white transition-colors text-left">
                                <div class="w-6 text-center"><i class="fa-regular fa-image text-purple-400"></i></div> Galerie
                            </button>
                            <button onclick="MessengerView.sendAttachment('file'); MessengerView.toggleAttachMenu()" class="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-dark-hover text-sm text-white transition-colors text-left">
                                <div class="w-6 text-center"><i class="fa-solid fa-paperclip text-yellow-400"></i></div> Datei
                            </button>
                            <button onclick="MessengerView.sendAttachment('location'); MessengerView.toggleAttachMenu()" class="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-dark-hover text-sm text-white transition-colors text-left">
                                <div class="w-6 text-center"><i class="fa-solid fa-location-dot text-red-400"></i></div> Standort
                            </button>
                            <button onclick="MessengerView.openContactSelectModal(); MessengerView.toggleAttachMenu()" class="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-dark-hover text-sm text-white transition-colors text-left">
                                <div class="w-6 text-center"><i class="fa-solid fa-address-book text-orange-400"></i></div> Kontakt
                            </button>
                            <div class="h-px bg-dark-border my-1"></div>
                            <button onclick="MessengerView.openPollModal(); MessengerView.toggleAttachMenu()" class="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-dark-hover text-sm text-white transition-colors text-left">
                                <div class="w-6 text-center"><i class="fa-solid fa-square-poll-vertical text-green-400"></i></div> Umfrage
                            </button>
                        </div>
                    </div>

                    <!-- Emoji Picker -->
                    ${this.state.showEmojiPicker ? `
                        <div id="emoji-picker" class="absolute bottom-full right-2 md:right-4 mb-2 bg-dark-card border border-dark-border rounded-xl shadow-2xl p-2 w-[90vw] md:w-80 h-64 overflow-y-auto custom-scrollbar animate-in slide-in-from-bottom-2 fade-in duration-200 z-30 grid grid-cols-8 gap-1">
                            ${this.getEmojiList().map(e => `
                                <button onclick="MessengerView.addEmoji('${e}')" class="text-xl hover:bg-white/10 p-1.5 rounded transition-colors text-center">${e}</button>
                            `).join('')}
                        </div>
                    ` : ''}

                    <!-- Text Input Bar -->
                    <form onsubmit="MessengerView.sendMessage(event)" class="flex items-end gap-2 px-3 py-3 md:px-4">
                        <!-- Plus Button -->
                        <button type="button" onclick="MessengerView.toggleAttachMenu()" class="w-10 h-10 rounded-full bg-dark-bg border border-dark-border hover:border-blue-500/50 text-dark-muted hover:text-blue-400 transition-all flex items-center justify-center shrink-0 shadow-sm mb-px">
                            <i class="fa-solid fa-plus text-lg"></i>
                        </button>
                        
                        <!-- Textfeld -->
                        <div class="flex-1 bg-dark-bg border border-dark-border rounded-2xl flex items-center pr-1 focus-within:border-blue-500/50 focus-within:ring-1 focus-within:ring-blue-500/20 transition-all shadow-inner min-h-[44px]">
                            <input type="text" name="message" id="chat-input" autocomplete="off" placeholder="Nachricht..." 
                                class="flex-1 bg-transparent border-none px-4 py-3 text-white focus:outline-none text-sm h-full w-full">
                            
                            <button type="button" onclick="MessengerView.toggleEmojiPicker()" class="p-2 text-dark-muted hover:text-yellow-400 transition-colors ${this.state.showEmojiPicker ? 'text-yellow-400' : ''}">
                                <i class="fa-regular fa-face-smile text-lg"></i>
                            </button>
                        </div>

                        <!-- Mikrofon (Sprachnachricht) -->
                        <button type="button" onclick="MessengerView.sendAttachment('voice')" class="w-10 h-10 rounded-full bg-dark-bg border border-dark-border hover:bg-slate-700 text-dark-muted hover:text-white flex items-center justify-center transition-all shrink-0 mb-px shadow-sm">
                            <i class="fa-solid fa-microphone text-sm"></i>
                        </button>

                        <!-- Senden -->
                        <button type="submit" class="w-10 h-10 rounded-full bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center transition-all shadow-lg shadow-blue-900/20 hover:scale-105 active:scale-95 shrink-0 mb-px">
                            <i class="fa-solid fa-paper-plane text-sm"></i>
                        </button>
                    </form>
                ` : `
                    <div class="p-4 text-center text-dark-muted text-xs md:text-sm italic bg-dark-bg/50">
                        In diesem Kanal können nur Administratoren posten.
                    </div>
                `}
            </div>
        `;
    },

    renderMessageBubble(msg) {
        if (msg.isSystem) {
            return `
                <div class="flex justify-center my-4 animate-in fade-in zoom-in duration-300">
                    <div class="bg-slate-800/80 border border-slate-700/50 rounded-xl p-3 max-w-[85%] text-center shadow-sm backdrop-blur-sm">
                        <p class="text-[10px] text-red-400 font-bold uppercase mb-1 flex items-center justify-center gap-1">
                            <i class="fa-solid fa-bullhorn"></i> ${msg.sender}
                        </p>
                        <div class="text-sm text-slate-200 leading-snug">${msg.text}</div>
                        <span class="text-[9px] text-slate-500 mt-2 block">${new Date(msg.time).toLocaleDateString()}</span>
                    </div>
                </div>
            `;
        }

        const isMe = msg.isMe;
        const isDeleted = msg.isDeleted;
        
        const canDelete = (isMe || App.can('delete_content')) && !isDeleted;
        const canEdit = isMe && !isDeleted;
        
        let contentHtml = '';

        if (isDeleted) {
            contentHtml = `<span class="italic text-gray-400 flex items-center gap-2"><i class="fa-solid fa-ban text-xs"></i> 🚫 Gelöscht</span>`;
        } else {
            // Content Types
            if (msg.type === 'image') {
                contentHtml = `<img src="${msg.content}" class="rounded-lg max-w-full sm:max-w-[250px] mb-1 border border-white/10 cursor-pointer hover:opacity-90 transition-opacity" onclick="window.open('${msg.content}', '_blank')">`;
            } else if (msg.type === 'voice') {
                contentHtml = `
                    <div class="flex items-center gap-3 min-w-[160px] md:min-w-[200px]">
                        <button class="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center hover:bg-white/30 transition-colors"><i class="fa-solid fa-play text-xs"></i></button>
                        <div class="flex-1 h-1 bg-white/20 rounded-full relative"><div class="w-1/3 h-full bg-white rounded-full absolute left-0 top-0"></div></div>
                        <span class="text-[9px] opacity-70 tabular-nums">0:15</span>
                    </div>`;
            } else if (msg.type === 'file') {
                contentHtml = `
                    <div class="flex items-center gap-3 bg-black/20 p-2 rounded-lg min-w-[180px]">
                        <div class="w-8 h-8 rounded bg-white/10 flex items-center justify-center text-lg"><i class="fa-solid fa-file-lines"></i></div>
                        <div class="flex-1 min-w-0">
                            <p class="text-xs font-bold truncate">${msg.content}</p>
                            <p class="text-[9px] opacity-70">PDF • 2 MB</p>
                        </div>
                        <i class="fa-solid fa-download opacity-70 cursor-pointer p-1"></i>
                    </div>`;
            } else if (msg.type === 'location') {
                contentHtml = `
                    <div class="min-w-[180px]">
                        <div class="h-28 bg-slate-700 rounded-lg mb-2 flex items-center justify-center relative overflow-hidden group/map cursor-pointer">
                            <div class="absolute inset-0 bg-gradient-to-br from-slate-600 to-slate-800 opacity-50"></div>
                            <i class="fa-solid fa-map-location-dot text-white/20 text-6xl absolute"></i>
                            <i class="fa-solid fa-location-dot text-red-500 text-3xl drop-shadow-md z-10 animate-bounce"></i>
                        </div>
                        <p class="text-xs font-bold flex items-center"><i class="fa-solid fa-map-pin mr-1.5"></i> Aktueller Standort</p>
                    </div>`;
            } else if (msg.type === 'contact') {
                const c = msg.content;
                contentHtml = `
                    <div class="min-w-[180px] bg-white/5 p-2 rounded-lg border border-white/10 flex items-center gap-3 cursor-pointer hover:bg-white/10 transition-colors" onclick="MessengerView.showUserProfile(${c.id})">
                        <div class="w-9 h-9 rounded-full bg-slate-600 flex items-center justify-center text-white font-bold text-xs">
                            ${(c.name || 'U').charAt(0)}
                        </div>
                        <div class="flex-1 min-w-0">
                            <p class="text-xs font-bold truncate">${c.name}</p>
                            <p class="text-[9px] opacity-70 truncate">${c.role || 'Mitglied'}</p>
                        </div>
                        <i class="fa-solid fa-chevron-right text-[10px] opacity-50"></i>
                    </div>
                    <p class="text-[9px] mt-1 opacity-60 text-center uppercase tracking-wide">Kontakt geteilt</p>
                `;
            } else if (msg.type === 'poll') {
                const poll = msg.content;
                const totalVotes = poll.options.reduce((acc, opt) => acc + (opt.votes ? opt.votes.length : 0), 0);
                const myId = this.getMyId();
                
                contentHtml = `
                    <div class="min-w-[200px] w-full">
                        <p class="font-bold text-sm mb-3 border-b border-white/10 pb-2">${poll.question}</p>
                        <div class="space-y-2">
                            ${poll.options.map(opt => {
                                const votesCount = opt.votes ? opt.votes.length : 0;
                                const percent = totalVotes > 0 ? Math.round((votesCount / totalVotes) * 100) : 0;
                                const hasVoted = opt.votes && opt.votes.includes(myId);
                                return `
                                <div onclick="MessengerView.votePoll(${msg.id}, ${opt.id})" class="cursor-pointer group/poll relative">
                                    <div class="flex justify-between text-xs mb-1 relative z-10">
                                        <span class="${hasVoted ? 'font-bold text-white' : ''}">${opt.text} ${hasVoted ? '<i class="fa-solid fa-check-circle ml-1"></i>' : ''}</span>
                                        <span>${votesCount}</span>
                                    </div>
                                    <div class="h-2 bg-black/30 rounded-full overflow-hidden">
                                        <div class="h-full bg-white/80 group-hover/poll:bg-white transition-all" style="width: ${percent}%"></div>
                                    </div>
                                </div>
                                `;
                            }).join('')}
                        </div>
                        <p class="text-[9px] mt-2 opacity-60 text-right">${totalVotes} Stimmen • ${poll.multiple ? 'Mehrfach' : 'Single'}</p>
                    </div>`;
            } else {
                contentHtml = msg.text;
            }
        }

        // Action Menu (3 Punkte)
        let actionsHtml = '';
        if (canDelete || canEdit) {
            const menuId = `msg-menu-${msg.id}`;
            actionsHtml = `
                <div class="absolute top-1 right-2 z-20 opacity-0 group-hover/msg:opacity-100 transition-opacity text-start">
                    <button onclick="event.stopPropagation(); document.getElementById('${menuId}').classList.toggle('hidden')" 
                        class="text-white/60 hover:text-white p-1 rounded-full hover:bg-black/20 transition-colors w-6 h-6 flex items-center justify-center">
                        <i class="fa-solid fa-ellipsis-vertical text-[10px]"></i>
                    </button>
                    <!-- Dropdown -->
                    <div id="${menuId}" class="hidden absolute top-6 right-0 bg-dark-card border border-dark-border rounded-lg shadow-xl p-1 min-w-[100px] flex flex-col gap-0.5 z-30">
                        ${canEdit ? `<button onclick="event.stopPropagation(); document.getElementById('${menuId}').classList.add('hidden'); MessengerView.openEditMessageModal(${msg.id})" class="text-left text-xs text-white px-2 py-2 rounded hover:bg-dark-hover flex items-center gap-2 w-full"><i class="fa-solid fa-pen opacity-70"></i> Bearbeiten</button>` : ''}
                        ${canDelete ? `<button onclick="event.stopPropagation(); document.getElementById('${menuId}').classList.add('hidden'); MessengerView.deleteMessage(${msg.id})" class="text-left text-xs text-red-400 px-2 py-2 rounded hover:bg-dark-hover flex items-center gap-2 w-full"><i class="fa-solid fa-trash opacity-70"></i> Löschen</button>` : ''}
                    </div>
                </div>
            `;
        }

        let bubbleClass = isMe 
            ? 'bg-blue-600 text-white rounded-2xl rounded-br-sm' 
            : 'bg-slate-800 border border-slate-700/50 text-slate-200 rounded-2xl rounded-bl-sm';
            
        if (isDeleted) bubbleClass = 'bg-slate-800/50 border border-slate-700/50 text-slate-400 rounded-2xl';

        // Padding für Menü
        let paddingClass = 'px-3 py-2 md:px-4 md:py-2.5';
        if ((canDelete || canEdit) && !isDeleted) {
            paddingClass = 'pl-3 pr-7 py-2 md:pl-4 md:pr-8 md:py-2.5';
        }

        return `
            <div class="flex flex-col ${isMe ? 'items-end' : 'items-start'} animate-in fade-in slide-in-from-bottom-2 duration-300 group/msg relative mb-1">
                <div class="flex items-end gap-2 max-w-[85%] relative">
                    ${!isMe ? `<div class="w-6 h-6 rounded-full bg-slate-700 text-slate-400 text-[9px] flex items-center justify-center font-bold border border-slate-600 shrink-0 mb-1 select-none">${(msg.sender || '?').charAt(0)}</div>` : ''}
                    
                    <div class="relative ${paddingClass} shadow-sm text-sm leading-relaxed ${bubbleClass}">
                        ${actionsHtml}
                        ${contentHtml}
                    </div>
                </div>
                <div class="text-[9px] text-dark-muted mt-0.5 px-1 select-none flex items-center gap-1 ${isMe ? 'flex-row-reverse' : ''}">
                    ${!isMe ? `<span class="font-bold">${msg.sender}</span> •` : ''}
                    <span>${new Date(msg.time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                    ${msg.isEdited && !isDeleted ? '<span class="italic text-[8px] opacity-70">(bearbeitet)</span>' : ''}
                </div>
            </div>
        `;
    },

    // --- ACTIONS ---

    toggleAttachMenu() {
        this.state.showAttachMenu = !this.state.showAttachMenu;
        this.state.showEmojiPicker = false;
        this.render(document.getElementById('content'));
        setTimeout(() => {
            const input = document.getElementById('chat-input');
            if(input) input.focus();
        }, 50);
    },

    toggleEmojiPicker() {
        this.state.showEmojiPicker = !this.state.showEmojiPicker;
        this.state.showAttachMenu = false;
        this.render(document.getElementById('content'));
        setTimeout(() => {
            const input = document.getElementById('chat-input');
            if(input) input.focus();
        }, 50);
    },

    getEmojiList() {
        return ['😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇', '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚', '😋', '😛', '😝', '😜', '🤪', '🧐', '🤓', '😎', '🤩', '🥳', '😏', '😒', '😞', '😔', '😟', '😕', '🙁', '☹️', '😣', '😖', '😫', '😩', '🥺', '😢', '😭', '😤', '😠', '😡', '🤬', '🤯', '😳', '🥵', '🥶', '😱', '😨', '😰', '😥', '😓', '🤗', '🤔', '🤭', '🤫', '🤥', '😶', '😐', '😑', '😬', '🙄', '😯', '😦', '😧', '😮', '😲', '🥱', '😴', '🤤', '😪', '😵', '🤐', '🥴', '🤢', '🤮', '🤧', '😷', '🤒', '🤕', '🤑', '🤠', '😈', '👿', '👹', '👺', '🤡', '💩', '👻', '💀', '☠️', '👽', '👾', '🤖', '🎃', '😺', '😸', '😹', '😻', '😼', '😽', '🙀', '😿', '😾', '👋', '🤚', '🖐', '✋', '🖖', '👌', '🤏', '✌️', '🤞', '🤟', '🤘', '🤙', '👈', '👉', '👆', '🖕', '👇', '👍', '👎', '✊', '👊', '🤛', '🤜', '👏', '🙌', '👐', '🤲', '🤝', '🙏', '✍️', '💅', '🤳', '💪', '💋', '👄', '🦷', '👅', '👂', '🦻', '👃', '👣', '👁', '👀', '🧠', '🫀', '🫁', '🦴', '👶', '👧', '🧒', '👦', '👩', '🧑', '👨', '👵', '🧓', '👴', '👲', '👳‍♀️', '👳', '🧕', '👮‍♀️', '👮', '👷‍♀️', '👷', '💂‍♀️', '💂', '🕵️‍♀️', '🕵️', '👩‍⚕️', '👨‍⚕️', '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '⚽', '🏀', '🏈', '⚾', '🥎', '🏐', '🏉', '🥏', '🎱', '🏓', '🏸', '🏒', '🏑', '🏏', '🥅', '⛳', '🏹', '🎣', '🥊', '🥋', '🛹', '🛼', '⛷', '🏂', '🏋️‍♀️', '🏋️', '🤼‍♀️', '🤸‍♀️', '⛹️‍♀️', '⛹️', '🤺', '🤾‍♀️', '🏌️‍♀️', '🏇', '🧘‍♀️', '🧘', '🏄‍♀️', '🏊‍♀️', '🤽‍♀️', '🚣‍♀️', '🧗‍♀️', '🚵‍♀️', '🚴‍♀️', '🏆', '🥇', '🥈', '🥉', '🏅', '🎖', '🏵', '🎗', '🎫', '🎟', '🎪', '🤹', '🎭', '🎨', '🎬', '🎤', '🎧', '🎼', '🎹', '🥁', '🎷', '🎺', '🎸', '🎻', '🎲', '♟', '🎯', '🎳', '🎮', '🎰', '🧩'];
    },

    addEmoji(emoji) {
        const input = document.getElementById('chat-input');
        if(input) {
            input.value += emoji;
            input.focus();
        }
    },

    sendMessage(e) {
        e.preventDefault();
        const input = e.target.elements.message;
        const text = input.value.trim();
        if (!text) return;
        this.addMessageToChat({ text: text, type: 'text' });
        input.value = '';
        input.focus();
    },

    sendAttachment(type, contentData = null) {
        let content = '';
        let text = '';

        if (type === 'image') {
            content = 'https://picsum.photos/300/200'; // Simulation
            text = 'Foto gesendet';
        } else if (type === 'camera') {
            content = 'https://picsum.photos/300/200?random=' + Date.now(); // Simulation
            text = 'Kamera-Aufnahme gesendet';
        } else if (type === 'voice') {
            content = 'audio_dummy.mp3';
            text = 'Sprachnachricht';
        } else if (type === 'file') {
            const name = prompt("Dateiname:");
            if(!name) return;
            content = name;
            text = 'Datei gesendet';
        } else if (type === 'location') {
            content = '48.137, 11.576';
            text = 'Standort geteilt';
        } else if (type === 'contact') {
            content = contentData; 
            text = 'Kontakt geteilt';
        }

        this.addMessageToChat({ text: text, type: type, content: content });
    },

    // --- CONTACT SHARING ---

    openContactSelectModal() {
        const allMembers = Store.state.members || [];
        
        const html = `
            <div class="p-6 h-[500px] flex flex-col">
                <div class="flex justify-between items-center mb-4 border-b border-dark-border pb-4">
                    <h3 class="text-xl font-bold text-white">Kontakt teilen</h3>
                    <button onclick="App.closeModal()" class="text-dark-muted hover:text-white p-2"><i class="fa-solid fa-times text-xl"></i></button>
                </div>
                
                <input type="text" onkeyup="MessengerView.filterContactSelect(this)" placeholder="Mitglied suchen..." 
                    class="w-full bg-dark-bg border border-dark-border rounded-xl px-4 py-2 text-white focus:outline-none focus:border-blue-500 mb-4">

                <div id="share-contact-list" class="flex-1 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                    ${allMembers.map(m => `
                        <div class="share-contact-item flex justify-between items-center p-3 rounded-lg bg-dark-bg border border-dark-border hover:border-blue-500/50 cursor-pointer transition-colors"
                             onclick="MessengerView.confirmShareContact(${m.id}, '${m.firstName} ${m.lastName}', '${m.role}')">
                            <div class="flex items-center gap-3">
                                <div class="w-10 h-10 rounded-full bg-slate-700 text-white flex items-center justify-center font-bold">
                                    ${(m.firstName || 'U').charAt(0)}${(m.lastName || '').charAt(0)}
                                </div>
                                <div>
                                    <p class="text-sm font-bold text-white contact-name">${m.firstName} ${m.lastName}</p>
                                    <p class="text-xs text-dark-muted">${m.role}</p>
                                </div>
                            </div>
                            <i class="fa-solid fa-share text-blue-500"></i>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
        App.openModal(html);
    },

    filterContactSelect(input) {
        const filter = input.value.toLowerCase();
        const items = document.querySelectorAll('.share-contact-item');
        items.forEach(item => {
            const name = item.querySelector('.contact-name').textContent.toLowerCase();
            item.style.display = name.includes(filter) ? 'flex' : 'none';
        });
    },

    confirmShareContact(id, name, role) {
        this.sendAttachment('contact', { id, name, role });
        App.closeModal();
    },

    showUserProfile(id) {
        const m = Store.state.members.find(mem => mem.id == id);
        if(!m) return;

        const html = `
            <div class="p-8">
                <div class="flex justify-between items-start mb-8 border-b border-dark-border pb-6">
                    <div class="flex items-center gap-5">
                        <div class="w-20 h-20 rounded-full bg-blue-600 flex items-center justify-center text-3xl font-bold text-white shadow-lg">
                            ${(m.firstName || 'U').charAt(0)}${(m.lastName || '').charAt(0)}
                        </div>
                        <div>
                            <h2 class="text-3xl font-bold text-white leading-tight">${m.firstName} ${m.lastName}</h2>
                            <p class="text-blue-400 font-medium text-lg mt-1">${m.role}</p>
                        </div>
                    </div>
                    <button onclick="App.closeModal()" class="text-dark-muted hover:text-white p-2 transition-colors"><i class="fa-solid fa-times text-2xl"></i></button>
                </div>
                <div class="space-y-4 mb-8">
                    <div class="bg-dark-bg p-5 rounded-xl border border-dark-border">
                        <h4 class="text-xs font-bold text-dark-muted uppercase tracking-wider mb-4">Gruppen</h4>
                        <div class="flex flex-wrap gap-2">
                            ${Array.isArray(m.groups) ? m.groups.map(g => `<span class="bg-blue-900/30 text-blue-300 px-3 py-1 rounded-full text-sm border border-blue-500/30">${g}</span>`).join('') : '<span class="text-dark-muted">Keine Gruppen</span>'}
                        </div>
                    </div>
                </div>
                <button onclick="MessengerView.startPrivateChat(${m.id})" class="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-bold transition-colors shadow-lg shadow-blue-900/20 text-lg">
                    <i class="fa-solid fa-comments mr-2"></i> Nachricht senden
                </button>
            </div>
        `;
        App.openModal(html);
    },

    startPrivateChat(id) {
        App.closeModal();
        this.selectChat('private', id);
    },

    // --- MESSAGE MANAGEMENT ---

    deleteMessage(msgId) {
        if(!confirm("Nachricht wirklich löschen?")) return;
        this.updateMessage(msgId, (msg) => {
            msg.isDeleted = true;
            msg.text = '🚫 Nachricht gelöscht';
            msg.type = 'text';
        });
    },

    openEditMessageModal(msgId) {
        let msg = null;
        const chat = this.getActiveChatArray();
        if(chat) msg = chat.find(m => m.id === msgId);

        if(!msg || msg.isDeleted) return;

        const html = `
            <div class="p-6">
                <h3 class="text-xl font-bold text-white mb-4">Nachricht bearbeiten</h3>
                <form onsubmit="MessengerView.handleEditMessage(event, ${msgId})">
                    <textarea name="text" class="form-input h-32 mb-4" required>${msg.text}</textarea>
                    <button type="submit" class="btn-primary w-full">Speichern</button>
                </form>
            </div>
        `;
        App.openModal(html);
    },

    handleEditMessage(e, msgId) {
        e.preventDefault();
        const text = new FormData(e.target).get('text');
        this.updateMessage(msgId, (msg) => {
            msg.text = text;
            msg.isEdited = true;
        });
        App.closeModal();
    },

    updateMessage(msgId, updateFn) {
        const type = this.state.activeType;
        const id = this.state.activeId;
        let chat = null;
        let parentObj = null;
        let table = '';

        if (type === 'group') {
            parentObj = Store.state.groups.find(g => g.id === id);
            if(parentObj) {
                chat = parentObj.chat;
                table = 'groups';
            }
        } else if (type === 'private') {
            parentObj = Store.state.members.find(m => m.id === id);
            if(parentObj) {
                chat = parentObj.privateChat;
                table = 'members';
            }
        }

        if(chat && parentObj) {
            const msg = chat.find(m => m.id === msgId);
            if(msg) {
                updateFn(msg);
                // UPDATE STATT SAVE
                Store.update(table, parentObj);
                const chatArea = document.getElementById('messenger-chat-area');
                if (chatArea) chatArea.innerHTML = this.renderActiveChat();
            }
        }
    },

    getActiveChatArray() {
        const type = this.state.activeType;
        const id = this.state.activeId;
        if (type === 'group') {
            const group = Store.state.groups.find(g => g.id === id);
            return group ? group.chat : null;
        } else if (type === 'private') {
            const member = Store.state.members.find(m => m.id === id);
            return member ? member.privateChat : null;
        }
        return null;
    },

    // --- POLL SYSTEM ---

    openPollModal() {
        const html = `
            <div class="p-6">
                <div class="flex justify-between items-center mb-4 border-b border-dark-border pb-4">
                    <h3 class="text-xl font-bold text-white">Umfrage erstellen</h3>
                    <button onclick="App.closeModal()" class="text-dark-muted hover:text-white p-2"><i class="fa-solid fa-times text-xl"></i></button>
                </div>
                <form onsubmit="MessengerView.createPoll(event)">
                    <div class="mb-4">
                        <label class="text-muted">Frage / Titel</label>
                        <input type="text" name="question" required class="form-input" placeholder="Wann ist Training?">
                    </div>
                    
                    <div class="mb-4">
                        <label class="text-muted">Optionen</label>
                        <div id="poll-options-container" class="space-y-2">
                            <input type="text" name="option[]" required class="form-input" placeholder="Option 1">
                            <input type="text" name="option[]" required class="form-input" placeholder="Option 2">
                        </div>
                        <button type="button" onclick="MessengerView.addPollOptionInput()" class="text-xs text-blue-400 mt-2 hover:underline">+ Option hinzufügen</button>
                    </div>

                    <div class="mb-6 flex items-center">
                        <input type="checkbox" name="multiple" id="pollMulti" class="w-4 h-4 rounded bg-dark-bg border-dark-border accent-blue-600">
                        <label for="pollMulti" class="ml-2 text-sm text-dark-muted cursor-pointer">Mehrfachauswahl erlauben</label>
                    </div>

                    <button type="submit" class="btn-primary w-full">Umfrage senden</button>
                </form>
            </div>
        `;
        App.openModal(html);
    },

    addPollOptionInput() {
        const container = document.getElementById('poll-options-container');
        const count = container.children.length + 1;
        const input = document.createElement('input');
        input.type = 'text';
        input.name = 'option[]';
        input.required = true;
        input.className = 'form-input';
        input.placeholder = `Option ${count}`;
        container.appendChild(input);
    },

    createPoll(e) {
        e.preventDefault();
        const fd = new FormData(e.target);
        const question = fd.get('question');
        const multiple = fd.get('multiple') === 'on';
        const options = fd.getAll('option[]').map((opt, idx) => ({
            id: idx,
            text: opt,
            votes: []
        }));

        const pollData = {
            question,
            multiple,
            options
        };

        this.addMessageToChat({ text: 'Umfrage: ' + question, type: 'poll', content: pollData });
        App.closeModal();
    },

    votePoll(msgId, optionId) {
        const type = this.state.activeType;
        const id = this.state.activeId;
        let messages = null;
        let parentObj = null;
        let table = '';

        if (type === 'group') {
            parentObj = Store.state.groups.find(g => g.id === id);
            if(parentObj) {
                messages = parentObj.chat;
                table = 'groups';
            }
        } else if (type === 'private') {
            parentObj = Store.state.members.find(m => m.id === id);
            if(parentObj) {
                messages = parentObj.privateChat;
                table = 'members';
            }
        }

        if(messages && parentObj) {
            const msg = messages.find(m => m.id === msgId);
            if(msg && msg.type === 'poll') {
                const poll = msg.content;
                const myId = this.getMyId();
                
                const option = poll.options.find(o => o.id === optionId);
                
                if(option) {
                    if(!option.votes) option.votes = [];
                    const hasVoted = option.votes.includes(myId);
                    
                    if(hasVoted) {
                        option.votes = option.votes.filter(v => v !== myId);
                    } else {
                        if(!poll.multiple) {
                            poll.options.forEach(o => {
                                if(o.votes) o.votes = o.votes.filter(v => v !== myId);
                            });
                        }
                        option.votes.push(myId);
                    }
                    
                    // UPDATE STATT SAVE
                    Store.update(table, parentObj);
                    const chatArea = document.getElementById('messenger-chat-area');
                    if (chatArea) chatArea.innerHTML = this.renderActiveChat();
                }
            }
        }
    },

    // --- HELPER ---

    addMessageToChat(msgData) {
        const myId = this.getMyId();
        const me = Store.state.members.find(m => m.id == myId) || { firstName: 'Ich' };
        
        const newMessage = {
            id: Date.now(),
            text: msgData.text,
            type: msgData.type || 'text',
            content: msgData.content || null,
            sender: me.firstName, 
            isMe: true,
            isEdited: false,
            isDeleted: false,
            time: new Date().toISOString()
        };

        const type = this.state.activeType;
        const id = this.state.activeId;
        let parentObj = null;
        let table = '';

        if (type === 'group') {
            parentObj = Store.state.groups.find(g => g.id === id);
            if (parentObj) {
                if(!parentObj.chat) parentObj.chat = [];
                parentObj.chat.push(newMessage);
                table = 'groups';
            }
        } else if (type === 'private') {
            parentObj = Store.state.members.find(m => m.id === id);
            if (parentObj) {
                if(!parentObj.privateChat) parentObj.privateChat = [];
                parentObj.privateChat.push(newMessage);
                table = 'members';
            }
        }

        if(parentObj) {
            // UPDATE STATT SAVE
            Store.update(table, parentObj);
            
            const chatArea = document.getElementById('messenger-chat-area');
            if (chatArea) {
                chatArea.innerHTML = this.renderActiveChat();
                this.scrollToBottom();
            }
            if (this.state.filterTerm === '') this.renderSidebarList();
        }
    },

    scrollToBottom() {
        const container = document.getElementById('msg-scroll-container');
        if (container) {
            container.scrollTop = container.scrollHeight;
        }
    }
};

// WICHTIG: Global verfügbar machen für die neue App.js
window.MessengerView = MessengerView;
