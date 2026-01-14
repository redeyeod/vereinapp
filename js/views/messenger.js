/**
 * =============================================================================
 * MODERN MESSENGER VIEW (Responsive & Integrated)
 * Design: Glassmorphism / Tailwind Slate Theme
 * Features: Fullscreen Mobile Chat, Real-time Search, Attachments, Polls
 * =============================================================================
 */

const MessengerView = {
    // --- STATE ---
    state: {
        activeType: 'news', // 'news', 'group', 'private'
        activeId: 0,        // 0 = kein Chat
        filterTerm: '',     // Suche in der Sidebar
        
        // Chat-Interne States
        showChatSearch: false,
        chatFilterTerm: '',
        showAttachMenu: false,
        mobileChatVisible: false, // Steuert Mobile View (List vs. Chat)
        
        replyingTo: null,
        editingId: null,
        scrollPositions: {},
        
        observer: null // Wächter für Cleanup beim Verlassen
    },

    // --- CONFIG & THEME ---
    config: {
        // bgPatternOpacity entfernt, da Hintergrund nun solid ist
    },

    // --- HELPER ---
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
        if (document.getElementById('messenger-styles')) return;
        const style = document.createElement('style');
        style.id = 'messenger-styles';
        
        style.innerHTML = `
            .msg-bg-pattern {
                background-color: #0f172a; /* Slate 900 - Solid Dark Background */
            }
            /* Custom Scrollbar für Chat */
            .chat-scroll::-webkit-scrollbar { width: 4px; }
            .chat-scroll::-webkit-scrollbar-track { background: transparent; }
            .chat-scroll::-webkit-scrollbar-thumb { background: rgba(148, 163, 184, 0.2); border-radius: 4px; }
            .chat-scroll::-webkit-scrollbar-thumb:hover { background: rgba(148, 163, 184, 0.4); }
            
            /* Message Bubble Tails */
            .bubble-tail-in { border-top-left-radius: 2px !important; }
            .bubble-tail-out { border-top-right-radius: 2px !important; }
            
            /* Animations */
            @keyframes msgSlideUp { from { transform: translateY(10px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
            .animate-msg { animation: msgSlideUp 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
            
            .slide-in-right { animation: slideInRight 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
            @keyframes slideInRight { from { transform: translateX(100%); } to { transform: translateX(0); } }

            /* --- MOBILE FULLSCREEN MODES --- */
            
            /* NUCLEAR OPTION: Body/HTML komplett fixieren wenn Chat aktiv ist. */
            html.messenger-mode, body.messenger-mode {
                overflow: hidden !important;
                height: 100% !important;
                height: 100dvh !important; /* Dynamic Viewport Height */
                position: fixed !important; 
                width: 100% !important;
                overscroll-behavior: none; /* Prevent pull-to-refresh effects */
            }

            body.messenger-mode #main-header { display: none !important; }
            
            body.messenger-mode #content { 
                padding: 0 !important; 
                position: absolute !important; 
                top: 0 !important;
                bottom: 0 !important;
                left: 0 !important;
                right: 0 !important;
                height: 100% !important;
                height: 100dvh !important;
                width: 100% !important;
                overflow: hidden !important; 
                z-index: 100 !important;
                background-color: #0f172a;
                /* Flex Layout für den Content Container erzwingen */
                display: flex !important;
                flex-direction: column !important;
            }

            /* A) CHAT ACTIVE: Kein Footer */
            body.messenger-mode.chat-active #mobile-bottom-nav { display: none !important; }
            
            /* B) LIST ACTIVE: Footer sichtbar */
            body.messenger-mode.list-active #mobile-bottom-nav { display: flex !important; z-index: 101 !important; }
            body.messenger-mode.list-active #messenger-list { padding-bottom: 90px !important; } 
            
            body.messenger-mode.list-active .messenger-sidebar-header {
                padding-top: max(1rem, env(safe-area-inset-top)); 
                height: auto;
                min-height: 4.5rem;
            }
        `;
        document.head.appendChild(style);
    },

    // --- MAIN RENDER ---
    render(container) {
        if (!container) container = document.getElementById('content');
        if (!container) return;
        
        this.init();
        
        // Prüfen ob Mobile View aktiv
        const isMobile = window.innerWidth < 768;

        // Reset Classes first
        document.documentElement.classList.remove('messenger-mode');
        document.body.classList.remove('messenger-mode', 'chat-active', 'list-active');

        if (isMobile) {
            // Apply to HTML and Body for maximum stability
            document.documentElement.classList.add('messenger-mode');
            document.body.classList.add('messenger-mode');
            
            if (this.state.mobileChatVisible) {
                document.body.classList.add('chat-active');
            } else {
                document.body.classList.add('list-active');
            }
        }

        // Layout Template - ID hinzugefügt für den Observer
        container.innerHTML = `
            <div id="messenger-view-root" class="flex h-full w-full max-w-[1800px] mx-auto overflow-hidden bg-dark-card/50 backdrop-blur-sm md:rounded-2xl md:border md:border-white/5 shadow-2xl relative">
                
                <!-- 1. LEFT SIDEBAR (List) -->
                <div class="${this.state.mobileChatVisible && isMobile ? 'hidden' : 'flex'} w-full md:w-[380px] lg:w-[420px] flex-col border-r border-white/5 bg-dark-card/80 z-20 h-full">
                    
                    <!-- Sidebar Header -->
                    <div class="messenger-sidebar-header h-16 px-5 flex items-center justify-between shrink-0 border-b border-white/5 bg-dark-bg/50 backdrop-blur-md">
                        <h2 class="font-bold text-white text-lg tracking-tight">Nachrichten</h2>
                        <!-- Buttons entfernt wie gewünscht -->
                    </div>

                    <!-- Search Bar -->
                    <div class="p-3 shrink-0">
                        <div class="relative group">
                            <i class="fa-solid fa-search absolute left-3 top-1/2 -translate-y-1/2 text-dark-muted group-focus-within:text-brand-500 transition-colors"></i>
                            <input type="text" 
                                placeholder="Suchen..." 
                                value="${this.state.filterTerm}" 
                                onkeyup="MessengerView.handleSearch(this.value)" 
                                class="w-full bg-dark-bg border border-white/5 rounded-xl py-2.5 pl-10 pr-4 text-sm text-white focus:outline-none focus:border-brand-500/50 focus:bg-dark-bg/80 transition-all placeholder-dark-muted/50">
                        </div>
                    </div>

                    <!-- Chat List -->
                    <div id="messenger-list" class="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
                    </div>
                </div>

                <!-- 2. RIGHT CHAT AREA -->
                <div id="messenger-chat-area" class="${this.state.mobileChatVisible && isMobile ? 'flex fixed inset-0 z-50 slide-in-right' : 'hidden md:flex'} flex-col flex-1 bg-dark-bg relative w-full h-full overflow-hidden">
                    ${this.renderActiveChat(isMobile)}
                </div>

            </div>
        `;

        // --- CLEANUP WATCHER ---
        if (!this.state.observer) {
            this.state.observer = new MutationObserver((mutations) => {
                if (!document.getElementById('messenger-view-root')) {
                    document.documentElement.classList.remove('messenger-mode');
                    document.body.classList.remove('messenger-mode', 'chat-active', 'list-active');
                    if(this.state.observer) {
                        this.state.observer.disconnect();
                        this.state.observer = null;
                    }
                }
            });
            this.state.observer.observe(container, { childList: true });
        }

        this.renderSidebarList();
        
        if (this.state.activeId || this.state.activeType === 'news') {
             setTimeout(() => this.scrollToBottom(false), 50);
        }
    },

    // --- SIDEBAR LOGIC ---

    handleSearch(val) { 
        this.state.filterTerm = val.toLowerCase(); 
        this.renderSidebarList(); 
    },

    renderSidebarList() {
        const container = document.getElementById('messenger-list');
        if(!container) return;

        if (typeof Store === 'undefined' || !Store.state) {
            container.innerHTML = `<div class="p-4 text-center text-dark-muted text-sm animate-pulse">Lade Chats...</div>`;
            return;
        }

        const term = this.state.filterTerm;
        const myId = this.getMyId();
        const members = Store.state.members || [];
        const groups = Store.state.groups || [];
        const me = members.find(m => m.id == myId) || { groups: [] };
        let items = [];

        // 1. News Channel
        if ('ankündigungen'.includes(term) || !term) {
            items.push({ 
                type: 'news', id: 0, name: 'Ankündigungen', 
                icon: 'fa-bullhorn', color: 'bg-orange-500/20 text-orange-400', 
                time: new Date() 
            });
        }

        // 2. Groups
        groups.forEach(g => {
             const inGroup = Array.isArray(me.groups) && me.groups.includes(g.name);
             if(inGroup && g.name.toLowerCase().includes(term)) {
                 const lastMsg = g.chat && g.chat.length > 0 ? g.chat[g.chat.length-1] : null;
                 items.push({ 
                     type: 'group', id: g.id, name: g.name, 
                     icon: 'fa-users', color: 'bg-brand-500/20 text-brand-400',
                     lastMsg, time: lastMsg ? new Date(lastMsg.time) : new Date(0) 
                 });
             }
        });

        // 3. Private Chats
        members.filter(m => m.id != myId).forEach(m => {
            const name = `${m.firstName} ${m.lastName}`;
            const chat = this.getMemberChat(m);
            if (term && name.toLowerCase().includes(term) || (!term && chat.length > 0)) {
                items.push({ 
                    type: 'private', id: m.id, name, 
                    img: null, // Avatar Logik könnte hier hin
                    initials: m.firstName.charAt(0),
                    color: 'bg-indigo-500/20 text-indigo-400',
                    lastMsg: chat[chat.length-1], 
                    time: chat.length > 0 ? new Date(chat[chat.length-1].time) : new Date(0) 
                });
            }
        });

        // Sort & Render
        // Filtere Duplikate (falls welche entstehen)
        items = items.filter((v,i,a)=>a.findIndex(t=>(t.id === v.id && t.type===v.type))===i); 
        
        // SORTIERUNG: Ankündigungen (news) immer zuerst, dann nach Zeit
        items.sort((a, b) => {
            if (a.type === 'news') return -1; // a ist News -> a kommt zuerst
            if (b.type === 'news') return 1;  // b ist News -> b kommt zuerst
            return b.time - a.time;           // Sonst nach Zeit
        });

        if (items.length === 0) {
            container.innerHTML = `<div class="flex flex-col items-center justify-center pt-10 text-dark-muted"><i class="fa-solid fa-comment-slash text-2xl mb-2"></i><p class="text-xs">Keine Chats gefunden.</p></div>`;
            return;
        }

        container.innerHTML = items.map(item => this.renderListItem(item)).join('');
    },

    renderListItem(item) {
        const isActive = this.state.activeType === item.type && (item.type === 'news' || this.state.activeId == item.id);
        
        let preview = '<span class="italic opacity-50">Tippen zum Starten</span>';
        let dateStr = "";
        
        if (item.lastMsg) {
            const txt = item.lastMsg.text || (item.lastMsg.type === 'image' ? '📷 Foto' : (item.lastMsg.type === 'poll' ? '📊 Umfrage' : '📎 Datei'));
            const myId = this.getMyId();
            const isMe = item.lastMsg.senderId ? (item.lastMsg.senderId == myId) : item.lastMsg.isMe;
            const check = isMe ? `<i class="fa-solid fa-check-double text-[10px] ${item.lastMsg.read ? 'text-blue-400' : 'text-dark-muted'} mr-1"></i>` : '';
            preview = `${check}${txt}`;
            
            const d = new Date(item.lastMsg.time);
            dateStr = (d.toDateString() === new Date().toDateString()) ? d.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : d.toLocaleDateString([], {day:'2-digit', month:'2-digit'});
        }

        const avatar = item.img 
            ? `<img src="${item.img}" class="w-full h-full object-cover">`
            : `<div class="w-full h-full flex items-center justify-center font-bold text-sm ${item.color}">${item.icon ? `<i class="fa-solid ${item.icon}"></i>` : item.initials}</div>`;

        return `
            <div onclick="MessengerView.selectChat('${item.type}', '${item.id}')" 
                 class="group flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all border border-transparent ${isActive ? 'bg-brand-500/10 border-brand-500/20' : 'hover:bg-white/5 hover:border-white/5'}">
                
                <div class="relative w-12 h-12 rounded-full overflow-hidden shrink-0 shadow-lg bg-dark-bg border border-white/5">
                    ${avatar}
                </div>
                
                <div class="flex-1 min-w-0">
                    <div class="flex justify-between items-baseline mb-0.5">
                        <h3 class="text-white font-medium text-[15px] truncate group-hover:text-brand-400 transition-colors ${isActive ? 'text-brand-400' : ''}">${item.name}</h3>
                        <span class="text-[10px] text-dark-muted shrink-0">${dateStr}</span>
                    </div>
                    <p class="text-sm text-dark-muted truncate pr-2 opacity-80 group-hover:opacity-100 group-hover:text-gray-300 transition-all">
                        ${preview}
                    </p>
                </div>
            </div>
        `;
    },

    // --- CHAT INTERACTION ---

    selectChat(type, id) {
        if (id && !isNaN(id)) id = Number(id);
        
        this.state.activeType = type;
        this.state.activeId = id;
        this.state.showAttachMenu = false;
        this.state.mobileChatVisible = true; 
        this.state.showChatSearch = false;
        this.state.chatFilterTerm = '';

        this.render(document.getElementById('content'));
    },

    closeChat() {
        this.state.mobileChatVisible = false;
        this.render(document.getElementById('content'));
    },

    // --- CHAT AREA RENDER ---

    renderActiveChat(isMobile) {
        // EMPTY STATE (Desktop)
        if (!this.state.activeId && this.state.activeType !== 'news' && !isMobile) {
            return `
                <div class="flex flex-col items-center justify-center h-full text-center p-8 bg-dark-bg msg-bg-pattern">
                    <div class="w-32 h-32 rounded-3xl bg-dark-card border border-white/5 flex items-center justify-center mb-6 shadow-2xl rotate-3">
                        <i class="fa-solid fa-comments text-5xl text-dark-muted/50"></i>
                    </div>
                    <h2 class="text-2xl font-bold text-white mb-2">Vereins Messenger</h2>
                    <p class="text-dark-muted max-w-xs">Wähle einen Chat aus der Liste, um Nachrichten zu senden und zu empfangen.</p>
                </div>
            `;
        }

        // DATA GATHERING
        const { activeType: type, activeId: id } = this.state;
        const news = (Store.state && Store.state.news) ? Store.state.news : [];
        const groups = (Store.state && Store.state.groups) ? Store.state.groups : [];
        const members = (Store.state && Store.state.members) ? Store.state.members : [];

        let title = "Chat", subTitle = "", messages = [], canWrite = true, headerAction = "";

        if (type === 'news') {
            title = "Ankündigungen"; 
            subTitle = "Offizieller Kanal";
            messages = news.map(n => ({ 
                id: n.id, sender: 'Vorstand', text: `📢 **${n.title}**\n\n${n.content}`, 
                time: n.date, isMe: false, isSystem: true 
            })).sort((a,b) => new Date(a.time) - new Date(b.time));
            canWrite = App.can('admin'); 
        } else if (type === 'group') {
            const g = groups.find(x => x.id == id);
            if(g) { 
                title = g.name; 
                subTitle = `${g.members ? g.members.length : 0} Teilnehmer`; 
                messages = g.chat || [];
                headerAction = `onclick="MessengerView.showGroupInfo('${id}')"`;
            }
        } else if (type === 'private') {
            const m = members.find(x => x.id == id);
            if(m) { 
                title = `${m.firstName} ${m.lastName}`; 
                subTitle = m.role || 'Mitglied'; 
                messages = this.getMemberChat(m);
                headerAction = `onclick="MessengerView.showUserProfile('${id}')"`;
            }
        }

        // Filter Logic
        if (this.state.chatFilterTerm) {
            messages = messages.filter(m => m.text && m.text.toLowerCase().includes(this.state.chatFilterTerm));
        }

        // HEADER (Fixed Position with explicit styling for Mobile)
        // WICHTIG: fixed top-0 w-full sorgt dafür, dass der Header beim Scrollen oder Keyboard-Öffnen oben bleibt.
        // Nur auf Mobile anwenden (via media query oder isMobile check, hier im Kontext des Flex layouts).
        // Im 'messenger-mode' ist #content fixed, daher ist absolute top-0 relativ zum #content ausreichend.
        // Wenn die Tastatur den Viewport verkleinert, bleibt top-0 oben.
        const headerStyle = isMobile ? 'absolute top-0 left-0 right-0 z-50' : 'relative z-30';

        const header = `
            <div class="${headerStyle} h-16 px-4 bg-dark-card/90 backdrop-blur-xl border-b border-white/5 flex items-center justify-between shadow-lg shrink-0">
                <div class="flex items-center gap-3 overflow-hidden">
                    <button onclick="MessengerView.closeChat()" class="md:hidden w-8 h-8 flex items-center justify-center text-white/70 hover:text-white rounded-full hover:bg-white/10 -ml-2">
                        <i class="fa-solid fa-arrow-left"></i>
                    </button>
                    
                    <div class="flex items-center gap-3 cursor-pointer group" ${headerAction}>
                        <div class="w-10 h-10 rounded-full ${type==='private'?'bg-indigo-500':'bg-brand-600'} flex items-center justify-center text-white font-bold shadow-glow text-sm">
                            ${type === 'private' ? title.charAt(0) : '<i class="fa-solid fa-users"></i>'}
                        </div>
                        <div class="flex flex-col justify-center overflow-hidden">
                            <h3 class="text-white font-bold text-base leading-none truncate group-hover:text-brand-400 transition-colors">${title}</h3>
                            <p class="text-dark-muted text-xs truncate mt-1">${subTitle}</p>
                        </div>
                    </div>
                </div>

                <div class="flex items-center gap-2">
                     <button onclick="MessengerView.toggleChatSearch()" class="w-9 h-9 flex items-center justify-center rounded-full hover:bg-white/5 text-dark-muted hover:text-white transition-colors">
                        <i class="fa-solid fa-search"></i>
                     </button>
                </div>
                ${this.state.showChatSearch ? `
                <div class="absolute top-0 left-0 w-full h-16 bg-dark-card z-50 flex items-center px-4 animate-msg border-b border-white/5">
                    <button onclick="MessengerView.toggleChatSearch()" class="mr-3 text-dark-muted hover:text-white"><i class="fa-solid fa-arrow-left"></i></button>
                    <input type="text" placeholder="In diesem Chat suchen..." value="${this.state.chatFilterTerm}" onkeyup="MessengerView.handleChatFilter(this.value)" class="flex-1 bg-transparent border-none text-white focus:outline-none placeholder-dark-muted" autoFocus>
                </div>` : ''}
            </div>
        `;

        // MESSAGES
        const msgsHtml = messages.length 
            ? messages.map(msg => this.renderMessageBubble(msg)).join('')
            : `<div class="flex flex-col items-center justify-center mt-20 opacity-50">
                <div class="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center mb-4"><i class="fa-solid fa-hand-sparkles text-3xl text-brand-500"></i></div>
                <p class="text-dark-muted text-sm">Sag Hallo!</p>
               </div>`;

        // INPUT AREA
        const inputArea = canWrite ? this.renderInputArea() : `<div class="p-4 bg-dark-card/90 text-center text-dark-muted text-xs uppercase font-bold tracking-widest border-t border-white/5 shrink-0">Nur Lesen</div>`;

        // FULL FLEX CONTAINER
        // pt-16 für den fixierten Header
        return `
            <div class="flex flex-col h-full w-full relative">
                ${header}
                <div id="msg-scroll-container" class="flex-1 overflow-y-auto px-4 space-y-3 msg-bg-pattern chat-scroll pt-20 pb-4">
                    ${msgsHtml}
                    <div class="h-2"></div>
                </div>
                ${inputArea}
            </div>
        `;
    },

    renderInputArea() {
        const replyMsg = this.state.replyingTo ? this.findMessage(this.state.replyingTo) : null;
        
        // Input ist jetzt Teil des Flex Flows (shrink-0)
        return `
            <div class="p-3 md:p-4 bg-dark-card border-t border-white/5 shrink-0 safe-bottom z-30">
                
                <!-- Helper Menus (Absolute, überlappend) -->
                ${this.renderAttachMenu()}

                <!-- Reply Preview -->
                ${replyMsg ? `
                <div id="reply-preview-box" class="flex items-center justify-between bg-dark-bg/50 p-2 rounded-lg border-l-2 border-brand-500 mb-2 animate-msg backdrop-blur-md">
                    <div class="text-xs overflow-hidden">
                        <span class="text-brand-500 font-bold block mb-0.5">${replyMsg.sender}</span>
                        <span class="text-dark-muted truncate block max-w-[200px]">${replyMsg.text}</span>
                    </div>
                    <button onclick="MessengerView.cancelReply()" class="w-6 h-6 flex items-center justify-center hover:bg-white/10 rounded-full text-dark-muted"><i class="fa-solid fa-times"></i></button>
                </div>` : ''}

                <!-- Input Row -->
                <div class="flex items-end gap-2">
                    <button onclick="MessengerView.toggleAttachMenu()" class="w-10 h-10 mb-0.5 rounded-full hover:bg-white/5 text-dark-muted hover:text-brand-400 transition-colors flex items-center justify-center shrink-0">
                        <i class="fa-solid fa-plus text-lg"></i>
                    </button>
                    
                    <form onsubmit="MessengerView.sendMessage(event)" class="flex-1 bg-dark-bg border border-white/10 focus-within:border-brand-500/50 rounded-2xl flex items-end px-3 py-2 transition-colors relative">
                        <input type="text" name="message" id="chat-input" autocomplete="off" placeholder="Nachricht..." 
                            class="flex-1 bg-transparent border-none text-white text-sm focus:outline-none placeholder-dark-muted/50 max-h-24 py-1">
                        <button type="submit" class="w-8 h-8 rounded-full bg-brand-600 hover:bg-brand-500 text-white shadow-glow flex items-center justify-center transition-all ml-2 mb-0.5 active:scale-90">
                            <i class="fa-solid fa-paper-plane text-xs"></i>
                        </button>
                    </form>
                </div>
            </div>
        `;
    },

    renderMessageBubble(msg) {
        if (msg.isSystem) return `<div class="flex justify-center my-4"><span class="bg-white/5 backdrop-blur-md text-dark-muted text-[10px] px-3 py-1 rounded-full uppercase font-bold tracking-widest shadow-sm border border-white/5">${msg.text}</span></div>`;
        
        const myId = this.getMyId();
        const me = (Store.state.members || []).find(m => m.id == myId);
        let isMe = false;
        if (msg.senderId) isMe = (msg.senderId == myId);
        else if (msg.hasOwnProperty('isMe')) isMe = msg.isMe; 
        
        const isDeleted = msg.isDeleted;
        
        // Styles
        const align = isMe ? 'items-end' : 'items-start';
        // Eigene Nachricht: Brand Color gradient, Fremde Nachricht: Dark Card
        const bgClass = isMe 
            ? 'bg-gradient-to-br from-brand-600 to-blue-700 text-white shadow-lg shadow-brand-500/10' 
            : 'bg-dark-card border border-white/5 text-gray-100 shadow-md';
        
        const tailClass = isMe ? 'bubble-tail-out' : 'bubble-tail-in';

        // Content
        let contentHtml = isDeleted 
            ? `<span class="italic text-white/50 flex items-center gap-1 text-xs"><i class="fa-solid fa-ban"></i> Nachricht gelöscht</span>` 
            : `<span class="text-[15px] leading-relaxed block">${msg.text.replace(/\n/g, '<br>')}</span>`;

        if (msg.type === 'image') contentHtml = `<div class="mb-1 overflow-hidden rounded-lg border border-white/10"><img src="${msg.content}" class="max-w-full sm:max-w-[280px] cursor-pointer hover:opacity-90 transition-opacity" onclick="window.open('${msg.content}')"></div>`;
        if (msg.type === 'poll') contentHtml = this.renderPoll(msg);

        // Reply Reference
        let replyHtml = '';
        if (msg.replyToId) {
            const parent = this.findMessage(msg.replyToId);
            if(parent) replyHtml = `
                <div class="bg-black/20 rounded p-1.5 mb-1.5 text-xs border-l-2 border-white/30 cursor-pointer hover:bg-black/30 transition">
                    <span class="font-bold opacity-80 block mb-0.5">${parent.sender}</span>
                    <span class="opacity-60 truncate block">${parent.text}</span>
                </div>`;
        }

        const ctxId = `ctx-${msg.id}`;

        return `
            <div id="msg-${msg.id}" class="flex flex-col ${align} group relative w-full animate-msg">
                <div class="relative max-w-[85%] md:max-w-[60%] min-w-[100px] ${bgClass} px-3 py-2 rounded-2xl ${tailClass}">
                    
                    <!-- Context Menu Trigger -->
                    <button onclick="MessengerView.toggleMsgMenu('${ctxId}')" class="absolute top-1 right-1 w-6 h-6 flex items-center justify-center text-white/50 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity z-10">
                        <i class="fa-solid fa-angle-down"></i>
                    </button>

                    ${replyHtml}
                    ${!isMe && this.state.activeType === 'group' ? `<p class="text-[11px] font-bold text-brand-400 mb-0.5">${msg.sender}</p>` : ''}
                    ${contentHtml}
                    
                    <div class="flex items-center justify-end gap-1 mt-1 opacity-60">
                         <span class="text-[10px] font-medium">${new Date(msg.time).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</span>
                         ${isMe ? '<i class="fa-solid fa-check-double text-[10px]"></i>' : ''}
                    </div>
                </div>

                <!-- Context Menu -->
                <div id="${ctxId}" class="hidden absolute top-8 ${isMe ? 'right-0' : 'left-0'} bg-dark-card border border-white/10 rounded-xl shadow-2xl z-50 w-48 overflow-hidden animate-msg">
                    <div class="flex justify-around p-2 bg-white/5 border-b border-white/5">
                        ${['👍','❤️','😂','😮'].map(e => `<button onclick="MessengerView.reactToMessage('${msg.id}', '${e}')" class="hover:scale-125 transition text-lg">${e}</button>`).join('')}
                    </div>
                    <div class="p-1">
                        <button onclick="MessengerView.replyTo('${msg.id}')" class="w-full text-left px-3 py-2 text-sm text-dark-muted hover:text-white hover:bg-white/5 rounded-lg flex items-center gap-3"><i class="fa-solid fa-reply w-4"></i> Antworten</button>
                        <button onclick="MessengerView.copyMessageText('${msg.text}')" class="w-full text-left px-3 py-2 text-sm text-dark-muted hover:text-white hover:bg-white/5 rounded-lg flex items-center gap-3"><i class="fa-regular fa-copy w-4"></i> Kopieren</button>
                        ${isMe ? `<button onclick="MessengerView.deleteMessage('${msg.id}')" class="w-full text-left px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 rounded-lg flex items-center gap-3"><i class="fa-solid fa-trash w-4"></i> Löschen</button>` : ''}
                    </div>
                </div>
            </div>
        `;
    },

    renderPoll(msg) {
        // Simple Poll Visualization
        const q = msg.content.question;
        const opts = msg.content.options || [];
        return `
            <div class="font-bold mb-2 text-sm">${q}</div>
            <div class="space-y-1.5">
                ${opts.map(o => `
                    <div onclick="MessengerView.votePoll('${msg.id}', ${o.id})" class="relative h-8 bg-black/20 rounded-lg overflow-hidden cursor-pointer hover:bg-black/30 border border-white/10">
                         <div class="absolute left-0 top-0 h-full bg-white/20" style="width: ${o.votes.length * 10}%"></div>
                         <div class="absolute inset-0 flex items-center justify-between px-3 text-xs">
                             <span>${o.text}</span>
                             <span class="font-bold">${o.votes.length}</span>
                         </div>
                    </div>
                `).join('')}
            </div>
        `;
    },

    // --- MENUS & FEATURES ---

    renderAttachMenu() {
        if (!this.state.showAttachMenu) return '';
        const items = [
            { icon: 'fa-image', bg: 'bg-purple-500', label: 'Medien', action: 'image' },
            { icon: 'fa-file', bg: 'bg-blue-500', label: 'Datei', action: 'file' },
            { icon: 'fa-square-poll-vertical', bg: 'bg-teal-500', label: 'Umfrage', action: 'poll' }
        ];
        return `
            <div class="absolute bottom-20 left-4 flex flex-col gap-3 animate-msg z-40">
                ${items.map(i => `
                    <button onclick="MessengerView.handleAttachment('${i.action}')" class="flex items-center gap-3 group">
                        <div class="w-12 h-12 rounded-full ${i.bg} text-white flex items-center justify-center shadow-lg shadow-black/30 hover:scale-110 transition-transform">
                            <i class="fa-solid ${i.icon}"></i>
                        </div>
                        <span class="bg-dark-card border border-white/10 text-white text-xs px-2 py-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity shadow-md pointer-events-none">${i.label}</span>
                    </button>
                `).reverse().join('')}
            </div>
        `;
    },

    // --- ACTIONS & UTILS ---

    toggleChatSearch() { this.state.showChatSearch = !this.state.showChatSearch; if(!this.state.showChatSearch) this.state.chatFilterTerm = ''; this.render(document.getElementById('content')); },
    handleChatFilter(val) { this.state.chatFilterTerm = val.toLowerCase(); this.render(document.getElementById('content')); },
    
    toggleMsgMenu(id) {
        const el = document.getElementById(id);
        if(el) {
            document.querySelectorAll('[id^="ctx-"]').forEach(x => { if(x.id!==id) x.classList.add('hidden') });
            el.classList.toggle('hidden');
            // Auto close click outside
            const close = (e) => { if(!el.contains(e.target)) { el.classList.add('hidden'); document.removeEventListener('click', close); }};
            setTimeout(() => document.addEventListener('click', close), 10);
        }
    },

    sendMessage(e) {
        e.preventDefault();
        const input = document.getElementById('chat-input');
        const text = input.value.trim();
        if(!text) return;
        
        this.addMessageToChat({ text, type: 'text', replyToId: this.state.replyingTo });
        
        input.value = '';
        
        // Reply Box visuell entfernen ohne kompletten Re-Render
        if (this.state.replyingTo) {
            this.state.replyingTo = null;
            const replyBox = document.getElementById('reply-preview-box');
            if(replyBox) replyBox.remove();
        }
        
        // Focus behalten
        input.focus();
    },

    addMessageToChat(msgData) {
        const myId = this.getMyId();
        const me = Store.state.members.find(m => m.id == myId) || { firstName: 'Ich' };
        
        const newMsg = {
            id: Date.now(),
            text: msgData.text,
            type: msgData.type || 'text',
            content: msgData.content || null,
            sender: me.firstName,
            senderId: myId,
            recipientId: this.state.activeId,
            isMe: true,
            time: new Date().toISOString(),
            replyToId: msgData.replyToId,
            isDeleted: false,
            read: false
        };

        // 1. Daten in Store/DB speichern
        if (this.state.activeType === 'group') {
             const g = Store.state.groups.find(x => x.id == this.state.activeId);
             if(g) {
                 if(!g.chat) g.chat = [];
                 g.chat.push(newMsg);
                 this.safeUpdate('groups', g);
             }
        } else if (this.state.activeType === 'private') {
             const meUser = Store.state.members.find(x => x.id == myId);
             const otherUser = Store.state.members.find(x => x.id == this.state.activeId);
             if(meUser) { if(!meUser.privateChat) meUser.privateChat=[]; meUser.privateChat.push(newMsg); this.safeUpdate('members', meUser); }
             if(otherUser) { if(!otherUser.privateChat) otherUser.privateChat=[]; otherUser.privateChat.push(newMsg); this.safeUpdate('members', otherUser); }
        }
        
        // 2. DOM direkt updaten (verhindert Re-Render & Wackeln)
        const container = document.getElementById('msg-scroll-container');
        if (container) {
            const html = this.renderMessageBubble(newMsg);
            container.insertAdjacentHTML('beforeend', html);
            setTimeout(() => this.scrollToBottom(true), 10);
        }
    },

    // Standard Features
    replyTo(id) { this.state.replyingTo = id; this.render(document.getElementById('content')); document.getElementById('chat-input')?.focus(); },
    cancelReply() { this.state.replyingTo = null; this.render(document.getElementById('content')); },
    deleteMessage(id) { /* Löschlogik analog zu deiner alten Datei */ this.render(document.getElementById('content')); },
    copyMessageText(txt) { navigator.clipboard.writeText(txt); if(window.App) window.App.showToast("Kopiert!"); },
    
    toggleAttachMenu() { this.state.showAttachMenu = !this.state.showAttachMenu; this.render(document.getElementById('content')); },
    
    handleAttachment(type) {
        if(type === 'poll') {
             const q = prompt("Frage:");
             if(q) this.addMessageToChat({ text: '', type: 'poll', content: { question: q, options: [{id:1, text:'Ja', votes:[]}, {id:2, text:'Nein', votes:[]}] } });
        } else {
             this.addMessageToChat({ text: '', type: 'image', content: 'https://picsum.photos/400/300' });
        }
        this.toggleAttachMenu();
    },

    getMemberChat(partner) {
        if (!partner) return [];
        const myId = this.getMyId();
        const me = (Store.state.members || []).find(m => m.id == myId);
        if(!me || !me.privateChat) return [];
        return me.privateChat.filter(msg => 
            (msg.senderId == myId && msg.recipientId == partner.id) || 
            (msg.senderId == partner.id && msg.recipientId == myId)
        );
    },

    findMessage(id) {
         // Helper um Nachricht zu finden (vereinfacht)
         if(this.state.activeType === 'group') {
             const g = Store.state.groups.find(x => x.id == this.state.activeId);
             return g?.chat?.find(m => m.id == id);
         }
         const me = Store.state.members.find(x => x.id == this.getMyId());
         return me?.privateChat?.find(m => m.id == id);
    },

    scrollToBottom(smooth) {
        const el = document.getElementById('msg-scroll-container');
        if(el) el.scrollTo({ top: el.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });
    },

    safeUpdate(table, item) {
        // Fallback wenn Supabase nicht global verfügbar ist
        if (typeof supabase === 'undefined' || typeof CONFIG === 'undefined') {
            if(window.Store) Store.update(table, item);
            return;
        }

        try {
            // Hole Session für Auth Header
            const sessionStr = localStorage.getItem('vm_supabase_session');
            const headers = {};
            if(sessionStr) { 
                const session = JSON.parse(sessionStr); 
                if(session?.access_token) headers.Authorization = `Bearer ${session.access_token}`; 
            }

            const sb = supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY, { global: { headers } });
            
            // WICHTIG: ID aus dem Update-Payload entfernen!
            const payload = { ...item }; 
            delete payload.id; 
            
            sb.from(table).update(payload).eq('id', item.id).then(({error}) => {
                if(error && window.App) window.App.showToast(error.message, 'error');
                else if(window.Store && window.Store.fetchTable) window.Store.fetchTable(table);
            });
        } catch(e) { 
            console.error(e); 
            // Fallback
            if(window.Store) Store.update(table, item);
        }
    },

    showUserProfile(id) { 
        if(window.App && App.openModal) {
            const member = Store.state.members.find(m => m.id == id);
            if(!member) return;
            
            // Format roles
            let roleDisplay = 'Mitglied';
            if (Array.isArray(member.roles) && member.roles.length > 0) roleDisplay = member.roles.join(', ');
            else if (member.role) roleDisplay = member.role;

            // Format groups
            let groupsHtml = '<span class="text-xs text-dark-muted italic">Keine Gruppen</span>';
            if (Array.isArray(member.groups) && member.groups.length > 0) {
                groupsHtml = member.groups.map(g => `<span class="bg-brand-500/10 text-brand-400 px-2 py-1 rounded text-xs border border-brand-500/20">${g}</span>`).join('');
            }

            const html = `
                <div class="p-6 flex flex-col items-center">
                    <div class="w-24 h-24 rounded-full bg-gradient-to-br from-slate-700 to-slate-800 flex items-center justify-center text-4xl text-slate-300 border-4 border-dark-card shadow-xl mb-4">
                        ${(member.firstName || '?').charAt(0)}${(member.lastName || '?').charAt(0)}
                    </div>
                    <h3 class="text-2xl font-bold text-white mb-1">${member.firstName} ${member.lastName}</h3>
                    <span class="px-3 py-1 rounded-full bg-brand-500/10 text-brand-400 text-xs font-bold uppercase tracking-wider mb-6 border border-brand-500/20">
                        ${roleDisplay}
                    </span>
                    
                    <div class="w-full bg-dark-bg/50 rounded-xl p-4 border border-dark-border text-left space-y-3 mb-6">
                        <div class="flex items-center gap-4">
                            <div class="w-10 h-10 rounded-lg bg-dark-card flex items-center justify-center text-dark-muted border border-dark-border shrink-0">
                                <i class="fa-solid fa-envelope"></i>
                            </div>
                            <div class="min-w-0">
                                <p class="text-xs text-dark-muted uppercase font-bold">Email</p>
                                <p class="text-sm text-white truncate">${member.email || '-'}</p>
                            </div>
                        </div>
                        
                        <div class="flex items-center gap-4">
                            <div class="w-10 h-10 rounded-lg bg-dark-card flex items-center justify-center text-dark-muted border border-dark-border shrink-0">
                                <i class="fa-solid fa-phone"></i>
                            </div>
                            <div class="min-w-0">
                                <p class="text-xs text-dark-muted uppercase font-bold">Telefon</p>
                                <p class="text-sm text-white truncate">${member.phone || '-'}</p>
                            </div>
                        </div>
                    </div>

                    <div class="w-full text-left mb-6">
                        <h4 class="text-xs font-bold text-dark-muted uppercase mb-3 pl-1">Gruppen</h4>
                        <div class="flex flex-wrap gap-2">
                            ${groupsHtml}
                        </div>
                    </div>

                    <button onclick="App.closeModal()" class="w-full py-3 rounded-xl bg-dark-card hover:bg-dark-hover border border-dark-border text-white font-bold transition-all">
                        Schließen
                    </button>
                </div>
            `;
            App.openModal(html);
        }
    },
    
    showGroupInfo(id) { if(window.App && App.router) App.router('groups'); }
};

window.MessengerView = MessengerView;
