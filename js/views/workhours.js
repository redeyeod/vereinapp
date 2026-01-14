/**
 * =============================================================================
 * WORK HOURS VIEW (Clean & Mobile First)
 * Verwaltung der Arbeitsstunden (Eintragen, Genehmigen, Übersicht, Löschen)
 * =============================================================================
 */

const WorkHoursView = {
    // Standard-Zielvorgabe (Fallback)
    DEFAULT_TARGET: 6,

    /**
     * Haupt-Render Funktion
     */
    render(container) {
        const canManage = App.can('manage_workhours');
        
        container.innerHTML = `
            <div class="fade-in space-y-6 pb-20">
                <!-- Header -->
                <div class="flex justify-between items-end px-1">
                    <div>
                        <h2 class="text-2xl md:text-3xl font-bold text-white">Arbeitsstunden</h2>
                        <p class="text-dark-muted text-sm mt-1">Verwalte deine geleisteten Stunden.</p>
                    </div>
                    <button onclick="WorkHoursView.openAddModal()" class="pl-3 pr-4 py-2 bg-brand-600 hover:bg-brand-500 text-white rounded-xl text-sm font-bold shadow-lg shadow-brand-500/20 transition-all flex items-center gap-2">
                        <i class="fa-solid fa-clock-rotate-left"></i> <span class="hidden sm:inline">Stunden eintragen</span><span class="sm:hidden">Neu</span>
                    </button>
                </div>
                
                <!-- 1. Persönlicher Bereich (Für ALLE sichtbar) -->
                <section class="space-y-4">
                    <h3 class="text-xs font-bold text-dark-muted uppercase tracking-wider px-1">Mein Stundenkonto</h3>
                    ${this.renderMemberView()}
                </section>
                
                <!-- 2. Admin Bereich (Nur für Berechtigte) -->
                ${canManage ? `
                <section class="space-y-4 pt-6 border-t border-dark-border/50">
                    <h3 class="text-xs font-bold text-brand-400 uppercase tracking-wider px-1 flex items-center gap-2">
                        <i class="fa-solid fa-shield-halved"></i> Verwaltung
                    </h3>
                    ${this.renderAdminView()}
                </section>` : ''}
            </div>
        `;
    },

    // =========================================================================
    // MITGLIEDER ANSICHT (Persönlich)
    // =========================================================================
    renderMemberView() {
        const myId = App.state.currentUser ? App.state.currentUser.id : (localStorage.getItem('vm_current_user_id') || 0);
        const entries = Store.state.work_entries || [];
        const myEntries = entries.filter(e => e.memberId == myId);
        
        // Persönliches Ziel laden (oder Standard 6h)
        const me = Store.state.members ? Store.state.members.find(m => m.id == myId) : null;
        const PERSONAL_TARGET = (me && me.workTarget) ? parseInt(me.workTarget) : this.DEFAULT_TARGET;

        // Berechne genehmigte Stunden
        const approvedHours = myEntries
            .filter(e => e.status === 'approved')
            .reduce((sum, e) => sum + parseFloat(e.hours), 0);
            
        const pendingHours = myEntries
            .filter(e => e.status === 'pending')
            .reduce((sum, e) => sum + parseFloat(e.hours), 0);

        const progressPercent = Math.min(100, (approvedHours / PERSONAL_TARGET) * 100);
        const progressColor = approvedHours >= PERSONAL_TARGET ? 'bg-emerald-500' : 'bg-brand-500';

        return `
            <div class="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
                
                <!-- Status Karte -->
                <div class="lg:col-span-1">
                    <div class="bg-dark-card p-6 rounded-2xl border border-dark-border shadow-sm relative overflow-hidden group h-full">
                        <!-- Background Icon -->
                        <div class="absolute -right-6 -top-6 text-9xl text-brand-500/5 transform rotate-12 group-hover:scale-110 transition-transform duration-700 pointer-events-none">
                            <i class="fa-solid fa-briefcase"></i>
                        </div>
                        
                        <div class="relative z-10">
                            <h4 class="text-dark-muted text-[10px] font-bold uppercase tracking-wider mb-3">Jahresfortschritt</h4>
                            
                            <div class="flex items-baseline gap-2 mb-4">
                                <span class="text-5xl font-bold text-white tracking-tighter">${approvedHours}</span>
                                <span class="text-sm text-dark-muted font-medium">/ ${PERSONAL_TARGET} Std.</span>
                            </div>

                            <!-- Progress Bar -->
                            <div class="w-full bg-dark-bg h-3 rounded-full overflow-hidden mb-4 border border-dark-border/50">
                                <div class="h-full ${progressColor} transition-all duration-1000 shadow-[0_0_10px_rgba(59,130,246,0.4)]" style="width: ${progressPercent}%"></div>
                            </div>
                            
                            ${approvedHours >= PERSONAL_TARGET 
                                ? '<p class="text-emerald-400 text-xs font-bold flex items-center gap-1.5"><i class="fa-solid fa-circle-check"></i> Soll erfüllt!</p>'
                                : `<p class="text-amber-400 text-xs font-bold flex items-center gap-1.5"><i class="fa-solid fa-circle-info"></i> Noch ${(PERSONAL_TARGET - approvedHours).toFixed(1)} Std. offen</p>`
                            }
                            
                            ${pendingHours > 0 ? `<div class="mt-4 pt-3 border-t border-dark-border/50 text-xs text-dark-muted flex items-center gap-1.5"><i class="fa-regular fa-clock text-brand-400"></i> + ${pendingHours} Std. in Prüfung</div>` : ''}
                        </div>
                    </div>
                </div>

                <!-- Historie Liste -->
                <div class="lg:col-span-2">
                    <div class="bg-dark-card rounded-2xl border border-dark-border overflow-hidden shadow-sm h-full flex flex-col">
                        <div class="p-4 border-b border-dark-border bg-dark-bg/30 flex justify-between items-center">
                            <h4 class="font-bold text-white text-sm">Verlauf</h4>
                            <span class="text-[10px] uppercase font-bold text-dark-muted bg-dark-bg px-2 py-1 rounded border border-dark-border">${myEntries.length} Einträge</span>
                        </div>
                        
                        <div class="flex-1 overflow-y-auto max-h-[300px] custom-scrollbar">
                            ${myEntries.length === 0 
                                ? `<div class="p-12 text-center text-dark-muted flex flex-col items-center justify-center h-full opacity-60">
                                     <i class="fa-regular fa-calendar-xmark text-3xl mb-2"></i>
                                     <span class="text-sm">Noch keine Arbeitsstunden eingetragen.</span>
                                   </div>`
                                : `<div class="divide-y divide-dark-border">
                                    ${myEntries.sort((a,b) => new Date(b.date) - new Date(a.date)).map(e => this.renderEntryRow(e, true)).join('')}
                                   </div>`
                            }
                        </div>
                    </div>
                </div>
            </div>
        `;
    },

    renderEntryRow(entry, allowDelete) {
        let statusBadge = '';
        if(entry.status === 'approved') statusBadge = '<span class="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 text-[10px] font-bold rounded border border-emerald-500/20">Genehmigt</span>';
        else if(entry.status === 'rejected') statusBadge = '<span class="px-2 py-0.5 bg-red-500/10 text-red-400 text-[10px] font-bold rounded border border-red-500/20">Abgelehnt</span>';
        else statusBadge = '<span class="px-2 py-0.5 bg-amber-500/10 text-amber-400 text-[10px] font-bold rounded border border-amber-500/20">Prüfung</span>';

        return `
            <div class="p-4 flex items-center justify-between hover:bg-dark-hover/30 transition-colors group">
                <div class="min-w-0 pr-4 flex-1">
                    <p class="text-white font-bold text-sm truncate">${entry.activity}</p>
                    <div class="flex items-center gap-3 mt-1 text-xs text-dark-muted">
                        <span class="flex items-center gap-1.5"><i class="fa-regular fa-calendar"></i> ${new Date(entry.date).toLocaleDateString()}</span>
                        <span class="text-white font-mono font-medium bg-dark-bg/50 px-1.5 rounded text-[10px] border border-dark-border/50">${entry.hours}h</span>
                    </div>
                    ${entry.comment ? `<p class="text-[10px] text-dark-muted/70 mt-1 italic truncate max-w-xs">"${entry.comment}"</p>` : ''}
                </div>
                <div class="flex items-center gap-3">
                    ${statusBadge}
                    ${allowDelete ? `
                    <button onclick="WorkHoursView.deleteEntry('${entry.id}')" class="text-dark-muted hover:text-red-400 p-1.5 rounded-lg hover:bg-red-500/10 transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100" title="Eintrag löschen">
                        <i class="fa-regular fa-trash-can text-xs"></i>
                    </button>` : ''}
                </div>
            </div>
        `;
    },

    // =========================================================================
    // ADMIN ANSICHT
    // =========================================================================
    
    renderAdminView() {
        const entries = Store.state.work_entries || [];
        const members = Store.state.members || [];
        
        // Offene Anträge sammeln
        const pendingEntries = entries.filter(e => e.status === 'pending');
        
        // Gesamtstatistik berechnen
        const memberStats = members.map(m => {
            const hours = entries
                .filter(e => e.memberId == m.id && e.status === 'approved')
                .reduce((sum, e) => sum + parseFloat(e.hours), 0);
            
            // ROLES FIX: Korrekte Rolle ermitteln
            let roleDisplay = 'Mitglied';
            if (Array.isArray(m.roles) && m.roles.length > 0) roleDisplay = m.roles.join(', ');
            else if (m.role) roleDisplay = m.role;

            // Individuelles Ziel oder Standard (6h)
            const target = (m.workTarget) ? parseInt(m.workTarget) : 6;

            return { ...m, hours, roleDisplay, target };
        }).sort((a, b) => {
            // Sortiere alphabetisch nach Vorname + Nachname
            const nameA = ((a.firstName || '') + ' ' + (a.lastName || '')).toLowerCase();
            const nameB = ((b.firstName || '') + ' ' + (b.lastName || '')).toLowerCase();
            return nameA.localeCompare(nameB);
        });

        return `
            <div class="space-y-8 pb-4">
                <!-- 1. Offene Anträge -->
                ${pendingEntries.length > 0 ? `
                <div>
                    <h4 class="text-xs font-bold text-amber-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                        <span class="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
                        Offene Anträge (${pendingEntries.length})
                    </h4>
                    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        ${pendingEntries.map(e => this.renderApprovalCard(e)).join('')}
                    </div>
                </div>` : 
                `<div class="p-6 bg-emerald-500/5 border border-emerald-500/10 rounded-2xl text-emerald-400 text-sm flex flex-col md:flex-row items-center justify-center gap-3 text-center md:text-left">
                    <div class="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center text-xl"><i class="fa-solid fa-check"></i></div>
                    <span>Alles erledigt! Keine offenen Anträge zur Prüfung.</span>
                 </div>`
                }

                <!-- 2. Gesamtübersicht Liste -->
                <div>
                    <div class="flex flex-col sm:flex-row justify-between items-end sm:items-center mb-4 gap-4">
                        <h4 class="text-xs font-bold text-dark-muted uppercase tracking-wider">Mitglieder Übersicht</h4>
                        
                        <!-- Actions -->
                        <div class="flex gap-2">
                            <!-- Excel Export Button -->
                            <button onclick="WorkHoursView.downloadExcel()" class="px-3 py-1.5 rounded-lg text-[10px] font-bold bg-dark-card border border-dark-border text-dark-muted hover:text-white hover:border-brand-500/50 transition-colors flex items-center gap-2 shadow-sm">
                                <i class="fa-solid fa-file-csv text-brand-500"></i> Export
                            </button>
                        </div>
                    </div>
                    
                    <div class="bg-dark-card rounded-2xl border border-dark-border overflow-hidden shadow-sm">
                        <div class="overflow-x-auto">
                            <table class="w-full text-left text-sm whitespace-nowrap">
                                <thead class="bg-dark-bg/50 text-dark-muted text-[10px] uppercase font-bold border-b border-dark-border tracking-wider">
                                    <tr>
                                        <th class="p-4">Name</th>
                                        <th class="p-4 hidden sm:table-cell">Rolle</th>
                                        <th class="p-4 text-right">Stunden</th>
                                        <th class="p-4 text-center w-32">Zielvorgabe</th>
                                        <th class="p-4 text-right w-10"></th>
                                    </tr>
                                </thead>
                                <tbody class="divide-y divide-dark-border text-white text-xs md:text-sm">
                                    ${memberStats.map(m => {
                                        const target = m.target;
                                        const isDone = m.hours >= target;
                                        const percent = Math.min(100, (m.hours / target) * 100);
                                        const isActiveTarget = target === 6;
                                        
                                        return `
                                        <tr class="hover:bg-dark-hover/30 transition-colors group">
                                            <td class="p-4">
                                                <div class="flex items-center gap-3">
                                                    <div class="w-8 h-8 rounded-lg bg-slate-700 text-slate-300 flex items-center justify-center text-xs font-bold border border-white/5">
                                                        ${(m.firstName || '?').charAt(0)}${(m.lastName || '?').charAt(0)}
                                                    </div>
                                                    <span class="font-bold">${m.firstName} ${m.lastName}</span>
                                                </div>
                                            </td>
                                            <td class="p-4 text-dark-muted text-xs hidden sm:table-cell truncate max-w-[150px]">${m.roleDisplay}</td>
                                            <td class="p-4 text-right font-mono">
                                                <span class="${isDone ? 'text-emerald-400' : 'text-white'} font-bold">${m.hours.toFixed(1)}</span>
                                                <span class="text-dark-muted text-[10px]">/${target}</span>
                                                <div class="w-16 h-1 bg-dark-bg rounded-full ml-auto mt-1 overflow-hidden border border-dark-border/50">
                                                    <div class="h-full ${isDone ? 'bg-emerald-500' : 'bg-brand-500'} rounded-full" style="width: ${percent}%"></div>
                                                </div>
                                            </td>
                                            <td class="p-4 text-center">
                                                <!-- Switch Button -->
                                                <div onclick="WorkHoursView.toggleMemberTarget('${m.id}', ${target})" 
                                                     class="flex items-center justify-center gap-2 cursor-pointer group select-none">
                                                    
                                                    <div class="w-9 h-5 rounded-full relative transition-colors duration-300 ${isActiveTarget ? 'bg-brand-500 shadow-[0_0_10px_rgba(59,130,246,0.4)]' : 'bg-slate-700 shadow-inner'}">
                                                        <div class="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-transform duration-300 ${isActiveTarget ? 'translate-x-4' : 'translate-x-0'}"></div>
                                                    </div>
                                                    
                                                    <div class="flex flex-col items-start leading-none">
                                                        <span class="text-[10px] font-bold uppercase ${isActiveTarget ? 'text-brand-400' : 'text-slate-400'} transition-colors">
                                                            ${isActiveTarget ? 'Aktiv' : 'Passiv'}
                                                        </span>
                                                        <span class="text-[9px] text-dark-muted font-mono">
                                                            ${isActiveTarget ? '6h' : '22h'}
                                                        </span>
                                                    </div>
                                                </div>
                                            </td>
                                            <td class="p-4 text-right">
                                                <button onclick="WorkHoursView.openMemberDetails('${m.id}')" class="text-dark-muted hover:text-brand-400 p-2 rounded-lg hover:bg-dark-bg transition-colors" title="Details">
                                                    <i class="fa-solid fa-ellipsis"></i>
                                                </button>
                                            </td>
                                        </tr>`;
                                    }).join('')}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        `;
    },

    renderApprovalCard(entry) {
        const member = Store.state.members.find(m => m.id == entry.memberId);
        const name = member ? `${member.firstName} ${member.lastName}` : 'Unbekannt';

        return `
            <div class="bg-dark-card p-5 rounded-2xl border border-dark-border shadow-sm flex flex-col hover:border-amber-500/30 transition-all text-start group">
                <div class="flex justify-between items-start mb-3">
                    <div class="flex items-center gap-3">
                        <div class="w-9 h-9 rounded-lg bg-slate-700 text-slate-300 flex items-center justify-center text-xs font-bold border border-white/5 shadow-inner">
                            ${name.charAt(0)}
                        </div>
                        <div>
                            <h5 class="font-bold text-white text-sm leading-tight">${name}</h5>
                            <span class="text-[10px] text-dark-muted">Antragsteller</span>
                        </div>
                    </div>
                    <span class="bg-brand-500/10 text-brand-400 text-xs px-2 py-1 rounded-md font-mono font-bold border border-brand-500/20">
                        ${entry.hours}h
                    </span>
                </div>
                
                <div class="bg-dark-bg/50 p-3 rounded-xl border border-dark-border/50 mb-4 flex-1">
                    <p class="text-sm text-white font-medium mb-1 line-clamp-2">${entry.activity}</p>
                    <div class="flex items-center gap-2 text-[10px] text-dark-muted uppercase font-bold tracking-wider">
                        <i class="fa-regular fa-calendar text-brand-500"></i> ${new Date(entry.date).toLocaleDateString()}
                    </div>
                    ${entry.comment ? `<p class="text-xs text-dark-muted mt-2 pt-2 border-t border-dark-border/30 italic">"${entry.comment}"</p>` : ''}
                </div>
                
                <div class="mt-auto flex gap-2">
                    <button onclick="WorkHoursView.decide('${entry.id}', 'approved')" class="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white py-2 rounded-xl text-xs font-bold transition-all shadow-lg shadow-emerald-900/20 flex items-center justify-center gap-1.5 hover:-translate-y-0.5">
                        <i class="fa-solid fa-check"></i> Ja
                    </button>
                    <button onclick="WorkHoursView.decide('${entry.id}', 'rejected')" class="flex-1 bg-dark-bg hover:bg-red-500/10 text-red-400 border border-dark-border hover:border-red-500/30 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5">
                        <i class="fa-solid fa-xmark"></i> Nein
                    </button>
                </div>
            </div>
        `;
    },

    // =========================================================================
    // EXPORT FUNCTION (CSV)
    // =========================================================================
    downloadExcel() {
        const entries = Store.state.work_entries || [];
        const members = Store.state.members || [];
        
        // Daten für Export vorbereiten
        const data = members.map(m => {
            const hours = entries
                .filter(e => e.memberId == m.id && e.status === 'approved')
                .reduce((sum, e) => sum + parseFloat(e.hours), 0);
            
            let roleDisplay = 'Mitglied';
            if (Array.isArray(m.roles) && m.roles.length > 0) roleDisplay = m.roles.join(', ');
            else if (m.role) roleDisplay = m.role;

            const target = (m.workTarget) ? parseInt(m.workTarget) : 6;
            const status = hours >= target ? 'Erfüllt' : 'Offen';

            // CSV kompatibel formatieren (Semikolon für Excel, Komma ersetzen)
            return {
                firstName: m.firstName || '',
                lastName: m.lastName || '',
                role: roleDisplay,
                hours: hours.toFixed(1).replace('.', ','), 
                target: target,
                status: status
            };
        });

        // CSV Header
        let csvContent = "Vorname;Nachname;Rolle;Genehmigte Stunden;Zielvorgabe;Status\n";

        // CSV Rows
        data.forEach(row => {
            csvContent += `${row.firstName};${row.lastName};${row.role};${row.hours};${row.target};${row.status}\n`;
        });

        // UTF-8 BOM für Excel hinzufügen (\uFEFF)
        const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        
        link.setAttribute("href", url);
        link.setAttribute("download", `arbeitsstunden_export_${new Date().getFullYear()}.csv`);
        link.style.visibility = 'hidden';
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    },

    // =========================================================================
    // ADMIN ACTIONS (MODAL & LOGIC)
    // =========================================================================
    
    // Toggle Member Target Logic (6h <-> 22h)
    async toggleMemberTarget(memberId, currentTarget) {
        const newTarget = (currentTarget === 6) ? 22 : 6;
        
        // UI Optimistic Update (für schnelles Feedback)
        const memberIdx = Store.state.members.findIndex(m => m.id == memberId);
        if(memberIdx !== -1) {
            Store.state.members[memberIdx].workTarget = newTarget;
            this.render(document.getElementById('content')); // Re-render table
        }

        // DB Update (mit Fallback)
        const updates = { workTarget: newTarget };
        const error = await this.safeMemberUpdate(memberId, updates);
        
        if (error) {
            console.error("Fehler beim Speichern des Ziels:", error);
            // Revert on error
            if(memberIdx !== -1) {
                Store.state.members[memberIdx].workTarget = currentTarget;
                this.render(document.getElementById('content'));
            }
        }
    },

    openMemberDetails(memberId) {
        const member = Store.state.members.find(m => m.id == memberId);
        if(!member) return;

        const target = member.workTarget ? parseInt(member.workTarget) : 6;
        const entries = (Store.state.work_entries || []).filter(e => e.memberId == memberId).sort((a,b) => new Date(b.date) - new Date(a.date));
        const total = entries.filter(e => e.status === 'approved').reduce((sum, e) => sum + parseFloat(e.hours), 0);

        const html = `
            <div class="p-6 md:p-8 h-full flex flex-col">
                <div class="flex justify-between items-center mb-6 border-b border-dark-border pb-4 text-start">
                    <div>
                        <h3 class="text-xl font-bold text-white">${member.firstName} ${member.lastName}</h3>
                        <p class="text-sm text-brand-400 font-mono font-bold mt-1">${total} / ${target} Std. genehmigt</p>
                    </div>
                    <button onclick="App.closeModal()" class="text-dark-muted hover:text-white p-2 transition-colors"><i class="fa-solid fa-times text-xl"></i></button>
                </div>
                
                <div class="flex-1 overflow-y-auto custom-scrollbar bg-dark-bg/30 rounded-2xl border border-dark-border text-start">
                    ${entries.length === 0 
                        ? `<div class="p-12 text-center text-dark-muted text-sm flex flex-col items-center gap-2"><i class="fa-regular fa-folder-open text-2xl opacity-50"></i> Keine Einträge vorhanden.</div>`
                        : `<div class="divide-y divide-dark-border">
                            ${entries.map(e => this.renderEntryRow(e, true)).join('')}
                           </div>`
                    }
                </div>
            </div>
        `;
        App.openModal(html);
        
        const modalContainer = document.getElementById('modal-content');
        if(modalContainer) {
            modalContainer.classList.remove('max-w-md');
            modalContainer.classList.add('max-w-2xl', 'w-full', 'max-h-[85vh]');
        }
    },

    // =========================================================================
    // GENERAL ACTIONS
    // =========================================================================

    // Update für Work Entries
    async safeUpdate(id, updates) {
        if(typeof supabase === 'undefined') { if(window.Store) Store.update('work_entries', { id, ...updates }); return null; }
        const sessionStr = localStorage.getItem('vm_supabase_session');
        if (!sessionStr) { if(window.Store) Store.update('work_entries', { id, ...updates }); return null; }
        
        try {
            const token = JSON.parse(sessionStr).access_token;
            const client = supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY, {
                global: { headers: { Authorization: `Bearer ${token}` } }
            });
            
            const cleanUpdates = { ...updates };
            if ('id' in cleanUpdates) delete cleanUpdates.id;

            const { data, error } = await client.from('work_entries').update(cleanUpdates).eq('id', id).select();
            if (error) throw error;
            return null;
        } catch(e) { 
            console.warn("DB Update failed, fallback to local:", e);
            if(window.Store) Store.update('work_entries', { id, ...updates });
            return null; // Kein Fehler für UI
        }
    },

    // NEU: Update für Member Data (z.B. Ziel-Stunden) MIT FALLBACK
    async safeMemberUpdate(id, updates) {
        // Fallback sofort wenn kein Supabase
        if(typeof supabase === 'undefined') { 
            if(window.Store) {
                const m = Store.state.members.find(x => x.id == id);
                if(m) Store.update('members', { ...m, ...updates });
            }
            return null; 
        }

        const sessionStr = localStorage.getItem('vm_supabase_session');
        // Wenn nicht eingeloggt, lokal speichern
        if (!sessionStr) {
             if(window.Store) {
                const m = Store.state.members.find(x => x.id == id);
                if(m) Store.update('members', { ...m, ...updates });
            }
            return null;
        }
        
        try {
            const token = JSON.parse(sessionStr).access_token;
            const client = supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY, {
                global: { headers: { Authorization: `Bearer ${token}` } }
            });
            
            const cleanUpdates = { ...updates };
            if ('id' in cleanUpdates) delete cleanUpdates.id;

            const { error } = await client.from('members').update(cleanUpdates).eq('id', id);
            if (error) throw error;
            return null;
        } catch(e) { 
            console.warn("DB Member Update failed, using local store:", e);
            // Fallback auf Local Store, damit es in der UI bleibt
            if(window.Store) {
                const m = Store.state.members.find(x => x.id == id);
                if(m) await Store.update('members', { ...m, ...updates });
            }
            return null; // Kein Fehler für UI
        }
    },

    deleteEntry(id) {
        if(confirm("Diesen Eintrag wirklich unwiderruflich löschen?")) {
            Store.remove('work_entries', id);
            
            // Views aktualisieren
            setTimeout(() => this.render(document.getElementById('content')), 100);
            
            const modal = document.getElementById('modal-content');
            if(modal && modal.innerHTML.includes('genehmigt')) {
                App.closeModal(); 
            }
            App.showToast("Eintrag gelöscht");
        }
    },

    async decide(id, status) {
        const entry = Store.state.work_entries.find(e => e.id == id);
        if(entry) {
            const updates = { status: status };
            const error = await this.safeUpdate(id, updates);
            
            if (error) {
                // Sollte dank safeUpdate nicht mehr passieren
                console.error("Genehmigung gescheitert:", error);
                App.showToast("Fehler beim Speichern", "error");
                return;
            }
            
            const idx = Store.state.work_entries.indexOf(entry);
            if(idx !== -1) Store.state.work_entries[idx] = { ...entry, status };

            App.showToast(status === 'approved' ? 'Stunden genehmigt' : 'Antrag abgelehnt');
            this.render(document.getElementById('content'));
            
            if(Store.fetchTable) Store.fetchTable('work_entries');
        }
    },

    openAddModal() {
        const html = `
            <div class="p-6 md:p-8">
                <div class="flex justify-between items-center mb-6 border-b border-dark-border pb-4 text-start sticky top-0 bg-dark-card z-10">
                    <h3 class="text-xl font-bold text-white">Stunden erfassen</h3>
                    <button onclick="App.closeModal()" class="text-dark-muted hover:text-white p-2 transition-colors"><i class="fa-solid fa-times text-xl"></i></button>
                </div>
                
                <form onsubmit="WorkHoursView.handleSubmit(event)" class="space-y-6 text-start">
                    <div>
                        <label class="text-xs font-bold text-dark-muted uppercase mb-2 block">Tätigkeit / Veranstaltung</label>
                        <input type="text" name="activity" required class="form-input" placeholder="z.B. Thekendienst Prunksitzung">
                    </div>

                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <label class="text-xs font-bold text-dark-muted uppercase mb-2 block">Datum</label>
                            <input type="date" name="date" required class="form-input dark-date">
                        </div>
                        <div>
                            <label class="text-xs font-bold text-dark-muted uppercase mb-2 block">Stunden</label>
                            <div class="relative">
                                <input type="number" name="hours" step="0.5" min="0.5" required class="form-input pl-4 pr-10" placeholder="0.0">
                                <span class="absolute right-4 top-1/2 -translate-y-1/2 text-dark-muted text-xs font-bold">Std.</span>
                            </div>
                        </div>
                    </div>

                    <div>
                        <label class="text-xs font-bold text-dark-muted uppercase mb-2 block">Bemerkung (Optional)</label>
                        <textarea name="comment" class="form-input" rows="3" placeholder="Details zur Aufgabe..."></textarea>
                    </div>
                    
                    <div class="p-4 bg-brand-500/10 border border-brand-500/20 rounded-xl text-xs text-brand-400 flex gap-3 leading-relaxed">
                        <i class="fa-solid fa-circle-info mt-0.5 text-lg flex-shrink-0"></i>
                        <p>Der Eintrag wird an den Vorstand zur Prüfung gesendet. Nach Genehmigung werden die Stunden deinem Konto gutgeschrieben.</p>
                    </div>

                    <button type="submit" class="btn-primary w-full shadow-lg shadow-brand-500/20">Einreichen</button>
                </form>
            </div>
        `;
        App.openModal(html);
        const modalContainer = document.getElementById('modal-content');
        if(modalContainer) modalContainer.classList.add('max-h-[85vh]', 'overflow-y-auto', 'custom-scrollbar');
    },

    async handleSubmit(e) {
        e.preventDefault();
        const fd = new FormData(e.target);
        const myId = App.state.currentUser ? App.state.currentUser.id : (localStorage.getItem('vm_current_user_id') || 0);
        
        const newEntry = {
            memberId: myId,
            activity: fd.get('activity'),
            date: fd.get('date'),
            hours: parseFloat(fd.get('hours')),
            comment: fd.get('comment'),
            status: 'pending' // Muss erst genehmigt werden
        };

        await Store.add('work_entries', newEntry);
        App.closeModal();
        App.showToast('Antrag erfolgreich eingereicht');
        this.render(document.getElementById('content'));
    }
};

// WICHTIG: Global verfügbar machen für die neue App.js
window.WorkHoursView = WorkHoursView;
