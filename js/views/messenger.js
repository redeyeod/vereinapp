/**
 * =============================================================================
 * MODERN MESSENGER VIEW (WhatsApp/Signal Style)
 * Optimiert für Mobile & Desktop
 * =============================================================================
 */

const MessengerView = {
    // Lokaler State
    state: {
        activeType: 'news', // 'news', 'group', 'private'
        activeId: 0,        // 0 = kein Chat
        filterTerm: '',
        showAttachMenu: false,
        showEmojiPicker: false,
        mobileChatVisible: false,
        // Cache für Scroll-Positionen
        scrollPositions: {}
    },

    // Farben und Styles Konfiguration (WhatsApp Dark Mode Palette)
    config: {
        accentColor: 'bg-[#00a884]', 
        accentColorHover: 'hover:bg-[#008f6f]',
        myMessageBg: 'bg-[#005c4b]',
        otherMessageBg: 'bg-[#202c33]',
        pageBg: 'bg-[#111b21]',
        sidebarBg: 'bg-[#111b21]',
        headerBg: 'bg-[#202c33]',
        border: 'border-[#2a3942]',
        textMain: 'text-[#e9edef]',
        textMuted: 'text-[#8696a0]'
    },

    // Helper: Current User ID
    getMyId() {
        return (App.state.currentUser && App.state.currentUser.id) || localStorage.getItem('vm_current_user_id') || 1;
    },

    // Initialisierung: Styles injizieren (Hintergrundmuster & Scrollbars)
    init() {
        this.injectStyles();
    },

    injectStyles() {
        if (document.getElementById('messenger-custom-styles')) return;
        const style = document.createElement('style');
        style.id = 'messenger-custom-styles';
        style.innerHTML = `
            /* Chat Hintergrund Muster */
            .msg-bg-pattern {
                background-color: #0b141a;
                background-image: url("data:image/svg+xml,%3Csvg width='100' height='100' viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M11 18c3.866 0 7-3.134 7-7s-3.134-7-7-7-7 3.134-7 7 3.134 7 7 7zm48 25c3.866 0 7-3.134 7-7s-3.134-7-7-7-7 3.134-7 7 3.134 7 7 7zm-43-7c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zm63 31c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zM34 90c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zm56-76c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zM12 86c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm28-65c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm23-11c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm-6 60c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm29 22c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zM32 63c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm57-13c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm-9-21c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zM60 91c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zM35 41c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zM12 60c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2z' fill='%232a3942' fill-opacity='0.2' fill-rule='evenodd'/%3E%3C/svg%3E");
            }
            .custom-scrollbar::-webkit-scrollbar { width: 5px; }
            .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
            .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(134, 150, 160, 0.3); border-radius: 4px; }
            .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(134, 150, 160, 0.5); }
            
            /* Bubble Tails (Sprechblasen Ecken) */
            .bubble-tail-in { border-top-left-radius: 0 !important; }
            .bubble-tail-out { border-top-right-radius: 0 !important; }
            
            /* Animation für Modal/Popups */
            @keyframes slideUp { from { transform: translateY(100%); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
            .animate-slide-up { animation: slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1); }
        `;
        document.head.appendChild(style);
    },

    // --- CHAT LOGIC ---

    // Holt Chat-Daten aus dem User-Objekt und FILTERT sie für den aktuellen Partner
    getMemberChat(partner) {
         const myId = this.getMyId();
         
         // 1. Wir schauen in MEINEM User-Objekt nach Nachrichten (Single Source of Truth für meine Ansicht)
         const me = Store.state.members.find(m => m.id == myId);
         
         // Fallback: Falls noch nichts da ist
         const allMessages = (me && me.privateChat) ? me.privateChat : [];
         
         // 2. Filter: Zeige nur Nachrichten, die zwischen MIR und dem PARTNER ausgetauscht wurden
         // Dazu prüfen wir senderId und recipientId
         return allMessages.filter(msg => {
             // Nachricht von Mir an Partner ODER von Partner an Mich
             return (msg.senderId == myId && msg.recipientId == partner.id) ||
                    (msg.senderId == partner.id && msg.recipientId == myId);
         });
    },

    /**
     * Haupt-Render Funktion
     */
    render(container) {
        this.init();
        const { mobileChatVisible } = this.state;
        const C = this.config;

        // Container-Grundgerüst
        container.innerHTML = `
            <div class="flex h-[calc(100vh-80px)] md:h-[calc(100vh-100px)] max-w-[1600px] mx-auto overflow-hidden bg-black shadow-2xl relative rounded-xl border border-[#333]">
                <!-- LEFT SIDEBAR -->
                <div class="${mobileChatVisible ? 'hidden md:flex' : 'flex'} w-full md:w-[400px] lg:w-[450px] flex-col ${C.sidebarBg} border-r ${C.border} z-20">
                    <!-- Header Sidebar -->
                    <div class="h-16 px-4 ${C.headerBg} flex items-center justify-between shrink-0 border-b ${C.border}">
                        <div class="flex items-center gap-3">
                            <div class="w-10 h-10 rounded-full bg-slate-600 overflow-hidden cursor-pointer hover:opacity-80 transition flex items-center justify-center">
                                <i class="fa-solid fa-user text-slate-300"></i>
                            </div>
                            <h2 class="font-bold text-white tracking-wide">Chats</h2>
                        </div>
                        <div class="flex gap-4 text-slate-400">
                             <button class="hover:text-white transition"><i class="fa-solid fa-circle-notch"></i></button>
                             <button class="hover:text-white transition"><i class="fa-solid fa-message"></i></button>
                             <button class="hover:text-white transition"><i class="fa-solid fa-ellipsis-vertical"></i></button>
                        </div>
                    </div>
                    <!-- Search Bar -->
                    <div class="p-3 ${C.sidebarBg} border-b ${C.border}">
                        <div class="relative bg-[#202c33] rounded-lg flex items-center px-3 h-9 focus-within:bg-[#202c33]/80 transition-colors">
                            <i class="fa-solid fa-magnifying-glass text-[#8696a0] text-sm cursor-pointer ${this.state.filterTerm ? 'hidden' : 'block'}"></i>
                            <button class="${this.state.filterTerm ? 'block' : 'hidden'} text-[#00a884]" onclick="MessengerView.handleSearch('')">
                                <i class="fa-solid fa-arrow-left"></i>
                            </button>
                            <input type="text" placeholder="Suchen oder neuer Chat" value="${this.state.filterTerm}" onkeyup="MessengerView.handleSearch(this.value)" id="messenger-search-input" class="bg-transparent border-none text-[#d1d7db] text-sm w-full ml-3 focus:outline-none placeholder-[#8696a0] h-full">
                        </div>
                    </div>
                    <!-- Chat List -->
                    <div id="messenger-list" class="flex-1 overflow-y-auto custom-scrollbar"></div>
                </div>
                <!-- RIGHT MAIN -->
                <div id="messenger-chat-area" class="${mobileChatVisible ? 'flex fixed inset-0 z-50 md:static' : 'hidden md:flex'} flex-col flex-1 bg-[#0b141a] relative w-full h-full">
                    ${this.renderActiveChat()}
                </div>
            </div>
        `;
        this.renderSidebarList();
        if (mobileChatVisible || window.innerWidth >= 768) this.scrollToBottom(false);
        const input = document.getElementById('messenger-search-input');
        if(input && this.state.filterTerm) { input.focus(); input.value = ''; input.value = this.state.filterTerm; }
    },

    handleSearch(val) {
        this.state.filterTerm = val.toLowerCase();
        this.renderSidebarList();
    },

    renderSidebarList() {
        const container = document.getElementById('messenger-list');
        if(!container) return;
        const term = this.state.filterTerm;
        const myId = this.getMyId();
        const members = Store.state.members || [];
        const groups = Store.state.groups || [];
        const me = members.find(m => m.id == myId) || { groups: [] };
        const C = this.config;
        const myGroupNames = Array.isArray(me.groups) ? me.groups : (me.group && me.group !== 'Keine' ? [me.group] : []);
        let items = [];

        if ('ankündigungen'.includes(term) || !term) {
            items.push({ type: 'news', id: 0, name: 'Ankündigungen', icon: 'fa-bullhorn', color: 'text-yellow-500', time: new Date() });
        }

        const myGroups = groups.filter(g => myGroupNames.includes(g.name));
        myGroups.forEach(g => {
            if (g.name.toLowerCase().includes(term)) {
                const lastMsg = g.chat && g.chat.length > 0 ? g.chat[g.chat.length-1] : null;
                items.push({ type: 'group', id: g.id, name: g.name, icon: 'fa-users', color: 'text-blue-400', lastMsg: lastMsg, time: lastMsg ? new Date(lastMsg.time) : new Date(0) });
            }
        });

        const allMembers = members.filter(m => m.id != myId);
        allMembers.forEach(m => {
            const name = `${m.firstName} ${m.lastName}`;
            const chat = this.getMemberChat(m); // Nutze neuen Filter-Helper
            const hasChat = chat.length > 0;
            if (term && name.toLowerCase().includes(term)) {
                items.push({ type: 'private', id: m.id, name: name, icon: 'fa-user', color: 'text-slate-400', lastMsg: hasChat ? chat[chat.length-1] : null, time: hasChat ? new Date(chat[chat.length-1].time) : new Date(0), status: m.status });
            } else if (!term && hasChat) {
                items.push({ type: 'private', id: m.id, name: name, icon: 'fa-user', color: 'text-slate-400', lastMsg: chat[chat.length-1], time: new Date(chat[chat.length-1].time), status: m.status });
            }
        });

        items.sort((a, b) => b.time - a.time);

        if (items.length === 0) {
            container.innerHTML = `<div class="p-8 text-center ${C.textMuted} text-sm">Keine Chats gefunden.<br>Suche nach einem Mitglied.</div>`;
            return;
        }
        container.innerHTML = items.map(item => this.renderListItem(item)).join('');
    },

    renderListItem(item) {
        const isActive = this.state.activeType === item.type && (item.type === 'news' || this.state.activeId === item.id);
        const C = this.config;
        let preview = "Klicken um zu starten";
        let dateStr = "";
        
        if (item.lastMsg) {
            const txt = item.lastMsg.text || (item.lastMsg.type === 'image' ? '📷 Foto' : '📎 Datei');
            preview = (item.lastMsg.isMe ? '<span class="text-[#00a884] mr-1"><i class="fa-solid fa-check-double"></i></span>' : '') + txt;
            const d = new Date(item.lastMsg.time);
            const today = new Date();
            dateStr = (d.toDateString() === today.toDateString()) ? d.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : d.toLocaleDateString([], {day: '2-digit', month: '2-digit', year:'2-digit'});
        } else if (item.type === 'news') preview = "Neuigkeiten vom Verein";

        const bgClass = isActive ? 'bg-[#2a3942]' : 'hover:bg-[#202c33]';

        return `
            <div onclick="MessengerView.selectChat('${item.type}', ${item.id})" class="flex items-center gap-3 p-3 cursor-pointer transition-colors border-b border-[#202c33] ${bgClass} group">
                <div class="relative w-12 h-12 rounded-full bg-[#6a7f8a] flex items-center justify-center shrink-0 overflow-hidden">
                    ${item.type === 'private' ? `<div class="font-bold text-white text-lg">${item.name.charAt(0)}</div>` : `<i class="fa-solid ${item.icon} text-white text-xl"></i>`}
                </div>
                <div class="flex-1 min-w-0 flex flex-col justify-center">
                    <div class="flex justify-between items-baseline">
                        <h3 class="text-[#e9edef] font-normal text-[17px] truncate">${item.name}</h3>
                        <span class="text-xs text-[#8696a0] shrink-0">${dateStr}</span>
                    </div>
                    <div class="flex justify-between items-center mt-0.5">
                        <p class="text-[#8696a0] text-sm truncate pr-2 w-full group-hover:text-[#d1d7db] transition-colors">${preview}</p>
                    </div>
                </div>
            </div>
        `;
    },

    selectChat(type, id) {
        this.state.activeType = type;
        this.state.activeId = id;
        this.state.showAttachMenu = false;
        this.state.showEmojiPicker = false;
        this.state.mobileChatVisible = true;
        this.render(document.getElementById('content'));
    },

    closeChat() {
        this.state.mobileChatVisible = false;
        this.render(document.getElementById('content'));
    },

    renderActiveChat() {
        const C = this.config;
        if (!this.state.mobileChatVisible && this.state.activeId === 0 && this.state.activeType !== 'news') {
            return `<div class="flex flex-col items-center justify-center h-full bg-[#222e35] text-center border-b-[6px] border-[#00a884]">
                    <div class="mb-5"><i class="fa-regular fa-comments text-[#41525d] text-7xl"></i></div>
                    <h2 class="text-[#e9edef] text-3xl font-light mb-4">Vereins Messenger</h2>
                    <p class="text-[#8696a0] text-sm">Senden und empfangen Sie Nachrichten in Echtzeit.<br>Wählen Sie einen Chat aus, um zu beginnen.</p></div>`;
        }

        const type = this.state.activeType;
        const id = this.state.activeId;
        let title = "Chat";
        let subTitle = "";
        let messages = [];
        let canWrite = true;

        if (type === 'news') {
            title = "Ankündigungen"; subTitle = "Nur Administratoren";
            messages = (Store.state.news || []).map(n => ({ id: n.id, sender: 'Vorstand', text: `📢 **${n.title}**\n\n${n.content}`, time: n.date, isMe: false, isSystem: true })).sort((a,b) => new Date(a.time) - new Date(b.time));
            canWrite = false;
        } else if (type === 'group') {
            const g = Store.state.groups.find(x => x.id === id);
            if(g) { title = g.name; subTitle = 'Tippen für Gruppeninfo'; messages = g.chat || []; }
        } else if (type === 'private') {
            const m = Store.state.members.find(x => x.id === id);
            if(m) { 
                title = `${m.firstName} ${m.lastName}`; 
                subTitle = m.status === 'active' ? 'Online' : 'Zuletzt online heute'; 
                // LOAD CHAT from Helper (gefiltert)
                messages = this.getMemberChat(m);
            }
        }

        return `
            <div class="h-16 px-4 py-2 ${C.headerBg} flex items-center justify-between shadow-sm z-30 shrink-0 border-l border-[#2a3942]">
                <div class="flex items-center gap-3 overflow-hidden cursor-pointer" onclick="${type === 'private' ? `MessengerView.showUserProfile(${id})` : ''}">
                    <button onclick="event.stopPropagation(); MessengerView.closeChat()" class="md:hidden text-[#d1d7db] mr-1"><i class="fa-solid fa-arrow-left text-xl"></i></button>
                    <div class="w-10 h-10 rounded-full bg-[#6a7f8a] flex items-center justify-center overflow-hidden">
                        ${type === 'private' ? `<span class="font-bold text-white text-lg">${title.charAt(0)}</span>` : '<i class="fa-solid fa-users text-white"></i>'}
                    </div>
                    <div class="flex flex-col justify-center overflow-hidden">
                        <h3 class="text-[#e9edef] font-bold text-base truncate leading-tight">${title}</h3>
                        <p class="text-[#8696a0] text-xs truncate leading-tight">${subTitle}</p>
                    </div>
                </div>
                <div class="flex items-center gap-4 text-[#8696a0]">
                    <button class="hover:text-white transition"><i class="fa-solid fa-search"></i></button>
                    <button class="hover:text-white transition"><i class="fa-solid fa-ellipsis-vertical"></i></button>
                </div>
            </div>

            <div id="msg-scroll-container" class="flex-1 overflow-y-auto p-4 md:px-10 space-y-2 msg-bg-pattern custom-scrollbar relative">
                ${messages.length === 0 ? `
                    <div class="flex justify-center mt-10"><span class="bg-[#1f2c34] text-[#ffd279] text-xs px-3 py-1.5 rounded-lg shadow-sm border border-[#2a3942]">🔒 Nachrichten sind Ende-zu-Ende verschlüsselt.</span></div>
                    <div class="text-center mt-20 text-[#8696a0] opacity-60"><i class="fa-regular fa-comments text-4xl mb-2"></i><p>Noch keine Nachrichten.</p></div>
                ` : messages.map(msg => this.renderMessageBubble(msg)).join('')}
                <div class="h-2"></div>
            </div>

            ${canWrite ? `
                <div class="min-h-[62px] ${C.headerBg} px-4 py-2 flex items-end gap-2 z-30 relative shrink-0 border-l border-[#2a3942]">
                    ${this.renderAttachMenu()} ${this.renderEmojiPicker()}
                    <button onclick="MessengerView.toggleAttachMenu()" class="mb-3 text-[#8696a0] hover:text-[#d1d7db] transition w-8 text-center text-xl"><i class="fa-solid fa-plus"></i></button>
                    <form onsubmit="MessengerView.sendMessage(event)" class="flex-1 flex items-end gap-2 mb-1.5">
                        <div class="flex-1 bg-[#2a3942] rounded-lg flex items-end min-h-[42px] py-2 px-3 relative border border-transparent focus-within:border-transparent transition-all">
                            <button type="button" onclick="MessengerView.toggleEmojiPicker()" class="text-[#8696a0] hover:text-[#ffde34] transition mr-3 text-lg mb-0.5"><i class="fa-regular fa-face-smile"></i></button>
                            <input type="text" name="message" id="chat-input" autocomplete="off" placeholder="Nachricht eingeben" class="bg-transparent border-none text-[#d1d7db] text-sm w-full focus:outline-none placeholder-[#8696a0] max-h-32 overflow-y-auto leading-relaxed">
                        </div>
                        <button type="submit" class="w-10 h-10 flex items-center justify-center rounded-full ${C.accentColor} ${C.accentColorHover} text-white shadow-md transition-transform active:scale-95 mb-0.5"><i class="fa-solid fa-paper-plane text-sm pl-0.5"></i></button>
                    </form>
                </div>
            ` : `<div class="p-4 ${C.headerBg} text-center text-[#8696a0] text-sm border-t ${C.border}">Nur Administratoren können hier senden.</div>`}
        `;
    },

    renderMessageBubble(msg) {
        if (msg.isSystem) {
            return `<div class="flex justify-center my-3"><div class="bg-[#1f2c34] text-[#8696a0] text-xs px-3 py-1.5 rounded-lg shadow uppercase font-bold tracking-wide">${msg.sender}: ${msg.text.replace(/\*\*(.*?)\*\*/g, '$1')}</div></div>`;
        }
        const isMe = msg.isMe;
        const isDeleted = msg.isDeleted;
        const C = this.config;
        const bubbleColor = isMe ? C.myMessageBg : C.otherMessageBg;
        const align = isMe ? 'items-end' : 'items-start';
        const tailClass = isMe ? 'bubble-tail-out' : 'bubble-tail-in';
        
        let contentHtml = '';
        if (isDeleted) {
            contentHtml = `<span class="italic text-[#8696a0] flex items-center gap-1 text-sm"><i class="fa-solid fa-ban text-xs"></i> Gelöscht</span>`;
        } else {
            let formatted = (msg.text || '').replace(/\n/g, '<br>');
            if (msg.type === 'image') {
                contentHtml = `<div class="mb-1 rounded-lg overflow-hidden cursor-pointer bg-black/20" onclick="window.open('${msg.content}', '_blank')"><img src="${msg.content}" class="max-w-full sm:max-w-[300px] max-h-[300px] object-cover hover:opacity-90 transition"></div>${formatted ? `<p class="text-sm">${formatted}</p>` : ''}`;
            } else if (msg.type === 'file') {
                contentHtml = `<div class="flex items-center gap-3 bg-black/20 p-3 rounded-lg min-w-[200px] mb-1 cursor-pointer hover:bg-black/30 transition"><div class="w-8 h-8 bg-[#f83f3f] rounded flex items-center justify-center text-white"><i class="fa-solid fa-file-pdf"></i></div><div class="flex-1 overflow-hidden"><p class="text-sm truncate text-white">${msg.content}</p><p class="text-[10px] text-[#8696a0]">PDF • 3 Seiten</p></div><i class="fa-solid fa-download text-[#8696a0]"></i></div>`;
            } else if (msg.type === 'poll') {
                const poll = msg.content;
                contentHtml = `<div class="min-w-[220px]"><p class="font-bold text-[#e9edef] text-base mb-3">${poll.question}</p><div class="space-y-2">${poll.options.map(opt => { const votes = opt.votes ? opt.votes.length : 0; const myId = this.getMyId(); const hasVoted = opt.votes && opt.votes.includes(myId); return `<div onclick="MessengerView.votePoll(${msg.id}, ${opt.id})" class="cursor-pointer relative p-2 rounded border ${hasVoted ? 'border-[#00a884] bg-[#00a884]/10' : 'border-[#2a3942] hover:bg-white/5'} transition-all"><div class="flex justify-between text-sm mb-1"><span class="text-[#e9edef]">${opt.text}</span><span class="text-[#8696a0]">${votes}</span></div></div>`; }).join('')}</div><p class="text-[10px] text-[#8696a0] mt-2 text-center">Tippe zum Abstimmen</p></div>`;
            } else {
                contentHtml = `<span class="text-sm md:text-[15px] leading-relaxed text-[#e9edef]">${formatted}</span>`;
            }
        }

        const time = new Date(msg.time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        const statusIcon = isMe ? `<span class="text-[#53bdeb] ml-1 text-[10px]"><i class="fa-solid fa-check-double"></i></span>` : '';

        return `
            <div class="flex flex-col ${align} mb-1 group max-w-full">
                <div class="relative max-w-[85%] md:max-w-[65%] shadow-sm ${bubbleColor} ${C.textMain} px-2 pt-2 pb-1 ${tailClass} rounded-lg">
                    ${(!isDeleted && (isMe || App.can('admin'))) ? `<button onclick="MessengerView.showMsgMenu(this, ${msg.id})" class="absolute top-0 right-0 w-8 h-6 bg-gradient-to-b from-black/20 to-transparent rounded-tr-lg opacity-0 group-hover:opacity-100 transition-opacity text-right pr-2 pt-1 text-white/80 hover:text-white z-10"><i class="fa-solid fa-angle-down text-xs drop-shadow-md"></i></button>` : ''}
                    <div class="px-1 pb-1 relative z-0 break-words" style="min-width: 80px;">
                        ${!isMe && this.state.activeType === 'group' ? `<p class="text-xs font-bold text-[#eeb346] mb-1 cursor-pointer hover:underline">${msg.sender}</p>` : ''}
                        ${contentHtml}
                    </div>
                    <div class="float-right flex items-end gap-1 ml-2 -mb-0.5 opacity-60 select-none"><span class="text-[10px] text-[#e9edef]">${time}</span>${statusIcon}</div>
                </div>
            </div>
        `;
    },

    renderAttachMenu() {
        if (!this.state.showAttachMenu) return '';
        const items = [{ icon: 'fa-image', color: 'bg-purple-500', text: 'Fotos & Videos', action: "MessengerView.sendAttachment('image')" }, { icon: 'fa-camera', color: 'bg-red-500', text: 'Kamera', action: "MessengerView.sendAttachment('camera')" }, { icon: 'fa-file', color: 'bg-indigo-500', text: 'Dokument', action: "MessengerView.sendAttachment('file')" }, { icon: 'fa-user', color: 'bg-blue-500', text: 'Kontakt', action: "MessengerView.openContactSelectModal()" }, { icon: 'fa-square-poll-vertical', color: 'bg-teal-500', text: 'Umfrage', action: "MessengerView.openPollModal()" }];
        return `<div class="absolute bottom-20 left-4 flex flex-col gap-4 animate-slide-up z-40">${items.map(i => `<div onclick="${i.action}; MessengerView.toggleAttachMenu()" class="flex items-center gap-4 group cursor-pointer"><div class="w-12 h-12 rounded-full ${i.icon === 'fa-image' ? 'bg-gradient-to-b from-purple-500 to-pink-500' : i.color} flex items-center justify-center text-white shadow-lg hover:scale-110 transition-transform"><i class="fa-solid ${i.icon} text-lg"></i></div><span class="bg-[#233138] text-white px-3 py-1 rounded-full text-sm opacity-0 group-hover:opacity-100 transition-opacity shadow-lg scale-0 group-hover:scale-100 origin-left border border-[#2a3942] whitespace-nowrap hidden md:block">${i.text}</span></div>`).reverse().join('')}</div>`;
    },

    renderEmojiPicker() {
        if (!this.state.showEmojiPicker) return '';
        const emojis = ['😀','😂','🥰','😎','😭','👍','👎','👋','🙏','❤️','🔥','🎉','⚽','🍺','🤔','👀','🚀','💯','🔴','⚪'];
        return `<div class="absolute bottom-20 left-0 md:left-4 bg-[#202c33] border border-[#2a3942] rounded-lg shadow-2xl p-2 w-full md:w-72 h-64 overflow-y-auto animate-slide-up z-40 custom-scrollbar"><div class="grid grid-cols-6 gap-1">${emojis.map(e => `<button onclick="MessengerView.addEmoji('${e}')" class="text-2xl p-2 hover:bg-white/5 rounded transition">${e}</button>`).join('')}</div><div class="p-2 text-center text-xs text-[#8696a0]">Mehr Emojis folgen...</div></div>`;
    },

    showMsgMenu(btn, msgId) { event.stopPropagation(); if(confirm("Nachricht löschen?")) this.deleteMessage(msgId); },
    toggleAttachMenu() { this.state.showAttachMenu = !this.state.showAttachMenu; this.state.showEmojiPicker = false; this.render(document.getElementById('content')); },
    toggleEmojiPicker() { this.state.showEmojiPicker = !this.state.showEmojiPicker; this.state.showAttachMenu = false; this.render(document.getElementById('content')); },
    addEmoji(char) { const input = document.getElementById('chat-input'); if(input) { input.value += char; input.focus(); } },
    sendMessage(e) { e.preventDefault(); const input = e.target.elements.message; const text = input.value.trim(); if (!text) return; this.addMessageToChat({ text: text, type: 'text' }); input.value = ''; input.focus(); },
    sendAttachment(type) { let content = ''; if(type === 'image') content = 'https://picsum.photos/400/300'; if(type === 'file') content = 'Protokoll_Sitzung.pdf'; this.addMessageToChat({ text: '', type: type, content: content }); },

    addMessageToChat(msgData) {
        const myId = this.getMyId();
        const me = Store.state.members.find(m => m.id == myId) || { firstName: 'Ich' };
        const activeId = this.state.activeId;
        
        const newMessage = {
            id: Date.now(),
            text: msgData.text,
            type: msgData.type || 'text',
            content: msgData.content || null,
            sender: me.firstName,
            // NEU: IDs für Filterung
            senderId: myId,
            recipientId: activeId,
            
            isMe: true,
            isDeleted: false,
            time: new Date().toISOString()
        };

        const type = this.state.activeType;
        let parentObj = null;
        let table = '';

        if (type === 'group') {
            parentObj = Store.state.groups.find(g => g.id === activeId);
            if(parentObj) {
                if(!parentObj.chat) parentObj.chat = [];
                parentObj.chat.push(newMessage);
                table = 'groups';
                // Nutzung der SafeUpdate Funktion
                this.safeUpdate(table, parentObj);
            }
        } else if (type === 'private') {
            // WICHTIG: Damit beide die Nachricht haben, müssen wir BEIDE User updaten.

            // 1. Update bei MIR (damit ich meine Nachricht sehe)
            const myUser = Store.state.members.find(m => m.id == myId);
            if(myUser) {
                if(!myUser.privateChat) myUser.privateChat = [];
                myUser.privateChat.push(newMessage);
                // SAFE UPDATE nutzen, damit die ID nicht zum Fehler führt
                this.safeUpdate('members', myUser); 
            }

            // 2. Update beim PARTNER (damit er die Nachricht empfängt)
            const partnerUser = Store.state.members.find(m => m.id === activeId);
            if(partnerUser) {
                if(!partnerUser.privateChat) partnerUser.privateChat = [];
                partnerUser.privateChat.push(newMessage);
                this.safeUpdate('members', partnerUser);
            }

            // UI Refresh für mich sofort
            const chatArea = document.getElementById('messenger-chat-area');
            if(chatArea) { chatArea.innerHTML = this.renderActiveChat(); this.scrollToBottom(true); }
            this.renderSidebarList();
        }
    },

    deleteMessage(msgId) {
        const type = this.state.activeType;
        const id = this.state.activeId;
        let parentObj = null;
        if(type === 'group') parentObj = Store.state.groups.find(g => g.id === id);
        
        // Bei Private müssen wir jetzt aufpassen. Löschen wir es nur bei uns?
        // Einfachheitshalber: Ja, nur bei uns.
        if(type === 'private') parentObj = Store.state.members.find(m => m.id == this.getMyId());

        if(parentObj) {
            // Helper um korrekte Liste zu finden (DB oder Local)
            let list = (type === 'group') ? parentObj.chat : parentObj.privateChat;
            
            const msg = list.find(m => m.id === msgId);
            if(msg) {
                msg.isDeleted = true;
                msg.text = '';
                
                this.safeUpdate(type === 'group' ? 'groups' : 'members', parentObj);
                this.render(document.getElementById('content'));
            }
        }
    },

    openPollModal() {
        const question = prompt("Frage für Umfrage:");
        if(!question) return;
        const opt1 = prompt("Option 1:");
        const opt2 = prompt("Option 2:");
        if(opt1 && opt2) {
            const pollData = { question, options: [{ id: 1, text: opt1, votes: [] }, { id: 2, text: opt2, votes: [] }] };
            this.addMessageToChat({ text: '', type: 'poll', content: pollData });
        }
    },

    votePoll(msgId, optId) {
        const type = this.state.activeType;
        const id = this.state.activeId;
        const myId = this.getMyId();
        let parentObj = null;
        if(type === 'group') parentObj = Store.state.groups.find(g => g.id === id);
        
        if(parentObj) {
            const msg = parentObj.chat.find(m => m.id === msgId);
            if(msg && msg.type === 'poll') {
                const opt = msg.content.options.find(o => o.id === optId);
                if(opt) {
                    if(!opt.votes) opt.votes = [];
                    if(opt.votes.includes(myId)) opt.votes = opt.votes.filter(v => v !== myId);
                    else opt.votes.push(myId);
                    
                    this.safeUpdate('groups', parentObj);
                    
                    const chatArea = document.getElementById('messenger-chat-area');
                    if(chatArea) chatArea.innerHTML = this.renderActiveChat();
                }
            }
        }
    },
    
    // --- SAFE UPDATE HELPER ---
    
    async safeUpdate(table, item) {
        // Workaround für "column id can only be updated to DEFAULT" Fehler
        // Wir nutzen eine temporäre Supabase-Instanz, um die ID aus dem Payload zu entfernen
        
        // Wenn kein globaler Client da ist, versuchen wir Store Fallback
        if (typeof supabase === 'undefined' || typeof CONFIG === 'undefined') {
            console.warn("Global supabase/CONFIG missing. Fallback to Store.update");
            return Store.update(table, item);
        }

        try {
            const sessionStr = localStorage.getItem('vm_supabase_session');
            const headers = {};
            if(sessionStr) {
                 const session = JSON.parse(sessionStr);
                 if(session?.access_token) headers.Authorization = `Bearer ${session.access_token}`;
            }

            const sb = supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY, { global: { headers } });
            
            // Payload OHNE ID
            const payload = { ...item };
            delete payload.id;
            
            // Wir senden privateChat jetzt mit, damit der Sync klappt.
            // Falls SQL Fehler kommen, muss der User die Spalte "privateChat" anlegen.
            
            const { error } = await sb.from(table).update(payload).eq('id', item.id);

            if(error) {
                console.error("SafeUpdate Error:", error);
                if(window.App) window.App.showToast(error.message, 'error');
            } else {
                // Trigger Refresh im Store, damit Realtime / UI aktuell bleiben
                if(window.Store && window.Store.fetchTable) window.Store.fetchTable(table);
            }
        } catch(e) {
            console.error("SafeUpdate Exception:", e);
        }
    },

    showUserProfile(id) { alert("Profil von ID " + id + " anzeigen"); },
    openContactSelectModal() { alert("Kontakt teilen (Funktion hier einfügen)"); },
    scrollToBottom(smooth = false) { const container = document.getElementById('msg-scroll-container'); if (container) { container.scrollTo({ top: container.scrollHeight, behavior: smooth ? 'smooth' : 'auto' }); } }
};

window.MessengerView = MessengerView;
