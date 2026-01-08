/**
 * =============================================================================
 * WORK HOURS VIEW
 * Verwaltung der Arbeitsstunden (Eintragen, Genehmigen, Übersicht, Löschen)
 * =============================================================================
 */

const WorkHoursView = {
    // Zielvorgabe pro Jahr
    TARGET_HOURS: 6,

    /**
     * Haupt-Render Funktion
     */
    render(container) {
        const canManage = App.can('manage_workhours');
        
        container.innerHTML = `
            <div class="flex justify-between items-center mb-6 fade-in">
                <h3 class="text-lg md:text-xl font-bold text-white">Arbeitsstunden</h3>
                <button onclick="WorkHoursView.openAddModal()" class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-bold transition-colors shadow-lg shadow-blue-900/30 flex items-center">
                    <i class="fa-solid fa-clock-rotate-left mr-2"></i> <span class="hidden md:inline">Stunden eintragen</span><span class="md:hidden">Neu</span>
                </button>
            </div>
            
            <div class="space-y-10 fade-in">
                <!-- 1. Persönlicher Bereich (Für ALLE sichtbar) -->
                <section>
                    <h4 class="text-sm font-bold text-dark-muted uppercase tracking-wider mb-4 border-b border-dark-border pb-2">Mein Stundenkonto</h4>
                    ${this.renderMemberView()}
                </section>
                
                <!-- 2. Admin Bereich (Nur für Berechtigte) -->
                ${canManage ? `
                <section>
                    <h4 class="text-sm font-bold text-blue-400 uppercase tracking-wider mb-4 border-b border-blue-500/20 pb-2 mt-8">Verwaltung</h4>
                    ${this.renderAdminView()}
                </section>` : ''}
            </div>
        `;
    },

    // =========================================================================
    // MITGLIEDER ANSICHT (Persönlich)
    // =========================================================================
    renderMemberView() {
        const myId = App.state.currentUser ? App.state.currentUser.id : 0;
        const myEntries = Store.state.work_entries.filter(e => e.memberId === myId);
        
        // Berechne genehmigte Stunden
        const approvedHours = myEntries
            .filter(e => e.status === 'approved')
            .reduce((sum, e) => sum + parseFloat(e.hours), 0);
            
        const pendingHours = myEntries
            .filter(e => e.status === 'pending')
            .reduce((sum, e) => sum + parseFloat(e.hours), 0);

        const progressPercent = Math.min(100, (approvedHours / this.TARGET_HOURS) * 100);
        const progressColor = approvedHours >= this.TARGET_HOURS ? 'bg-green-500' : 'bg-blue-600';

        return `
            <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                <!-- Status Karte -->
                <div class="lg:col-span-1">
                    <div class="bg-dark-card p-6 rounded-2xl border border-dark-border shadow-lg relative overflow-hidden group h-full">
                        <div class="absolute top-0 right-0 p-4 opacity-5 text-9xl text-white transform translate-x-4 -translate-y-4 group-hover:scale-105 transition-transform duration-500">
                            <i class="fa-solid fa-briefcase"></i>
                        </div>
                        
                        <div class="relative z-10">
                            <h4 class="text-dark-muted text-xs font-bold uppercase tracking-wider mb-2">Fortschritt</h4>
                            <div class="flex items-end gap-2 mb-4">
                                <span class="text-4xl md:text-5xl font-bold text-white">${approvedHours}</span>
                                <span class="text-lg text-dark-muted mb-1">/ ${this.TARGET_HOURS} Std.</span>
                            </div>

                            <!-- Progress Bar -->
                            <div class="w-full bg-dark-bg h-3 rounded-full overflow-hidden mb-4 border border-dark-border">
                                <div class="h-full ${progressColor} transition-all duration-1000" style="width: ${progressPercent}%"></div>
                            </div>
                            
                            ${approvedHours >= this.TARGET_HOURS 
                                ? '<p class="text-green-400 text-sm font-bold flex items-center"><i class="fa-solid fa-check-circle mr-2"></i> Soll erfüllt!</p>'
                                : `<p class="text-orange-400 text-sm flex items-center"><i class="fa-solid fa-circle-info mr-2"></i> Noch ${(this.TARGET_HOURS - approvedHours).toFixed(1)} Std. offen</p>`
                            }
                            
                            ${pendingHours > 0 ? `<p class="text-dark-muted text-xs mt-3 pt-3 border-t border-dark-border/50 italic flex items-center"><i class="fa-regular fa-clock mr-1.5"></i> + ${pendingHours} Std. in Prüfung</p>` : ''}
                        </div>
                    </div>
                </div>

                <!-- Historie Liste -->
                <div class="lg:col-span-2">
                    <div class="bg-dark-card rounded-2xl border border-dark-border overflow-hidden shadow-sm h-full flex flex-col">
                        <div class="p-4 border-b border-dark-border bg-dark-bg/30 flex justify-between items-center">
                            <h4 class="font-bold text-white text-sm">Deine Einsätze</h4>
                            <span class="text-xs text-dark-muted bg-dark-bg px-2 py-0.5 rounded border border-dark-border">${myEntries.length} Einträge</span>
                        </div>
                        
                        <div class="flex-1 overflow-y-auto max-h-[300px] custom-scrollbar">
                            ${myEntries.length === 0 
                                ? `<div class="p-12 text-center text-dark-muted text-sm flex flex-col items-center opacity-70"><i class="fa-regular fa-calendar-xmark text-3xl mb-2"></i>Noch keine Arbeitsstunden eingetragen.</div>`
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
        if(entry.status === 'approved') statusBadge = '<span class="px-2 py-0.5 bg-green-500/10 text-green-400 text-[10px] font-bold rounded border border-green-500/20">Genehmigt</span>';
        else if(entry.status === 'rejected') statusBadge = '<span class="px-2 py-0.5 bg-red-500/10 text-red-400 text-[10px] font-bold rounded border border-red-500/20">Abgelehnt</span>';
        else statusBadge = '<span class="px-2 py-0.5 bg-yellow-500/10 text-yellow-400 text-[10px] font-bold rounded border border-yellow-500/20">Prüfung</span>';

        return `
            <div class="p-4 flex items-center justify-between hover:bg-dark-hover/30 transition-colors group">
                <div class="min-w-0 pr-4">
                    <p class="text-white font-bold text-sm truncate">${entry.activity}</p>
                    <p class="text-dark-muted text-xs flex items-center gap-3 mt-1">
                        <span><i class="fa-regular fa-calendar mr-1"></i> ${new Date(entry.date).toLocaleDateString()}</span>
                        <span class="text-white font-mono"><i class="fa-regular fa-clock mr-1 text-dark-muted"></i>${entry.hours} Std.</span>
                    </p>
                    ${entry.comment ? `<p class="text-[10px] text-dark-muted mt-1 italic truncate max-w-xs">"${entry.comment}"</p>` : ''}
                </div>
                <div class="flex items-center gap-3">
                    ${statusBadge}
                    ${allowDelete ? `
                    <button onclick="WorkHoursView.deleteEntry(${entry.id})" class="text-dark-muted hover:text-red-400 p-1.5 rounded-lg hover:bg-red-500/10 transition-colors opacity-0 group-hover:opacity-100" title="Eintrag löschen">
                        <i class="fa-regular fa-trash-can"></i>
                    </button>` : ''}
                </div>
            </div>
        `;
    },

    // =========================================================================
    // ADMIN ANSICHT
    // =========================================================================
    renderAdminView() {
        // Offene Anträge sammeln
        const pendingEntries = Store.state.work_entries.filter(e => e.status === 'pending');
        
        // Gesamtstatistik berechnen
        const memberStats = Store.state.members.map(m => {
            const hours = Store.state.work_entries
                .filter(e => e.memberId === m.id && e.status === 'approved')
                .reduce((sum, e) => sum + parseFloat(e.hours), 0);
            return { ...m, hours };
        }).sort((a,b) => a.hours - b.hours); // Wenigste Stunden zuerst

        return `
            <div class="space-y-8 pb-10">
                <!-- 1. Offene Anträge (Posteingang) -->
                ${pendingEntries.length > 0 ? `
                <div>
                    <h4 class="text-sm font-bold text-yellow-400 uppercase tracking-wider mb-4 flex items-center">
                        <i class="fa-solid fa-inbox mr-2"></i> Offene Anträge <span class="ml-2 bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded text-xs border border-yellow-500/30">${pendingEntries.length}</span>
                    </h4>
                    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        ${pendingEntries.map(e => this.renderApprovalCard(e)).join('')}
                    </div>
                </div>` : 
                `<div class="p-6 bg-green-500/10 border border-green-500/20 rounded-2xl text-green-400 text-sm flex flex-col md:flex-row items-center justify-center gap-2">
                    <i class="fa-solid fa-check-circle text-xl"></i> 
                    <span>Alles erledigt! Keine offenen Anträge zur Prüfung.</span>
                 </div>`
                }

                <!-- 2. Gesamtübersicht Liste -->
                <div>
                    <div class="flex justify-between items-end mb-4">
                        <h4 class="text-sm font-bold text-dark-muted uppercase tracking-wider">Mitglieder Übersicht</h4>
                        <div class="text-xs text-dark-muted bg-dark-card border border-dark-border px-3 py-1 rounded-lg">
                            Ziel: <span class="text-white font-mono">${this.TARGET_HOURS}h</span>
                        </div>
                    </div>
                    
                    <div class="bg-dark-card rounded-2xl border border-dark-border overflow-hidden shadow-sm">
                        <div class="overflow-x-auto">
                            <table class="w-full text-left text-sm whitespace-nowrap">
                                <thead class="bg-dark-bg text-dark-muted text-xs uppercase border-b border-dark-border">
                                    <tr>
                                        <th class="p-4 font-semibold">Name</th>
                                        <th class="p-4 font-semibold hidden sm:table-cell">Rolle</th>
                                        <th class="p-4 font-semibold text-right">Stunden</th>
                                        <th class="p-4 font-semibold text-right w-32">Status</th>
                                        <th class="p-4 font-semibold text-right w-10"></th>
                                    </tr>
                                </thead>
                                <tbody class="divide-y divide-dark-border text-white">
                                    ${memberStats.map(m => {
                                        const isDone = m.hours >= this.TARGET_HOURS;
                                        const percent = Math.min(100, (m.hours / this.TARGET_HOURS) * 100);
                                        
                                        return `
                                        <tr class="hover:bg-dark-hover/50 transition-colors group">
                                            <td class="p-4">
                                                <div class="flex items-center gap-3">
                                                    <div class="w-8 h-8 rounded-full bg-slate-700 text-slate-300 flex items-center justify-center text-xs font-bold">
                                                        ${m.firstName.charAt(0)}${m.lastName.charAt(0)}
                                                    </div>
                                                    <span class="font-medium">${m.firstName} ${m.lastName}</span>
                                                </div>
                                            </td>
                                            <td class="p-4 text-dark-muted text-xs hidden sm:table-cell">${m.role}</td>
                                            <td class="p-4 text-right font-mono">
                                                <span class="${isDone ? 'text-green-400' : 'text-white'}">${m.hours.toFixed(1)}</span>
                                                <span class="text-dark-muted text-xs">/${this.TARGET_HOURS}</span>
                                            </td>
                                            <td class="p-4 text-right">
                                                <div class="w-24 h-1.5 bg-dark-bg rounded-full ml-auto overflow-hidden border border-dark-border/50">
                                                    <div class="h-full ${isDone ? 'bg-green-500' : 'bg-blue-500'} rounded-full" style="width: ${percent}%"></div>
                                                </div>
                                            </td>
                                            <td class="p-4 text-right">
                                                <button onclick="WorkHoursView.openMemberDetails(${m.id})" class="text-dark-muted hover:text-blue-400 p-2 rounded-lg hover:bg-dark-bg transition-colors" title="Details & Bearbeiten">
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
        const member = Store.state.members.find(m => m.id === entry.memberId);
        const name = member ? `${member.firstName} ${member.lastName}` : 'Unbekannt';

        return `
            <div class="bg-dark-card p-5 rounded-2xl border border-dark-border shadow-md flex flex-col hover:border-yellow-500/30 transition-all">
                <div class="flex justify-between items-start mb-3">
                    <div class="flex items-center gap-2">
                        <div class="w-8 h-8 rounded-full bg-slate-700 text-slate-300 flex items-center justify-center text-xs font-bold">
                            ${name.charAt(0)}
                        </div>
                        <h5 class="font-bold text-white text-sm">${name}</h5>
                    </div>
                    <span class="bg-blue-500/10 text-blue-400 text-xs px-2 py-1 rounded-md font-mono font-bold border border-blue-500/20">
                        ${entry.hours}h
                    </span>
                </div>
                
                <div class="bg-dark-bg/50 p-3 rounded-xl border border-dark-border/50 mb-4 flex-1">
                    <p class="text-sm text-white font-medium mb-1">${entry.activity}</p>
                    <p class="text-xs text-dark-muted flex items-center">
                        <i class="fa-regular fa-calendar mr-1.5"></i> ${new Date(entry.date).toLocaleDateString()}
                    </p>
                    ${entry.comment ? `<p class="text-xs text-dark-muted mt-2 pt-2 border-t border-dark-border/30 italic">"${entry.comment}"</p>` : ''}
                </div>
                
                <div class="mt-auto flex gap-2">
                    <button onclick="WorkHoursView.decide(${entry.id}, 'approved')" class="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1 shadow-lg shadow-green-900/20">
                        <i class="fa-solid fa-check"></i> Genehmigen
                    </button>
                    <button onclick="WorkHoursView.decide(${entry.id}, 'rejected')" class="flex-1 bg-dark-bg hover:bg-red-900/30 text-red-400 border border-dark-border hover:border-red-500/30 py-2 rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1">
                        <i class="fa-solid fa-xmark"></i> Ablehnen
                    </button>
                </div>
            </div>
        `;
    },

    // =========================================================================
    // ADMIN ACTIONS (MODAL)
    // =========================================================================
    
    openMemberDetails(memberId) {
        const member = Store.state.members.find(m => m.id === memberId);
        if(!member) return;

        const entries = Store.state.work_entries.filter(e => e.memberId === memberId).sort((a,b) => new Date(b.date) - new Date(a.date));
        const total = entries.filter(e => e.status === 'approved').reduce((sum, e) => sum + parseFloat(e.hours), 0);

        const html = `
            <div class="p-6 md:p-8 h-[80vh] flex flex-col">
                <div class="flex justify-between items-center mb-6 border-b border-dark-border pb-4">
                    <div>
                        <h3 class="text-xl font-bold text-white">${member.firstName} ${member.lastName}</h3>
                        <p class="text-sm text-blue-400 font-mono font-bold mt-1">${total} / ${this.TARGET_HOURS} Std. genehmigt</p>
                    </div>
                    <button onclick="App.closeModal()" class="text-dark-muted hover:text-white p-2 transition-colors"><i class="fa-solid fa-times text-xl"></i></button>
                </div>
                
                <div class="flex-1 overflow-y-auto custom-scrollbar bg-dark-bg/30 rounded-xl border border-dark-border">
                    ${entries.length === 0 
                        ? `<div class="p-8 text-center text-dark-muted text-sm">Keine Einträge vorhanden.</div>`
                        : `<div class="divide-y divide-dark-border">
                            ${entries.map(e => this.renderEntryRow(e, true)).join('')}
                           </div>`
                    }
                </div>
            </div>
        `;
        App.openModal(html);
        
        // Modal Style
        const modalContainer = document.getElementById('modal-content');
        if(modalContainer) {
            modalContainer.classList.remove('max-w-md');
            modalContainer.classList.add('max-w-2xl', 'w-full');
        }
    },

    // =========================================================================
    // GENERAL ACTIONS
    // =========================================================================

    deleteEntry(id) {
        if(confirm("Diesen Eintrag wirklich unwiderruflich löschen?")) {
            Store.remove('work_entries', id);
            
            // Views aktualisieren
            this.render(document.getElementById('content'));
            
            // Falls das Admin-Modal offen ist, dieses auch neu laden (etwas komplexer, wir schließen es einfachheitshalber oder laden neu)
            // Wenn wir im Modal sind, ist es sauberer es neu zu rendern oder zu schließen.
            // Check ob modal offen:
            const modal = document.getElementById('modal-content');
            if(modal && modal.innerHTML.includes('genehmigt')) {
                // Wir sind wahrscheinlich im Admin-Detail-Modal -> Schließen und Toast
                App.closeModal(); 
            }
            App.showToast("Eintrag gelöscht");
        }
    },

    decide(id, status) {
        const entry = Store.state.work_entries.find(e => e.id === id);
        if(entry) {
            entry.status = status;
            Store.save();
            App.showToast(status === 'approved' ? 'Stunden genehmigt' : 'Antrag abgelehnt');
            this.render(document.getElementById('content'));
        }
    },

    openAddModal() {
        const html = `
            <div class="p-6 md:p-8">
                <div class="flex justify-between items-center mb-6 border-b border-dark-border pb-4">
                    <h3 class="text-xl font-bold text-white">Arbeitsstunden erfassen</h3>
                    <button onclick="App.closeModal()" class="text-dark-muted hover:text-white p-2 transition-colors"><i class="fa-solid fa-times text-xl"></i></button>
                </div>
                
                <form onsubmit="WorkHoursView.handleSubmit(event)" class="space-y-5">
                    <div>
                        <label class="text-muted">Tätigkeit / Veranstaltung</label>
                        <input type="text" name="activity" required class="form-input" placeholder="z.B. Thekendienst Prunksitzung">
                    </div>

                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <label class="text-muted">Datum</label>
                            <input type="date" name="date" required class="form-input dark-date">
                        </div>
                        <div>
                            <label class="text-muted">Stunden (z.B. 4.5)</label>
                            <input type="number" name="hours" step="0.5" min="0.5" required class="form-input" placeholder="0.0">
                        </div>
                    </div>

                    <div>
                        <label class="text-muted">Bemerkung (Optional)</label>
                        <textarea name="comment" class="form-input" rows="2" placeholder="Details..."></textarea>
                    </div>
                    
                    <div class="p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl text-xs text-blue-400 flex gap-3">
                        <i class="fa-solid fa-circle-info mt-0.5 text-lg"></i>
                        <p>Der Eintrag wird an den Vorstand zur Prüfung gesendet. Nach Genehmigung werden die Stunden deinem Konto gutgeschrieben.</p>
                    </div>

                    <button type="submit" class="btn-primary w-full mt-2">Einreichen</button>
                </form>
            </div>
        `;
        App.openModal(html);
    },

    handleSubmit(e) {
        e.preventDefault();
        const fd = new FormData(e.target);
        
        const newEntry = {
            id: Date.now(),
            memberId: App.state.currentUser ? App.state.currentUser.id : 0,
            activity: fd.get('activity'),
            date: fd.get('date'),
            hours: parseFloat(fd.get('hours')),
            comment: fd.get('comment'),
            status: 'pending' // Muss erst genehmigt werden
        };

        Store.add('work_entries', newEntry);
        App.closeModal();
        App.showToast('Antrag erfolgreich eingereicht');
        this.render(document.getElementById('content'));
    }
};