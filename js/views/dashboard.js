/**
 * =============================================================================
 * DASHBOARD VIEW
 * Die Startseite der App mit Übersichtskacheln
 * =============================================================================
 */

const DashboardView = {
    /**
     * Rendert die Dashboard-Ansicht in den Container
     */
    render(container) {
        // Zugriff auf den globalen Store und User
        // Fallback, falls Store noch lädt
        const s = (typeof Store !== 'undefined' && Store.state) ? Store.state : {};
        const currentUser = (typeof App !== 'undefined' && App.state) ? App.state.currentUser : null;
        const myId = currentUser ? currentUser.id : (localStorage.getItem('vm_current_user_id') || 1);
        
        // Sicherheits-Check: Falls Daten noch laden, leere Arrays nutzen
        const members = s.members || [];
        const events = s.events || [];
        const news = s.news || [];
        const docs = s.docs || [];
        const groups = s.groups || [];
        const workEntries = s.work_entries || [];

        const userObj = members.find(m => m.id == myId) || (currentUser || { firstName: 'Nutzer' });

        // Daten aggregieren
        const activeMembers = members.filter(m => m.status === 'active').length;
        // Nur globale Events für die Vorschau
        const globalEvents = events.filter(e => !e.group).sort((a,b) => new Date(a.date) - new Date(b.date));
        
        const latestNews = news.length > 0 ? news[0] : null;
        
        const docCount = docs.length;
        const groupCount = groups.length;
        
        // Arbeitsstunden berechnen
        // Wir prüfen sowohl memberId als auch Strings/Numbers sicherheitshalber
        const myWorkEntries = workEntries.filter(e => e.memberId == myId && e.status === 'approved');
        const myHours = myWorkEntries.reduce((sum, e) => sum + parseFloat(e.hours || 0), 0);
        
        // DYNAMISCHES ZIEL: Prüfen ob User ein individuelles Ziel hat, sonst Standard 6h
        const hoursTarget = (userObj && userObj.workTarget) ? parseInt(userObj.workTarget) : 6;
        
        const percent = Math.min(100, (myHours / hoursTarget) * 100);

        // Begrüßung nach Tageszeit
        const hour = new Date().getHours();
        const greeting = hour < 12 ? 'Guten Morgen' : hour < 18 ? 'Guten Tag' : 'Guten Abend';

        container.innerHTML = `
            <div class="fade-in space-y-6 md:space-y-8 pb-20">
                
                <!-- 1. Header Section -->
                <div class="flex flex-col md:flex-row justify-between items-start md:items-end gap-2 px-1">
                    <div>
                        <h1 class="text-2xl md:text-4xl font-bold text-white mb-1">
                            ${greeting}, <span class="text-transparent bg-clip-text bg-gradient-to-r from-brand-500 to-indigo-400">${userObj.firstName}</span>!
                        </h1>
                        <p class="text-sm md:text-base text-dark-muted">Hier ist dein aktueller Vereins-Überblick.</p>
                    </div>
                    <div class="text-right hidden md:block">
                        <p class="text-xl font-bold text-white first-letter:uppercase">${new Date().toLocaleDateString('de-DE', { weekday: 'long' })}</p>
                        <p class="text-sm text-brand-500">${new Date().toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                    </div>
                </div>

                <!-- 2. Hero Section (News) -->
                <div onclick="App.router('news')" class="bg-dark-card border border-dark-border rounded-3xl p-6 md:p-8 relative overflow-hidden group hover:border-dark-muted/50 transition-all cursor-pointer flex flex-col justify-center min-h-[200px] shadow-lg">
                    <div class="absolute inset-0 bg-gradient-to-r from-transparent via-transparent to-brand-900/10 pointer-events-none"></div>
                    
                    ${latestNews ? `
                        <div class="flex items-start justify-between gap-4">
                            <div class="flex-1 z-10">
                                <div class="flex items-center gap-3 mb-3">
                                    <span class="bg-red-500/10 text-red-400 text-[10px] md:text-xs font-bold px-2 py-1 rounded-md border border-red-500/20 animate-pulse">NEU</span>
                                    <span class="text-xs text-dark-muted"><i class="fa-regular fa-clock mr-1"></i> ${new Date(latestNews.date).toLocaleDateString()}</span>
                                </div>
                                <h3 class="text-xl md:text-3xl font-bold text-white mb-2 md:mb-3 line-clamp-2 leading-tight group-hover:text-brand-400 transition-colors">
                                    ${latestNews.title}
                                </h3>
                                <p class="text-dark-muted line-clamp-2 md:line-clamp-2 text-sm md:text-base mb-4">
                                    ${latestNews.content}
                                </p>
                                <span class="text-brand-500 text-xs md:text-sm font-bold flex items-center group-hover:underline">
                                    Ganzen Beitrag lesen <i class="fa-solid fa-arrow-right ml-2 transition-transform group-hover:translate-x-1"></i>
                                </span>
                            </div>
                            <div class="hidden sm:flex w-20 h-20 md:w-24 md:h-24 bg-dark-bg rounded-2xl items-center justify-center text-dark-muted border border-dark-border flex-shrink-0">
                                <i class="fa-solid fa-bullhorn text-2xl md:text-3xl"></i>
                            </div>
                        </div>
                    ` : `
                        <div class="text-center text-dark-muted py-6">
                            <i class="fa-solid fa-newspaper text-4xl mb-4 opacity-50"></i>
                            <p>Keine aktuellen Ankündigungen.</p>
                        </div>
                    `}
                </div>

                <!-- 3. Navigation Grid (Modern Pills) -->
                <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 md:gap-4">
                    ${this.renderNavCard('calendar', 'Kalender', globalEvents.length + ' Termine', 'fa-calendar-days', 'purple')}
                    ${this.renderNavCard('groups', 'Gruppen', groupCount + ' Abteilungen', 'fa-layer-group', 'green')}
                    ${this.renderNavCard('documents', 'Dokumente', docCount + ' Dateien', 'fa-folder-open', 'orange')}
                    ${this.renderNavCard('members', 'Mitglieder', activeMembers + ' Aktiv', 'fa-users', 'indigo')}
                </div>

                <!-- 4. Next Up (Agenda Preview) -->
                <div class="bg-dark-card border border-dark-border rounded-3xl p-5 md:p-6 shadow-sm">
                    <div class="flex justify-between items-center mb-4 md:mb-6">
                        <h3 class="font-bold text-white text-base md:text-lg flex items-center gap-2">
                             <i class="fa-regular fa-clock text-brand-500"></i> Nächste Termine
                        </h3>
                        <button onclick="App.router('calendar')" class="text-xs text-dark-muted hover:text-white transition-colors bg-dark-bg px-3 py-1 rounded-full border border-dark-border hover:border-white/20">Alle ansehen</button>
                    </div>
                    
                    <div class="space-y-3">
                        ${globalEvents.length > 0 ? globalEvents.slice(0, 3).map(e => `
                            <div class="flex items-center gap-4 p-3 rounded-xl hover:bg-dark-bg/50 transition-colors border border-transparent hover:border-dark-border cursor-pointer group" onclick="App.router('calendar')">
                                <div class="w-12 h-12 md:w-14 md:h-14 rounded-xl bg-dark-bg border border-dark-border flex flex-col items-center justify-center flex-shrink-0 group-hover:border-brand-500/30 transition-colors">
                                    <span class="text-[9px] md:text-[10px] text-brand-500 font-bold uppercase">${new Date(e.date).toLocaleString('de-DE', {month: 'short'})}</span>
                                    <span class="text-lg md:text-xl font-bold text-white leading-none">${new Date(e.date).getDate()}</span>
                                </div>
                                <div class="flex-1 min-w-0">
                                    <h4 class="text-white font-bold text-sm md:text-base truncate group-hover:text-brand-400 transition-colors">${e.title}</h4>
                                    <div class="flex items-center gap-3 mt-1">
                                        <span class="text-xs text-dark-muted flex items-center"><i class="fa-regular fa-clock mr-1.5"></i> ${e.allDay ? 'Ganztägig' : e.time}</span>
                                        ${e.location ? `<span class="text-xs text-dark-muted flex items-center truncate"><i class="fa-solid fa-location-dot mr-1.5"></i> ${e.location}</span>` : ''}
                                    </div>
                                </div>
                                <i class="fa-solid fa-chevron-right text-dark-muted text-xs opacity-0 group-hover:opacity-100 transition-opacity"></i>
                            </div>
                        `).join('') : '<div class="p-6 text-center text-dark-muted text-sm italic bg-dark-bg/20 rounded-xl border border-dashed border-dark-border">Keine anstehenden Termine.</div>'}
                    </div>
                </div>

                <!-- 5. Work Hours Widget (Featured) -->
                <div onclick="App.router('workhours')" class="cursor-pointer bg-gradient-to-br from-brand-900/40 to-dark-card border border-brand-500/30 rounded-3xl p-6 relative overflow-hidden group hover:border-brand-500/60 transition-all shadow-lg">
                    <!-- Dekorative Elemente -->
                    <div class="absolute -right-6 -top-6 w-32 h-32 bg-brand-500/20 rounded-full blur-3xl group-hover:bg-brand-500/30 transition-all"></div>
                    
                    <div class="flex justify-between items-start mb-6">
                        <div>
                            <h3 class="text-lg font-bold text-white">Arbeitsstunden</h3>
                            <p class="text-xs text-brand-200/70">Saison 2024</p>
                        </div>
                        <div class="p-2 bg-brand-500/20 rounded-xl text-brand-400">
                            <i class="fa-solid fa-briefcase"></i>
                        </div>
                    </div>

                    <div class="flex items-end gap-2 mb-3">
                        <span class="text-4xl md:text-5xl font-bold text-white tracking-tighter">${myHours}</span>
                        <span class="text-lg text-dark-muted mb-1 md:mb-1.5">/ ${hoursTarget} h</span>
                    </div>

                    <div class="w-full bg-dark-bg/50 h-3 rounded-full overflow-hidden mb-2 border border-white/5">
                        <div class="h-full bg-brand-500 shadow-[0_0_10px_rgba(59,130,246,0.5)] transition-all duration-1000" style="width: ${percent}%"></div>
                    </div>
                    <p class="text-xs text-dark-muted text-right">${percent.toFixed(0)}% erledigt</p>
                </div>

            </div>
        `;
    },

    renderNavCard(route, title, subtitle, icon, color) {
        // Tailwind JIT erkennt dynamische Klassen nur, wenn sie komplett sind.
        // Daher nutzen wir hier generische Hover-Klassen und inline styles für spezielle Farben,
        // oder wir nutzen Standard-Farben für alle, wenn keine Farbe übergeben wird.
        
        const colors = {
            purple: 'text-purple-400 bg-purple-500/10 group-hover:text-purple-300',
            green: 'text-green-400 bg-green-500/10 group-hover:text-green-300',
            orange: 'text-orange-400 bg-orange-500/10 group-hover:text-orange-300',
            indigo: 'text-indigo-400 bg-indigo-500/10 group-hover:text-indigo-300'
        };

        const themeClass = colors[color] || 'text-brand-400 bg-brand-500/10 group-hover:text-brand-300';

        return `
            <div onclick="App.router('${route}')" class="bg-dark-card hover:bg-dark-hover border border-dark-border hover:border-white/10 p-4 rounded-2xl cursor-pointer transition-all group flex flex-col md:flex-row items-start md:items-center gap-3 md:gap-4 h-full shadow-sm">
                <div class="w-10 h-10 rounded-full ${themeClass} flex items-center justify-center text-lg group-hover:scale-110 transition-transform flex-shrink-0">
                    <i class="fa-solid ${icon}"></i>
                </div>
                <div class="min-w-0">
                    <h4 class="text-sm font-bold text-white truncate">${title}</h4>
                    <p class="text-[10px] text-dark-muted truncate transition-colors">${subtitle}</p>
                </div>
            </div>
        `;
    }
};

window.DashboardView = DashboardView;
