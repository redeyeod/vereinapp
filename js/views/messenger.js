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
        replyingTo: null,   // ID der Nachricht, auf die geantwortet wird
        editingId: null,    // ID der Nachricht, die bearbeitet wird
        scrollPositions: {}
    },

    // Farben und Styles Konfiguration
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

    // Helper: Current User ID (Safe Access)
    getMyId() {
        if (typeof App !== 'undefined' && App.state && App.state.currentUser) {
            return App.state.currentUser.id;
        }
        return localStorage.getItem('vm_current_user_id') || 1;
    },

    init() {
        this.injectStyles();
    },

    injectStyles() {
        if (document.getElementById('messenger-custom-styles')) return;
        const style = document.createElement('style');
        style.id = 'messenger-custom-styles';
        style.innerHTML = `
            .msg-bg-pattern {
                background-color: #0b141a;
                background-image: url("data:image/svg+xml,%3Csvg width='100' height='100' viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M11 18c3.866 0 7-3.134 7-7s-3.134-7-7-7-7 3.134-7 7 3.134 7 7 7zm48 25c3.866 0 7-3.134 7-7s-3.134-7-7-7-7 3.134-7 7 3.134 7 7 7zm-43-7c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zm63 31c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zM34 90c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zm56-76c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zM12 86c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm28-65c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm23-11c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm-6 60c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm29 22c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zM32 63c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm57-13c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm-9-21c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zM60 91c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zM35 41c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zM12 60c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2z' fill='%232a3942' fill-opacity='0.2' fill-rule='evenodd'/%3E%3C/svg%3E");
            }
            .custom-scrollbar::-webkit-scrollbar { width: 5px; }
            .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
            .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(134, 150, 160, 0.3); border-radius: 4px; }
            
            .bubble-tail-in { border-top-left-radius: 0 !important; }
            .bubble-tail-out { border-top-right-radius: 0 !important; }
            
            /* Context Menu Animation */
            @keyframes scaleIn { from { transform: scale(0.9); opacity: 0; } to { transform: scale(1); opacity: 1; } }
            .animate-scale-in { animation: scaleIn 0.1s ease-out forwards; }
            
            /* Input Area Fix for Mobile */
            .safe-bottom { padding-bottom: env(safe-area-inset-bottom); }
        `;
        document.head.appendChild(style);
    },

    // --- DATA HANDLING ---

    getMemberChat(partner) {
         if (!partner) return [];
         const myId = this.getMyId();
         const members = (window.Store && Store.state && Store.state.members) ? Store.state.members : [];
         const me = members.find(m => m.id == myId);
         const allMessages = (me && me.privateChat) ? me.privateChat : [];
         return allMessages.filter(msg => {
             return (msg.senderId == myId && msg.recipientId == partner.id) ||
                    (msg.senderId == partner.id && msg.recipientId == myId);
         });
    },

    // --- RENDER MAIN ---

    render(container) {
        try {
            this.init();
            const { mobileChatVisible } = this.state;
            const C = this.config;

            container.innerHTML = `
                <div class="flex h-[calc(100vh-80px)] md:h-[calc(100vh-100px)] max-w-[1600px] mx-auto overflow-hidden bg-black shadow-2xl relative rounded-xl border border-[#333]">
                    <!-- LEFT SIDEBAR -->
                    <div class="${mobileChatVisible ? 'hidden md:flex' : 'flex'} w-full md:w-[400px] lg:w-[450px] flex-col ${C.sidebarBg} border-r ${C.border} z-20">
                        <div class="h-16 px-4 ${C.headerBg} flex items-center justify-between shrink-0 border-b ${C.border}">
                            <div class="flex items-center gap-3">
                                <div class="w-10 h-10 rounded-full bg-slate-600 flex items-center justify-center cursor-pointer hover:opacity-80 transition"><i class="fa-solid fa-user text-slate-300"></i></div>
                                <h2 class="font-bold text-white tracking-wide">Chats</h2>
                            </div>
                            <div class="flex gap-4 text-slate-400">
                                 <button class="hover:text-white"><i class="fa-solid fa-message"></i></button>
                                 <button class="hover:text-white"><i class="fa-solid fa-ellipsis-vertical"></i></button>
                            </div>
                        </div>
                        <div class="p-3 ${C.sidebarBg} border-b ${C.border}">
                            <div class="relative bg-[#202c33] rounded-lg flex items-center px-3 h-9">
                                <i class="fa-solid fa-magnifying-glass text-[#8696a0] text-sm ${this.state.filterTerm ? 'hidden' : 'block'}"></i>
                                <button class="${this.state.filterTerm ? 'block' : 'hidden'} text-[#00a884]" onclick="MessengerView.handleSearch('')"><i class="fa-solid fa-arrow-left"></i></button>
                                <input type="text" placeholder="Suchen..." value="${this.state.filterTerm}" onkeyup="MessengerView.handleSearch(this.value)" id="messenger-search-input" class="bg-transparent border-none text-[#d1d7db] text-sm w-full ml-3 focus:outline-none placeholder-[#8696a0] h-full">
                            </div>
                        </div>
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
            
            // Fokus wiederherstellen falls nötig
            const input = document.getElementById('messenger-search-input');
            if(input && this.state.filterTerm) {
                input.focus();
                const val = input.value;
                input.value = '';
                input.value = val;
            }
        } catch (e) {
            console.error("Messenger Render Error:", e);
            container.innerHTML = `<div class="p-10 text-center text-red-400">Fehler beim Laden des Messengers.<br><small>${e.message}</small></div>`;
        }
    },

    handleSearch(val) { this.state.filterTerm = val.toLowerCase(); this.renderSidebarList(); },

    renderSidebarList() {
        const container = document.getElementById('messenger-list');
        if(!container) return;
        
        // Defensive Checks
        if (typeof Store === 'undefined' || !Store.state) {
            container.innerHTML = `<div class="p-4 text-center text-muted">Lade Daten...</div>`;
            return;
        }

        const term = this.state.filterTerm;
        const myId = this.getMyId();
        const members = Store.state.members || [];
        const groups = Store.state.groups || [];
        const me = members.find(m => m.id == myId) || { groups: [] };
        const myGroupNames = Array.isArray(me.groups) ? me.groups : (me.group && me.group !== 'Keine' ? [me.group] : []);
        let items = [];

        if ('ankündigungen'.includes(term) || !term) items.push({ type: 'news', id: 0, name: 'Ankündigungen', icon: 'fa-bullhorn', time: new Date() });

        const myGroups = groups.filter(g => myGroupNames.includes(g.name));
        myGroups.forEach(g => {
            if (g.name.toLowerCase().includes(term)) {
                const lastMsg = g.chat && g.chat.length > 0 ? g.chat[g.chat.length-1] : null;
                // Sicherstellen, dass ID vorhanden ist
                if (g.id) {
                    items.push({ type: 'group', id: g.id, name: g.name, icon: 'fa-users', lastMsg, time: lastMsg ? new Date(lastMsg.time) : new Date(0) });
                }
            }
        });

        members.filter(m => m.id != myId).forEach(m => {
            const name = `${m.firstName} ${m.lastName}`;
            const chat = this.getMemberChat(m);
            if (term && name.toLowerCase().includes(term) || (!term && chat.length > 0)) {
                items.push({ type: 'private', id: m.id, name, icon: 'fa-user', lastMsg: chat[chat.length-1], time: chat.length > 0 ? new Date(chat[chat.length-1].time) : new Date(0) });
            }
        });

        items.sort((a, b) => b.time - a.time);
        container.innerHTML = items.length ? items.map(i => this.renderListItem(i)).join('') : `<div class="p-8 text-center text-[#8696a0] text-sm">Keine Chats gefunden.</div>`;
    },

    renderListItem(item) {
        const isActive = this.state.activeType === item.type && (item.type === 'news' || this.state.activeId == item.id);
        let preview = "Klicken um zu starten";
        let dateStr = "";
        
        if (item.lastMsg) {
            const txt = item.lastMsg.text || (item.lastMsg.type === 'image' ? '📷 Foto' : '📎 Datei');
            
            const myId = this.getMyId();
            const isMe = item.lastMsg.senderId ? (item.lastMsg.senderId == myId) : item.lastMsg.isMe;

            preview = (isMe ? '<span class="text-[#00a884] mr-1"><i class="fa-solid fa-check-double"></i></span>' : '') + txt;
            const d = new Date(item.lastMsg.time);
            dateStr = (d.toDateString() === new Date().toDateString()) ? d.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : d.toLocaleDateString([], {day:'2-digit', month:'2-digit', year:'2-digit'});
        }

        // FIX: Wir nutzen jetzt data-Attribute und eine generische onClick-Funktion, um Parsing-Fehler zu vermeiden
        return `
            <div onclick="MessengerView.handleChatClick(this)" data-type="${item.type}" data-id="${item.id}" class="flex items-center gap-3 p-3 cursor-pointer transition-colors border-b border-[#202c33] ${isActive ? 'bg-[#2a3942]' : 'hover:bg-[#202c33]'} group">
                <div class="relative w-12 h-12 rounded-full bg-[#6a7f8a] flex items-center justify-center shrink-0 overflow-hidden text-white text-lg font-bold pointer-events-none">
                    ${item.type === 'private' ? item.name.charAt(0) : `<i class="fa-solid ${item.icon}"></i>`}
                </div>
                <div class="flex-1 min-w-0 flex flex-col justify-center pointer-events-none">
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

    // NEU: Sicherer Click-Handler
    handleChatClick(el) {
        const type = el.getAttribute('data-type');
        const id = el.getAttribute('data-id');
        this.selectChat(type, id);
    },

    selectChat(type, id) {
        // Robustes ID-Parsing, falls es eine Zahl ist
        if (id && !isNaN(id) && !isNaN(parseFloat(id))) {
            id = Number(id);
        }

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
        
        // Defensive Checks für Store
        const news = (window.Store && Store.state && Store.state.news) ? Store.state.news : [];
        const groups = (window.Store && Store.state && Store.state.groups) ? Store.state.groups : [];
        const members = (window.Store && Store.state && Store.state.members) ? Store.state.members : [];

        if (!this.state.mobileChatVisible && this.state.activeId == 0 && this.state.activeType !== 'news') {
            return `<div class="flex flex-col items-center justify-center h-full bg-[#222e35] text-center border-b-[6px] border-[#00a884]"><div class="mb-5"><i class="fa-regular fa-comments text-[#41525d] text-7xl"></i></div><h2 class="text-[#e9edef] text-3xl font-light mb-4">Vereins Messenger</h2><p class="text-[#8696a0] text-sm">Wähle einen Chat aus.</p></div>`;
        }

        const type = this.state.activeType;
        const id = this.state.activeId;
        let title = "Chat", subTitle = "", messages = [], canWrite = true, clickAction = "";

        if (type === 'news') {
            title = "Ankündigungen"; subTitle = "Nur Administratoren";
            messages = news.map(n => ({ id: n.id, sender: 'Vorstand', text: `📢 **${n.title}**\n\n${n.content}`, time: n.date, isMe: false, isSystem: true })).sort((a,b) => new Date(a.time) - new Date(b.time));
            canWrite = false;
        } else if (type === 'group') {
            const g = groups.find(x => x.id == id);
            if(g) { 
                title = g.name; 
                subTitle = 'Tippen für Gruppeninfo'; 
                messages = g.chat || [];
                // Auch hier data-attributes nutzen für Modal Klick
                clickAction = `onclick="MessengerView.showGroupInfo('${id}')"`;
            }
        } else if (type === 'private') {
            const m = members.find(x => x.id == id);
            if(m) { 
                title = `${m.firstName} ${m.lastName}`; 
                subTitle = m.status === 'active' ? 'Online' : 'Klicken für Profil'; 
                messages = this.getMemberChat(m);
                clickAction = `onclick="MessengerView.showUserProfile('${id}')"`;
            }
        }

        return `
            <div class="h-16 px-4 py-2 ${C.headerBg} flex items-center justify-between shadow-sm z-30 shrink-0 border-l border-[#2a3942] sticky top-0 w-full">
                <div class="flex items-center gap-3 overflow-hidden cursor-pointer" ${clickAction}>
                    <button onclick="event.stopPropagation(); MessengerView.closeChat()" class="md:hidden text-[#d1d7db] mr-1"><i class="fa-solid fa-arrow-left text-xl"></i></button>
                    <div class="w-10 h-10 rounded-full bg-[#6a7f8a] flex items-center justify-center overflow-hidden text-white font-bold text-lg">
                        ${type === 'private' ? title.charAt(0) : '<i class="fa-solid fa-users"></i>'}
                    </div>
                    <div class="flex flex-col justify-center overflow-hidden">
                        <h3 class="text-[#e9edef] font-bold text-base truncate leading-tight">${title}</h3>
                        <p class="text-[#8696a0] text-xs truncate leading-tight">${subTitle}</p>
                    </div>
                </div>
                <div class="flex items-center gap-4 text-[#8696a0]">
                    <button class="hover:text-white"><i class="fa-solid fa-search"></i></button>
                    <button class="hover:text-white"><i class="fa-solid fa-ellipsis-vertical"></i></button>
                </div>
            </div>

            <div id="msg-scroll-container" class="flex-1 overflow-y-auto p-4 md:px-10 space-y-2 msg-bg-pattern custom-scrollbar relative">
                ${messages.length === 0 ? `<div class="text-center mt-20 text-[#8696a0] opacity-60"><i class="fa-regular fa-comments text-4xl mb-2"></i><p>Schreib etwas...</p></div>` : messages.map(msg => this.renderMessageBubble(msg)).join('')}
                <div class="h-2"></div>
            </div>

            ${canWrite ? this.renderInputArea() : `<div class="p-4 ${C.headerBg} text-center text-[#8696a0] text-sm border-t ${C.border}">Nur Administratoren können hier senden.</div>`}
        `;
    },

    renderInputArea() {
        const C = this.config;
        const replyMsg = this.state.replyingTo ? this.findMessage(this.state.replyingTo) : null;
        
        return `
            <div class="min-h-[62px] ${C.headerBg} px-4 py-2 flex flex-col justify-end z-30 relative shrink-0 border-l border-[#2a3942]">
                ${this.renderAttachMenu()} ${this.renderEmojiPicker()}
                
                ${replyMsg ? `
                    <div class="flex items-center justify-between bg-[#1f2c34] p-2 rounded-t-lg border-l-4 border-[#00a884] mb-1 animate-scale-in">
                        <div class="text-sm text-[#8696a0]">
                            <p class="text-[#00a884] font-bold text-xs mb-0.5">${replyMsg.sender}</p>
                            <p class="truncate max-w-[200px]">${replyMsg.text}</p>
                        </div>
                        <button onclick="MessengerView.cancelReply()" class="text-[#8696a0] hover:text-white p-2"><i class="fa-solid fa-times"></i></button>
                    </div>
                ` : ''}

                <div class="flex items-end gap-2 w-full">
                    <button onclick="MessengerView.toggleAttachMenu()" class="mb-3 text-[#8696a0] hover:text-[#d1d7db] transition w-8 text-center text-xl"><i class="fa-solid fa-plus"></i></button>
                    <form onsubmit="MessengerView.sendMessage(event)" class="flex-1 flex items-end gap-2 mb-1.5">
                        <div class="flex-1 bg-[#2a3942] rounded-lg flex items-end min-h-[42px] py-2 px-3 relative">
                            <button type="button" onclick="MessengerView.toggleEmojiPicker()" class="text-[#8696a0] hover:text-[#ffde34] transition mr-3 text-lg mb-0.5"><i class="fa-regular fa-face-smile"></i></button>
                            <input type="text" name="message" id="chat-input" autocomplete="off" placeholder="Nachricht eingeben" class="bg-transparent border-none text-[#d1d7db] text-sm w-full focus:outline-none placeholder-[#8696a0] max-h-32 overflow-y-auto leading-relaxed">
                        </div>
                        <button type="submit" class="w-10 h-10 flex items-center justify-center rounded-full ${C.accentColor} ${C.accentColorHover} text-white shadow-md transition-transform active:scale-95 mb-0.5"><i class="fa-solid fa-paper-plane text-sm pl-0.5"></i></button>
                    </form>
                </div>
            </div>
        `;
    },

    renderMessageBubble(msg) {
        if (msg.isSystem) return `<div class="flex justify-center my-3"><div class="bg-[#1f2c34] text-[#8696a0] text-xs px-3 py-1.5 rounded-lg shadow uppercase font-bold tracking-wide">${msg.sender}: ${msg.text}</div></div>`;
        
        const myId = this.getMyId();
        const me = (window.Store && Store.state && Store.state.members) ? Store.state.members.find(m => m.id == myId) : {};
        
        let isMe = false;
        if (msg.senderId) {
            isMe = (msg.senderId == myId);
        } else if (msg.hasOwnProperty('isMe')) {
            isMe = msg.isMe; 
        } else {
            isMe = (me && msg.sender === me.firstName);
        }

        const isDeleted = msg.isDeleted;
        const C = this.config;
        const bubbleColor = isMe ? C.myMessageBg : C.otherMessageBg;
        const align = isMe ? 'items-end' : 'items-start';
        const tailClass = isMe ? 'bubble-tail-out' : 'bubble-tail-in';
        
        let replyHtml = '';
        if (msg.replyToId) {
            const parent = this.findMessage(msg.replyToId);
            if (parent) {
                replyHtml = `
                    <div class="bg-black/20 rounded p-1.5 mb-1 text-xs border-l-4 border-[#00a884]/50 cursor-pointer hover:bg-black/30 transition" onclick="document.getElementById('msg-${parent.id}')?.scrollIntoView({behavior:'smooth'})">
                        <span class="text-[#00a884] font-bold block mb-0.5">${parent.sender}</span>
                        <span class="text-white/70 truncate block">${parent.text}</span>
                    </div>
                `;
            }
        }

        let reactionsHtml = '';
        if (msg.reactions && msg.reactions.length > 0) {
            reactionsHtml = `
                <div class="absolute -bottom-2 ${isMe ? 'right-2' : 'left-2'} bg-[#1f2c34] rounded-full px-1.5 py-0.5 border border-[#0b141a] flex gap-0.5 shadow-sm text-[10px] z-10 cursor-pointer" onclick="alert('${msg.reactions.map(r => r.u).join(', ')}')">
                    ${msg.reactions.map(r => `<span>${r.e}</span>`).join('')}
                    ${msg.reactions.length > 1 ? `<span class="text-[#8696a0] ml-0.5">${msg.reactions.length}</span>` : ''}
                </div>
            `;
        }

        let contentHtml = isDeleted ? `<span class="italic text-[#8696a0] flex items-center gap-1 text-sm"><i class="fa-solid fa-ban text-xs"></i> Gelöscht</span>` : `<span class="text-sm md:text-[15px] leading-relaxed text-[#e9edef]">${msg.text.replace(/\n/g, '<br>')}</span>`;
        if (msg.type === 'image') contentHtml = `<img src="${msg.content}" class="rounded-lg max-w-full sm:max-w-[300px] mb-1 cursor-pointer" onclick="window.open('${msg.content}')">`;
        else if (msg.type === 'poll') { contentHtml = `<b>Umfrage:</b> ${msg.content.question}`; }

        const contextMenuId = `ctx-${msg.id}`;

        return `
            <div id="msg-${msg.id}" class="flex flex-col ${align} mb-2 group max-w-full relative select-none">
                <div class="relative max-w-[85%] md:max-w-[65%] shadow-sm ${bubbleColor} ${C.textMain} px-2 pt-2 pb-1 ${tailClass} rounded-lg ${msg.isPinned ? 'border border-yellow-500/30' : ''}">
                    ${msg.isPinned ? '<i class="fa-solid fa-thumbtack text-[10px] text-yellow-500 absolute -top-1.5 -right-1 rotate-45 drop-shadow-md"></i>' : ''}
                    
                    <button onclick="MessengerView.toggleMsgMenu('${contextMenuId}')" class="absolute top-0 right-0 w-8 h-6 bg-gradient-to-b from-black/20 to-transparent rounded-tr-lg opacity-0 group-hover:opacity-100 transition-opacity text-right pr-2 pt-1 text-white/80 hover:text-white z-10">
                        <i class="fa-solid fa-angle-down text-xs drop-shadow-md"></i>
                    </button>

                    <div class="px-1 pb-1 relative z-0 break-words min-w-[80px]">
                        ${replyHtml}
                        ${!isMe && this.state.activeType === 'group' ? `<p class="text-xs font-bold text-[#eeb346] mb-1">${msg.sender}</p>` : ''}
                        ${contentHtml}
                    </div>
                    
                    <div class="float-right flex items-end gap-1 ml-2 -mb-0.5 opacity-60">
                        <span class="text-[10px] text-[#e9edef]">${new Date(msg.time).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</span>
                        ${isMe ? '<span class="text-[#53bdeb] text-[10px]"><i class="fa-solid fa-check-double"></i></span>' : ''}
                    </div>

                    ${reactionsHtml}
                </div>

                <div id="${contextMenuId}" class="hidden absolute top-8 ${isMe ? 'right-4' : 'left-4'} bg-[#233138] border border-[#2a3942] rounded-lg shadow-2xl z-50 w-48 animate-scale-in py-1">
                    <div class="flex justify-around p-2 border-b border-[#2a3942] bg-[#1f2c34]">
                        ${['👍','❤️','😂','😮','🙏'].map(e => `<button onclick="MessengerView.reactToMessage('${msg.id}', '${e}')" class="hover:scale-125 transition text-lg">${e}</button>`).join('')}
                    </div>
                    <button onclick="MessengerView.replyTo('${msg.id}')" class="w-full text-left px-4 py-2.5 text-sm text-[#e9edef] hover:bg-[#111b21] flex gap-3 items-center"><i class="fa-solid fa-reply w-4"></i> Antworten</button>
                    <button onclick="MessengerView.copyMessageText('${msg.text}')" class="w-full text-left px-4 py-2.5 text-sm text-[#e9edef] hover:bg-[#111b21] flex gap-3 items-center"><i class="fa-regular fa-copy w-4"></i> Kopieren</button>
                    <button onclick="MessengerView.pinMessage('${msg.id}')" class="w-full text-left px-4 py-2.5 text-sm text-[#e9edef] hover:bg-[#111b21] flex gap-3 items-center"><i class="fa-solid fa-thumbtack w-4"></i> ${msg.isPinned ? 'Lösen' : 'Anpinnen'}</button>
                    <button onclick="MessengerView.forwardMessage('${msg.id}')" class="w-full text-left px-4 py-2.5 text-sm text-[#e9edef] hover:bg-[#111b21] flex gap-3 items-center"><i class="fa-solid fa-share w-4"></i> Weiterleiten</button>
                    ${isMe ? `<button onclick="MessengerView.editMessage('${msg.id}')" class="w-full text-left px-4 py-2.5 text-sm text-[#e9edef] hover:bg-[#111b21] flex gap-3 items-center"><i class="fa-solid fa-pen w-4"></i> Bearbeiten</button>` : ''}
                    ${isMe || App.can('admin') ? `<button onclick="MessengerView.deleteMessage('${msg.id}')" class="w-full text-left px-4 py-2.5 text-sm text-red-400 hover:bg-[#111b21] flex gap-3 items-center"><i class="fa-solid fa-trash w-4"></i> Löschen</button>` : ''}
                </div>
            </div>
        `;
    },

    // --- ACTIONS & LOGIC ---

    toggleMsgMenu(id) {
        document.querySelectorAll('[id^="ctx-"]').forEach(el => { if(el.id !== id) el.classList.add('hidden'); });
        const menu = document.getElementById(id);
        if(menu) {
            menu.classList.toggle('hidden');
            const closer = () => { menu.classList.add('hidden'); document.removeEventListener('click', closer); };
            setTimeout(() => document.addEventListener('click', closer), 10);
        }
    },

    findMessage(msgId) {
        const type = this.state.activeType;
        const id = this.state.activeId;
        if(type === 'group') {
            const g = Store.state.groups.find(g => g.id == id);
            return g ? g.chat.find(m => m.id == msgId) : null;
        }
        if(type === 'private') {
            const m = Store.state.members.find(x => x.id == this.getMyId()); 
            return m && m.privateChat ? m.privateChat.find(msg => msg.id == msgId) : null;
        }
        return null;
    },

    replyTo(msgId) {
        this.state.replyingTo = msgId;
        this.render(document.getElementById('content'));
        setTimeout(() => document.getElementById('chat-input')?.focus(), 50);
    },

    cancelReply() {
        this.state.replyingTo = null;
        this.render(document.getElementById('content'));
    },

    editMessage(msgId) {
        const msg = this.findMessage(msgId);
        if(msg) {
            const input = document.getElementById('chat-input');
            if(input) {
                input.value = msg.text;
                input.focus();
                this.state.editingId = msgId;
            }
        }
    },

    copyMessageText(text) {
        navigator.clipboard.writeText(text);
        if(window.App) window.App.showToast("Kopiert!");
    },

    reactToMessage(msgId, emoji) {
        this.updateMsgProperty(msgId, (msg) => {
            if(!msg.reactions) msg.reactions = [];
            const myName = Store.state.currentUser.firstName;
            const existing = msg.reactions.find(r => r.u === myName && r.e === emoji);
            if(existing) msg.reactions = msg.reactions.filter(r => r !== existing);
            else msg.reactions.push({ u: myName, e: emoji });
        });
    },

    pinMessage(msgId) {
        this.updateMsgProperty(msgId, (msg) => {
            msg.isPinned = !msg.isPinned;
        });
    },

    forwardMessage(msgId) {
        alert("Weiterleiten-Funktion: Hier würde sich eine Kontaktliste öffnen.");
    },

    updateMsgProperty(msgId, cb) {
        const type = this.state.activeType;
        const id = this.state.activeId;
        
        if (type === 'group') {
            let parentObj = Store.state.groups.find(g => g.id == id);
            if(parentObj) {
                const msg = parentObj.chat.find(m => m.id == msgId);
                if(msg) { cb(msg); this.safeUpdate('groups', parentObj); }
            }
        } else if (type === 'private') {
            // Update bei beiden Teilnehmern
            const myId = this.getMyId();
            const me = Store.state.members.find(m => m.id == myId);
            const other = Store.state.members.find(m => m.id == id);
            
            [me, other].forEach(user => {
                if(user && user.privateChat) {
                    const msg = user.privateChat.find(m => m.id == msgId);
                    if(msg) { cb(msg); this.safeUpdate('members', user); }
                }
            });
        }
        this.render(document.getElementById('content'));
    },

    showGroupInfo(groupId) {
        const g = Store.state.groups.find(x => x.id == groupId);
        if(!g) return;
        const membersList = g.members ? g.members.map(name => `<li class="py-2 border-b border-white/10 flex items-center gap-3"><div class="w-8 h-8 rounded-full bg-slate-600 flex items-center justify-center text-xs text-white">${name.charAt(0)}</div><span>${name}</span></li>`).join('') : '<li class="text-muted">Keine Mitglieder</li>';
        
        const html = `
            <div class="p-6 text-white max-w-md mx-auto">
                <div class="text-center mb-6">
                    <div class="w-20 h-20 bg-[#00a884] rounded-full mx-auto flex items-center justify-center text-4xl mb-4"><i class="fa-solid fa-users"></i></div>
                    <h2 class="text-2xl font-bold">${g.name}</h2>
                    <p class="text-[#8696a0]">${g.members ? g.members.length : 0} Teilnehmer</p>
                </div>
                <div class="bg-[#111b21] rounded-xl p-4 border border-[#2a3942]">
                    <h3 class="text-[#00a884] text-sm font-bold uppercase mb-2">Mitglieder</h3>
                    <ul class="max-h-60 overflow-y-auto custom-scrollbar">${membersList}</ul>
                </div>
                <button onclick="App.closeModal()" class="mt-6 w-full py-3 bg-[#202c33] rounded-lg text-[#00a884] font-bold">Schließen</button>
            </div>
        `;
        App.openModal(html);
    },

    sendMessage(e) {
        e.preventDefault();
        const input = e.target.elements.message;
        const text = input.value.trim();
        if (!text) return;

        if (this.state.editingId) {
            this.updateMsgProperty(this.state.editingId, (msg) => { msg.text = text; msg.isEdited = true; });
            this.state.editingId = null;
        } else {
            this.addMessageToChat({ 
                text: text, 
                type: 'text',
                replyToId: this.state.replyingTo 
            });
        }
        
        input.value = '';
        this.state.replyingTo = null;
        this.render(document.getElementById('content')); 
        input.blur();
    },

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
            senderId: myId,
            recipientId: activeId,
            isMe: true,
            isDeleted: false,
            time: new Date().toISOString(),
            replyToId: msgData.replyToId || null
        };

        const type = this.state.activeType;
        let parentObj = null;
        let table = '';

        if (type === 'group') {
            parentObj = Store.state.groups.find(g => g.id == activeId);
            if(parentObj) {
                if(!parentObj.chat) parentObj.chat = [];
                parentObj.chat.push(newMessage);
                this.safeUpdate('groups', parentObj);
            }
        } else if (type === 'private') {
            const myUser = Store.state.members.find(m => m.id == myId);
            if(myUser) {
                if(!myUser.privateChat) myUser.privateChat = [];
                myUser.privateChat.push(newMessage);
                this.safeUpdate('members', myUser); 
            }
            const partnerUser = Store.state.members.find(m => m.id == activeId);
            if(partnerUser) {
                if(!partnerUser.privateChat) partnerUser.privateChat = [];
                partnerUser.privateChat.push(newMessage);
                this.safeUpdate('members', partnerUser);
            }
            const chatArea = document.getElementById('messenger-chat-area');
            if(chatArea) { chatArea.innerHTML = this.renderActiveChat(); this.scrollToBottom(true); }
            this.renderSidebarList();
        }
    },

    deleteMessage(msgId) {
        const type = this.state.activeType;
        const id = this.state.activeId;
        let parentObj = null;
        
        if(type === 'group') {
            parentObj = Store.state.groups.find(g => g.id == id);
            if(parentObj) {
                const msg = parentObj.chat.find(m => m.id == msgId);
                if(msg) { msg.isDeleted = true; msg.text = ''; this.safeUpdate('groups', parentObj); }
            }
        } else if (type === 'private') {
            // Delete for BOTH
            const myId = this.getMyId();
            const me = Store.state.members.find(m => m.id == myId);
            const other = Store.state.members.find(m => m.id == id);
            [me, other].forEach(u => {
                if(u && u.privateChat) {
                    const m = u.privateChat.find(msg => msg.id == msgId);
                    if(m) { m.isDeleted = true; m.text = ''; this.safeUpdate('members', u); }
                }
            });
        }
        this.render(document.getElementById('content'));
    },

    safeUpdate(table, item) {
        if (typeof supabase === 'undefined' || typeof CONFIG === 'undefined') return Store.update(table, item);
        try {
            const sessionStr = localStorage.getItem('vm_supabase_session');
            const headers = {};
            if(sessionStr) {
                 const session = JSON.parse(sessionStr);
                 if(session?.access_token) headers.Authorization = `Bearer ${session.access_token}`;
            }
            const sb = supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY, { global: { headers } });
            const payload = { ...item }; delete payload.id;
            sb.from(table).update(payload).eq('id', item.id).then(({error}) => {
                if(error && window.App) window.App.showToast(error.message, 'error');
                else if(window.Store && window.Store.fetchTable) window.Store.fetchTable(table);
            });
        } catch(e) { console.error(e); }
    },

    showUserProfile(id) { alert("Profil von ID " + id + " anzeigen"); },
    openContactSelectModal() { alert("Kontakt teilen (Funktion hier einfügen)"); },
    openPollModal() {
        const question = prompt("Frage:"); if(!question) return;
        const opt1 = prompt("Option 1:"); const opt2 = prompt("Option 2:");
        if(opt1 && opt2) this.addMessageToChat({ text: '', type: 'poll', content: {question, options:[{id:1, text:opt1, votes:[]},{id:2, text:opt2, votes:[]}]} });
    },
    toggleAttachMenu() { this.state.showAttachMenu = !this.state.showAttachMenu; this.state.showEmojiPicker = false; this.render(document.getElementById('content')); },
    toggleEmojiPicker() { this.state.showEmojiPicker = !this.state.showEmojiPicker; this.state.showAttachMenu = false; this.render(document.getElementById('content')); },
    addEmoji(char) { const input = document.getElementById('chat-input'); if(input) { input.value += char; input.focus(); } },
    sendAttachment(type) { let content = ''; if(type === 'image') content = 'https://picsum.photos/400/300'; if(type === 'file') content = 'Protokoll.pdf'; this.addMessageToChat({ text: '', type: type, content: content }); },
    votePoll(msgId, optId) { this.updateMsgProperty(msgId, (msg) => { const opt = msg.content.options.find(o => o.id == optId); if(opt) { const myId = this.getMyId(); if(opt.votes.includes(myId)) opt.votes = opt.votes.filter(v => v !== myId); else opt.votes.push(myId); } }); },
    scrollToBottom(smooth = false) { const container = document.getElementById('msg-scroll-container'); if (container) { container.scrollTo({ top: container.scrollHeight, behavior: smooth ? 'smooth' : 'auto' }); } }
};

window.MessengerView = MessengerView;
