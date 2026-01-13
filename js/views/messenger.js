/**
 * =============================================================================
 * MODERN MESSENGER VIEW (Responsive & Integrated)
 * Design: Glassmorphism / Tailwind Slate Theme
 * Features: Fullscreen Mobile Chat, Real-time Search, Attachments, Polls, Auto-Refresh
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
        showEmojiPicker: false,
        mobileChatVisible: false, // Steuert Mobile View (List vs. Chat)
        
        replyingTo: null,
        editingId: null,
        scrollPositions: {},
        
        pollingInterval: null // Für Auto-Refresh
    },

    // --- CONFIG & THEME ---
    // Wir nutzen Tailwind Klassen, aber hier definieren wir dynamische Werte
    config: {
        bgPatternOpacity: '0.03', // Subtiler Pattern Hintergrund
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
        
        // SVG Pattern (Subtiles Hexagon/Dot Pattern passend zum Dark Mode)
        const pattern = `data:image/svg+xml,%3Csvg width='20' height='20' viewBox='0 0 20 20' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%2394a3b8' fill-opacity='0.1' fill-rule='evenodd'%3E%3Ccircle cx='3' cy='3' r='3'/%3E%3Ccircle cx='13' cy='13' r='3'/%3E%3C/g%3E%3C/svg%3E`;

        style.innerHTML = `
            .msg-bg-pattern {
                background-color: #0f172a; /* Slate 900 */
                background-image: url("${pattern}");
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
            
            /* Basis für Messenger Mode (Header weg, Padding weg) */
            body.messenger-mode #main-header { display: none !important; }
            body.messenger-mode #content { padding: 0 !important; height: 100vh !important; overflow: hidden !important; }

            /* A) CHAT ACTIVE: Kein Footer, Kein Header */
            body.messenger-mode.chat-active #mobile-bottom-nav { display: none !important; }
            
            /* B) LIST ACTIVE: Footer sichtbar, Header weg */
            body.messenger-mode.list-active #mobile-bottom-nav { display: flex !important; }
            body.messenger-mode.list-active #messenger-list { padding-bottom: 90px !important; } /* Platz für Footer */
            
            /* Safe Area Top fix für Liste ohne Header */
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
        document.body.classList.remove('messenger-mode', 'chat-active', 'list-active');

        if (isMobile) {
            document.body.classList.add('messenger-mode');
            if (this.state.mobileChatVisible) {
                // Chat offen: Vollbild komplett
                document.body.classList.add('chat-active');
            } else {
                // Liste offen: Vollbild aber mit Footer
                document.body.classList.add('list-active');
            }
        }

        // Layout Template
        container.innerHTML = `
            <div class="flex h-full w-full max-w-[1800px] mx-auto overflow-hidden bg-dark-card/50 backdrop-blur-sm md:rounded-2xl md:border md:border-white/5 shadow-2xl relative">
                
                <!-- 1. LEFT SIDEBAR (List) -->
                <!-- Auf Mobile ausgeblendet, wenn Chat aktiv ist -->
                <div class="${this.state.mobileChatVisible && isMobile ? 'hidden' : 'flex'} w-full md:w-[380px] lg:w-[420px] flex-col border-r border-white/5 bg-dark-card/80 z-20">
                    
                    <!-- Sidebar Header (mit Safe Area Support) -->
                    <div class="messenger-sidebar-header h-16 px-5 flex items-center justify-between shrink-0 border-b border-white/5 bg-dark-bg/50 backdrop-blur-md">
                        <h2 class="font-bold text-white text-lg tracking-tight">Nachrichten</h2>
                        <div class="flex gap-2">
                             <button class="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-dark-muted hover:text-white transition-colors"><i class="fa-solid fa-pen-to-square"></i></button>
                             <button class="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-dark-muted hover:text-white transition-colors"><i class="fa-solid fa-ellipsis-vertical"></i></button>
                        </div>
                    </div>

                    <!-- Search Bar -->
                    <div class="p-3">
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
                        <!-- Wird durch renderSidebarList gefüllt -->
                    </div>
                </div>

                <!-- 2. RIGHT CHAT AREA -->
                <!-- Auf Mobile nur sichtbar wenn aktiv (Slide-In Effekt via CSS Klasse im Parent möglich) -->
                <div id="messenger-chat-area" class="${this.state.mobileChatVisible && isMobile ? 'flex fixed inset-0 z-50 slide-in-right' : 'hidden md:flex'} flex-col flex-1 bg-dark-bg relative w-full h-full">
                    ${this.renderActiveChat(isMobile)}
                </div>

            </div>
        `;

        this.renderSidebarList();
        
        // Auto-Refresh starten
        this.startPolling();
        
        // Scroll to bottom after render if chat is open
        if (this.state.activeId || this.state.activeType === 'news') {
             // Kurzer Timeout für DOM Rendering
             setTimeout(() => this.scrollToBottom(false), 50);
        }
    },

    // --- POLLING (AUTO REFRESH) ---
    startPolling() {
        // Verhindert doppelte Intervalle
        if (this.state.pollingInterval) return;
        
        // Check alle 3 Sekunden
        this.state.pollingInterval = setInterval(async () => {
            // Sicherheitscheck: Sind wir noch im Messenger?
            if (!document.getElementById('messenger-chat-area')) {
                this.stopPolling();
                return;
            }

            // Daten neu laden (Store triggert dann App.onUpdate -> render)
            if (typeof Store !== 'undefined' && Store.fetchTable) {
                // Optimierung: Nur laden was nötig ist
                if (this.state.activeType === 'private') {
                    await Store.fetchTable('members');
                } else if (this.state.activeType === 'group' || this.state.activeType === 'news') {
                    await Store.fetchTable('groups');
                    if(this.state.activeType === 'news') await Store.fetchTable('news');
                } else {
                    // Fallback: Alles laden
                    await Store.fetchTable('members');
                    await Store.fetchTable('groups');
                }
            }
        }, 3000); 
    },

    stopPolling() {
        if (this.state.pollingInterval) {
            clearInterval(this.state.pollingInterval);
            this.state.pollingInterval = null;
        }
        
        // Clean up body classes when leaving view
        document.body.classList.remove('messenger-mode', 'chat-active', 'list-active');
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
        items = items.filter((v,i,a)=>a.findIndex(t=>(t.id === v.id && t.type===v.type))===i); // Unique
        items.sort((a, b) => b.time - a.time);

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

        // Icon/Avatar Logic
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
        this.state.showEmojiPicker = false;
        this.state.mobileChatVisible = true; // Trigger Mobile Fullscreen
        this.state.showChatSearch = false;
        this.state.chatFilterTerm = '';

        // Trigger Re-Render
        this.render(document.getElementById('content'));
    },

    closeChat() {
        this.state.mobileChatVisible = false;
        // Trigger Re-Render to show list again and hide chat
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
            canWrite = App.can('admin'); // Nur Admins schreiben
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

        // HEADER
        const header = `
            <div class="h-16 px-4 bg-dark-card/90 backdrop-blur-xl border-b border-white/5 flex items-center justify-between shadow-lg z-30 shrink-0">
                <div class="flex items-center gap-3 overflow-hidden">
                    <!-- BACK BUTTON (MOBILE ONLY) -->
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
                     <button class="w-9 h-9 flex items-center justify-center rounded-full hover:bg-white/5 text-dark-muted hover:text-white transition-colors">
                        <i class="fa-solid fa-ellipsis-vertical"></i>
                     </button>
                </div>
            </div>
            
            <!-- SEARCH BAR OVERLAY -->
            ${this.state.showChatSearch ? `
            <div class="absolute top-0 left-0 w-full h-16 bg-dark-card z-40 flex items-center px-4 animate-msg border-b border-white/5">
                <button onclick="MessengerView.toggleChatSearch()" class="mr-3 text-dark-muted hover:text-white"><i class="fa-solid fa-arrow-left"></i></button>
                <input type="text" placeholder="In diesem Chat suchen..." value="${this.state.chatFilterTerm}" onkeyup="MessengerView.handleChatFilter(this.value)" class="flex-1 bg-transparent border-none text-white focus:outline-none placeholder-dark-muted" autoFocus>
            </div>` : ''}
        `;

        // MESSAGES
        const msgsHtml = messages.length 
            ? messages.map(msg => this.renderMessageBubble(msg)).join('')
            : `<div class="flex flex-col items-center justify-center mt-20 opacity-50">
                <div class="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center mb-4"><i class="fa-solid fa-hand-sparkles text-3xl text-brand-500"></i></div>
                <p class="text-dark-muted text-sm">Sag Hallo!</p>
               </div>`;

        // INPUT AREA
        const inputArea = canWrite ? this.renderInputArea() : `<div class="p-4 bg-dark-card/90 text-center text-dark-muted text-xs uppercase font-bold tracking-widest border-t border-white/5">Nur Lesen</div>`;

        return `
            ${header}
            <div id="msg-scroll-container" class="flex-1 overflow-y-auto px-4 py-4 space-y-3 msg-bg-pattern chat-scroll relative">
                ${msgsHtml}
                <div class="h-2"></div>
            </div>
            ${inputArea}
        `;
    },

    renderInputArea() {
        const replyMsg = this.state.replyingTo ? this.findMessage(this.state.replyingTo) : null;
        
        return `
            <div class="p-3 md:p-4 bg-dark-card border-t border-white/5 relative z-30 shrink-0 safe-bottom">
                
                <!-- Helper Menus (Absolute) -->
                ${this.renderAttachMenu()}
                ${this.renderEmojiPicker()}

                <!-- Reply Preview -->
                ${replyMsg ? `
                <div class="flex items-center justify-between bg-dark-bg/50 p-2 rounded-lg border-l-2 border-brand-500 mb-2 animate-msg backdrop-blur-md">
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
                        <button type="button" onclick="MessengerView.toggleEmojiPicker()" class="text-dark-muted hover:text-yellow-400 transition-colors mr-2 mb-1">
                            <i class="fa-regular fa-face-smile text-lg"></i>
                        </button>
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

    renderEmojiPicker() {
        if (!this.state.showEmojiPicker) return '';
        const emojis = ['👍','❤️','😂','😮','🙏','🔥','🎉','👋','😎','🤔','👀','💯','🚀','⚽','🍺','✅','❌','❓'];
        return `
            <div class="absolute bottom-20 left-2 bg-dark-card border border-white/10 rounded-2xl p-3 shadow-2xl z-40 w-64 animate-msg">
                <div class="grid grid-cols-6 gap-1">
                    ${emojis.map(e => `<button onclick="MessengerView.addEmoji('${e}')" class="p-2 hover:bg-white/10 rounded-lg transition text-xl">${e}</button>`).join('')}
                </div>
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
        this.state.replyingTo = null;
        this.render(document.getElementById('content'));
        
        // Focus zurück
        setTimeout(() => document.getElementById('chat-input')?.focus(), 10);
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

        // Speichern (Mock Implementation der Logik aus deiner alten Datei)
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
        
        // Scrollen
        setTimeout(() => this.scrollToBottom(true), 50);
    },

    // Standard Features
    replyTo(id) { this.state.replyingTo = id; this.render(document.getElementById('content')); document.getElementById('chat-input')?.focus(); },
    cancelReply() { this.state.replyingTo = null; this.render(document.getElementById('content')); },
    deleteMessage(id) { /* Löschlogik analog zu deiner alten Datei */ this.render(document.getElementById('content')); },
    copyMessageText(txt) { navigator.clipboard.writeText(txt); if(window.App) window.App.showToast("Kopiert!"); },
    
    toggleAttachMenu() { this.state.showAttachMenu = !this.state.showAttachMenu; this.state.showEmojiPicker = false; this.render(document.getElementById('content')); },
    toggleEmojiPicker() { this.state.showEmojiPicker = !this.state.showEmojiPicker; this.state.showAttachMenu = false; this.render(document.getElementById('content')); },
    addEmoji(e) { const inp = document.getElementById('chat-input'); if(inp) { inp.value += e; inp.focus(); } },
    
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

    showUserProfile(id) { if(window.App && App.openModal) App.openModal(`<div class="p-4 text-center text-white">Profil von ID ${id}</div>`); },
    showGroupInfo(id) { if(window.App && App.router) App.router('groups'); }
};

window.MessengerView = MessengerView;
