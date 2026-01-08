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
        const s = Store.state;
        const myId = App.state.currentUser ? App.state.currentUser.id : (localStorage.getItem('vm_current_user_id') || 1);
        const userObj = s.members.find(m => m.id == myId) || { firstName: 'Nutzer' };

        // Daten aggregieren
        const activeMembers = s.members.filter(m => m.status === 'active').length;
        // Nur globale Events für die Vorschau
        const globalEvents = s.events.filter(e => !e.group).sort((a,b) => new Date(a.date) - new Date(b.date));
        
        const newsCount = s.news.length;
        const latestNews = s.news.length > 0 ? s.news[0] : null;
        
        const docCount = s.docs.length;
        const groupCount = s.groups.length;
        
        // Arbeitsstunden berechnen
        const myWorkEntries = s.work_entries ? s.work_entries.filter(e => e.memberId == myId && e.status === 'approved') : [];
        const myHours = myWorkEntries.reduce((sum, e) => sum + parseFloat(e.hours), 0);
        const hoursTarget = 6;
        const percent = Math.min(100, (myHours / hoursTarget) * 100);

        // Begrüßung nach Tageszeit
        const hour = new Date().getHours();
        const greeting = hour < 12 ? 'Guten Morgen' : hour < 18 ? 'Guten Tag' : 'Guten Abend';

        container.innerHTML = `
            <div class="fade-in space-y-6 md:space-y-8 pb-10">
                
                <!-- 1. Header Section -->
                <div class="flex flex-col md:flex-row justify-between items-start md:items-end gap-2">
                    <div>
                        <h1 class="text-2xl md:text-4xl font-bold text-white mb-1">
                            ${greeting}, <span class="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-500">${userObj.firstName}</span>!
                        </h1>
                        <p class="text-sm md:text-base text-dark-muted">Hier ist dein aktueller Vereins-Überblick.</p>
                    </div>
                    <div class="text-right hidden md:block">
                        <p class="text-xl font-bold text-white">${new Date().toLocaleDateString('de-DE', { weekday: 'long' })}</p>
                        <p class="text-sm text-blue-400">${new Date().toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                    </div>
                </div>

                <!-- 2. Hero Section (News) -->
                <div onclick="App.router('news')" class="bg-dark-card border border-dark-border rounded-3xl p-6 md:p-8 relative overflow-hidden group hover:border-dark-muted/50 transition-all cursor-pointer flex flex-col justify-center min-h-[220px]">
                    <div class="absolute inset-0 bg-gradient-to-r from-transparent via-transparent to-red-900/5 pointer-events-none"></div>
                    
                    ${latestNews ? `
                        <div class="flex items-start justify-between gap-4">
                            <div class="flex-1 z-10">
                                <div class="flex items-center gap-3 mb-3">
                                    <span class="bg-red-500/10 text-red-400 text-[10px] md:text-xs font-bold px-2 py-1 rounded-md border border-red-500/20 animate-pulse">NEU</span>
                                    <span class="text-xs text-dark-muted"><i class="fa-regular fa-clock mr-1"></i> ${new Date(latestNews.date).toLocaleDateString()}</span>
                                </div>
                                <h3 class="text-xl md:text-3xl font-bold text-white mb-2 md:mb-3 line-clamp-2 leading-tight group-hover:text-blue-400 transition-colors">
                                    ${latestNews.title}
                                </h3>
                                <p class="text-dark-muted line-clamp-2 md:line-clamp-2 text-sm md:text-base mb-4">
                                    ${latestNews.content}
                                </p>
                                <span class="text-blue-400 text-xs md:text-sm font-bold flex items-center group-hover:underline">
                                    Ganzen Beitrag lesen <i class="fa-solid fa-arrow-right ml-2 transition-transform group-hover:translate-x-1"></i>
                                </span>
                            </div>
                            <div class="hidden sm:flex w-20 h-20 md:w-24 md:h-24 bg-dark-bg rounded-2xl items-center justify-center text-dark-muted border border-dark-border flex-shrink-0">
                                <i class="fa-solid fa-bullhorn text-2xl md:text-3xl"></i>
                            </div>
                        </div>
                    ` : `
                        <div class="text-center text-dark-muted">
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
                <div class="bg-dark-card border border-dark-border rounded-3xl p-5 md:p-6">
                    <div class="flex justify-between items-center mb-4 md:mb-6">
                        <h3 class="font-bold text-white text-base md:text-lg">Nächste Termine</h3>
                        <button onclick="App.router('calendar')" class="text-xs text-dark-muted hover:text-white transition-colors bg-dark-bg px-3 py-1 rounded-full border border-dark-border">Alle ansehen</button>
                    </div>
                    
                    <div class="space-y-3">
                        ${globalEvents.slice(0, 3).map(e => `
                            <div class="flex items-center gap-4 p-3 rounded-xl hover:bg-dark-bg/50 transition-colors border border-transparent hover:border-dark-border cursor-pointer group" onclick="App.router('calendar')">
                                <div class="w-12 h-12 md:w-14 md:h-14 rounded-xl bg-dark-bg border border-dark-border flex flex-col items-center justify-center flex-shrink-0 group-hover:border-blue-500/30 transition-colors">
                                    <span class="text-[9px] md:text-[10px] text-blue-400 font-bold uppercase">${new Date(e.date).toLocaleString('de-DE', {month: 'short'})}</span>
                                    <span class="text-lg md:text-xl font-bold text-white leading-none">${new Date(e.date).getDate()}</span>
                                </div>
                                <div class="flex-1 min-w-0">
                                    <h4 class="text-white font-bold text-sm md:text-base truncate group-hover:text-blue-400 transition-colors">${e.title}</h4>
                                    <div class="flex items-center gap-3 mt-1">
                                        <span class="text-xs text-dark-muted flex items-center"><i class="fa-regular fa-clock mr-1.5"></i> ${e.allDay ? 'Ganztägig' : e.time}</span>
                                        ${e.location ? `<span class="text-xs text-dark-muted flex items-center truncate"><i class="fa-solid fa-location-dot mr-1.5"></i> ${e.location}</span>` : ''}
                                    </div>
                                </div>
                                <i class="fa-solid fa-chevron-right text-dark-muted text-xs opacity-0 group-hover:opacity-100 transition-opacity"></i>
                            </div>
                        `).join('') || '<div class="p-6 text-center text-dark-muted text-sm italic bg-dark-bg/20 rounded-xl border border-dashed border-dark-border">Keine anstehenden Termine.</div>'}
                    </div>
                </div>

                <!-- 5. Work Hours Widget (Featured) - JETZT ALS LETZTES -->
                <div onclick="App.router('workhours')" class="cursor-pointer bg-gradient-to-br from-blue-900/40 to-dark-card border border-blue-500/30 rounded-3xl p-6 relative overflow-hidden group hover:border-blue-500/60 transition-all shadow-lg">
                    <!-- Dekorative Elemente -->
                    <div class="absolute -right-6 -top-6 w-32 h-32 bg-blue-500/20 rounded-full blur-3xl group-hover:bg-blue-500/30 transition-all"></div>
                    
                    <div class="flex justify-between items-start mb-6">
                        <div>
                            <h3 class="text-lg font-bold text-white">Arbeitsstunden</h3>
                            <p class="text-xs text-blue-200/70">Saison 2024</p>
                        </div>
                        <div class="p-2 bg-blue-500/20 rounded-xl text-blue-400">
                            <i class="fa-solid fa-briefcase"></i>
                        </div>
                    </div>

                    <div class="flex items-end gap-2 mb-3">
                        <span class="text-5xl font-bold text-white tracking-tighter">${myHours}</span>
                        <span class="text-lg text-dark-muted mb-1.5">/ ${hoursTarget} h</span>
                    </div>

                    <div class="w-full bg-dark-bg/50 h-3 rounded-full overflow-hidden mb-2">
                        <div class="h-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)] transition-all duration-1000" style="width: ${percent}%"></div>
                    </div>
                    <p class="text-xs text-dark-muted text-right">${percent.toFixed(0)}% erledigt</p>
                </div>

            </div>
        `;
    },

    renderNavCard(route, title, subtitle, icon, color) {
        return `
            <div onclick="App.router('${route}')" class="bg-dark-card hover:bg-dark-hover border border-dark-border hover:border-${color}-500/30 p-4 rounded-2xl cursor-pointer transition-all group flex flex-col md:flex-row items-start md:items-center gap-3 md:gap-4 h-full">
                <div class="w-10 h-10 rounded-full bg-${color}-500/10 text-${color}-400 flex items-center justify-center text-lg group-hover:scale-110 transition-transform">
                    <i class="fa-solid ${icon}"></i>
                </div>
                <div class="min-w-0">
                    <h4 class="text-sm font-bold text-white truncate">${title}</h4>
                    <p class="text-[10px] text-dark-muted truncate group-hover:text-${color}-300/80 transition-colors">${subtitle}</p>
                </div>
            </div>
        `;
    }
};