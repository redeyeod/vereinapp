/**
 * =============================================================================
 * CALENDAR VIEW (Clean & Mobile First)
 * Verwaltung der Termine und Veranstaltungen (Global)
 * =============================================================================
 */

const CalendarView = {
    /**
     * Rendert die Kalender-Ansicht
     * @param {HTMLElement} container 
     */
    render(container) {
        // Sicherheits-Check: Falls Events noch undefined sind
        const allEvents = Store.state.events || [];

        // Filtere Events: NUR globale Events anzeigen (keine Gruppen-Events)
        // Sortiere Events nach Datum (nächste zuerst)
        const sortedEvents = allEvents
            .filter(e => !e.group) // Nur Events ohne Gruppe
            .sort((a, b) => new Date(a.date) - new Date(b.date));
        
        // Berechtigungs-Check
        const canManage = App.can('manage_events');

        // Add Button: Kompakt und modern
        const addButton = canManage 
            ? `<button onclick="CalendarView.openAddModal()" class="pl-3 pr-4 py-2 bg-brand-600 hover:bg-brand-500 text-white rounded-xl text-sm font-bold shadow-lg shadow-brand-500/20 transition-all flex items-center gap-2">
                 <i class="fa-solid fa-plus"></i> <span class="hidden sm:inline">Termin</span><span class="sm:hidden">Neu</span>
               </button>`
            : '';

        container.innerHTML = `
            <div class="fade-in space-y-6 pb-20">
                <!-- Header -->
                <div class="flex justify-between items-end px-1">
                    <div>
                        <h2 class="text-2xl md:text-3xl font-bold text-white">Kalender</h2>
                        <p class="text-dark-muted text-sm mt-1">Alle öffentlichen Veranstaltungen.</p>
                    </div>
                    ${addButton}
                </div>

                <!-- Event List -->
                <div class="space-y-3">
                    ${sortedEvents.length > 0 ? sortedEvents.map(e => this.renderEventCard(e, canManage)).join('') : 
                    `<div class="flex flex-col items-center justify-center py-20 text-center border border-dashed border-dark-border rounded-3xl bg-dark-bg/30">
                        <div class="w-16 h-16 bg-dark-card rounded-full flex items-center justify-center mb-4 border border-dark-border shadow-sm">
                            <i class="fa-regular fa-calendar-xmark text-2xl text-dark-muted"></i>
                        </div>
                        <h3 class="text-white font-bold">Keine Termine</h3>
                        <p class="text-dark-muted text-sm mt-1">Aktuell stehen keine Veranstaltungen an.</p>
                    </div>`}
                </div>
            </div>
        `;
    },

    renderEventCard(e, canManage) {
        const startDate = new Date(e.date);
        const endDate = e.endDate ? new Date(e.endDate) : null;
        
        // Prüfen ob mehrtägig (für Anzeige im Badge)
        const isMultiDay = endDate && (endDate.getDate() !== startDate.getDate() || endDate.getMonth() !== startDate.getMonth());
        
        const dateDisplayMonth = startDate.toLocaleString('de-DE', { month: 'short' });
        const dateDisplayDay = startDate.getDate();

        // Datums-Range Text für Badge
        let rangeBadge = '';
        if (isMultiDay) {
            rangeBadge = `<div class="text-[9px] mt-1 border-t border-white/10 pt-1 text-brand-200">bis ${endDate.getDate()}.${endDate.toLocaleString('de-DE', { month: 'numeric' })}.</div>`;
        }

        return `
            <div onclick="CalendarView.openDetailModal(${e.id})" class="bg-dark-card hover:bg-dark-hover border border-dark-border p-4 rounded-2xl flex items-center gap-4 cursor-pointer group relative overflow-hidden transition-all shadow-sm">
                <!-- Hover Effect Line -->
                <div class="absolute left-0 top-4 bottom-4 w-1 bg-brand-500 rounded-r-full opacity-0 group-hover:opacity-100 transition-opacity"></div>

                <!-- Date Badge -->
                <div class="bg-dark-bg border border-dark-border rounded-xl p-2 text-center min-w-[64px] group-hover:border-brand-500/30 transition-colors flex-shrink-0">
                    <div class="text-[10px] font-bold uppercase text-brand-500">${dateDisplayMonth}</div>
                    <div class="text-xl font-bold text-white leading-none mt-0.5">${dateDisplayDay}</div>
                    ${rangeBadge}
                </div>

                <!-- Content -->
                <div class="flex-1 min-w-0">
                    <div class="flex justify-between items-start">
                        <h4 class="text-white font-bold text-base truncate pr-2 group-hover:text-brand-400 transition-colors">${e.title}</h4>
                        ${e.comment ? '<i class="fa-solid fa-circle-info text-brand-500 text-[8px] mt-1.5 animate-pulse"></i>' : ''}
                    </div>
                    
                    <div class="flex flex-wrap gap-x-4 gap-y-1 text-xs text-dark-muted mt-1.5 items-center">
                        <span class="flex items-center"><i class="fa-regular fa-clock mr-1.5 text-brand-500/70"></i> ${e.allDay ? 'Ganztägig' : (e.time || 'Zeit n.a.')}</span>
                        ${e.location ? `<span class="flex items-center truncate max-w-[140px]"><i class="fa-solid fa-location-dot mr-1.5 text-brand-500/70"></i> ${e.location}</span>` : ''}
                    </div>
                </div>

                <!-- Chevron Icon -->
                <div class="text-dark-muted opacity-50 group-hover:opacity-100 group-hover:translate-x-1 transition-all pl-2">
                    <i class="fa-solid fa-chevron-right text-xs"></i>
                </div>
            </div>
        `;
    },

    /**
     * Öffnet die Detail-Ansicht eines Termins (Großes Modal)
     */
    openDetailModal(id) {
        const e = Store.state.events ? Store.state.events.find(ev => ev.id === id) : null;
        if(!e) return;
        
        const canManage = App.can('manage_events');

        const startDate = new Date(e.date);
        const endDate = e.endDate ? new Date(e.endDate) : null;
        const dateStr = startDate.toLocaleDateString('de-DE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        const endDateStr = endDate && endDate.getTime() !== startDate.getTime() ? endDate.toLocaleDateString('de-DE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : null;

        // Links im Text klickbar machen
        const formatDescription = (text) => {
            if(!text) return '<span class="text-dark-muted italic text-sm">Keine Beschreibung vorhanden.</span>';
            let formatted = text.replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" class="text-brand-400 hover:underline break-all">$1</a>');
            return formatted.replace(/\n/g, '<br>');
        };

        const html = `
            <div class="p-6 md:p-8 h-full flex flex-col">
                <!-- Header -->
                <div class="flex justify-between items-start mb-6 border-b border-dark-border pb-4">
                    <div class="pr-4">
                        <div class="flex items-center gap-2 mb-2">
                            <span class="bg-brand-500/10 text-brand-400 text-[10px] font-bold px-2 py-0.5 rounded border border-brand-500/20 uppercase tracking-wider">Event</span>
                        </div>
                        <h3 class="text-2xl md:text-3xl font-bold text-white leading-tight break-words">${e.title}</h3>
                    </div>
                    <button onclick="App.closeModal()" class="w-8 h-8 rounded-full bg-dark-bg text-dark-muted hover:text-white flex items-center justify-center transition-colors flex-shrink-0"><i class="fa-solid fa-times text-lg"></i></button>
                </div>
                
                <div class="flex-1 overflow-y-auto custom-scrollbar pr-1 space-y-6">
                    
                    <!-- Info Grid -->
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <!-- Zeit & Datum -->
                        <div class="bg-dark-bg/50 p-4 rounded-2xl border border-dark-border flex items-start gap-4">
                            <div class="w-10 h-10 rounded-xl bg-brand-500/10 text-brand-500 flex items-center justify-center text-lg flex-shrink-0">
                                <i class="fa-regular fa-clock"></i>
                            </div>
                            <div>
                                <p class="text-xs font-bold text-dark-muted uppercase tracking-wider mb-0.5">Wann?</p>
                                <p class="text-white font-medium text-sm leading-snug">${dateStr}</p>
                                ${endDateStr ? `<p class="text-dark-muted text-xs mt-0.5">bis ${endDateStr}</p>` : ''}
                                <p class="text-brand-400 font-bold text-sm mt-1">${e.allDay ? 'Ganztägig' : (e.time + ' Uhr')}</p>
                            </div>
                        </div>

                        <!-- Ort -->
                        ${e.location ? `
                        <div class="bg-dark-bg/50 p-4 rounded-2xl border border-dark-border flex items-start gap-4">
                            <div class="w-10 h-10 rounded-xl bg-red-500/10 text-red-400 flex items-center justify-center text-lg flex-shrink-0">
                                <i class="fa-solid fa-location-dot"></i>
                            </div>
                            <div>
                                <p class="text-xs font-bold text-dark-muted uppercase tracking-wider mb-0.5">Wo?</p>
                                <p class="text-white font-medium text-sm leading-snug">${e.location}</p>
                                <a href="https://maps.google.com/?q=${encodeURIComponent(e.location)}" target="_blank" class="text-xs text-dark-muted hover:text-white underline decoration-dotted mt-1 inline-block">Karte öffnen</a>
                            </div>
                        </div>` : ''}
                    </div>

                    <!-- Notiz (Kurz) -->
                    ${e.comment ? `
                    <div class="p-4 rounded-xl bg-amber-500/5 border border-amber-500/10 flex gap-3">
                        <i class="fa-solid fa-circle-info text-amber-500 mt-0.5 flex-shrink-0"></i>
                        <p class="text-sm text-amber-200/80 italic leading-relaxed">${e.comment}</p>
                    </div>` : ''}

                    <!-- Beschreibung (Lang) -->
                    <div>
                        <div class="flex justify-between items-center mb-3">
                            <h4 class="text-xs font-bold text-dark-muted uppercase tracking-wider">Details</h4>
                            ${canManage ? `<button onclick="CalendarView.openDescriptionModal(${e.id})" class="text-xs text-brand-400 hover:text-white transition-colors flex items-center gap-1"><i class="fa-solid fa-pen"></i> Bearbeiten</button>` : ''}
                        </div>
                        <div class="bg-dark-bg p-5 rounded-2xl border border-dark-border text-dark-text leading-relaxed text-sm shadow-inner min-h-[100px]">
                            ${formatDescription(e.description)}
                        </div>
                    </div>
                </div>

                <!-- Footer Actions (Admin only) -->
                ${canManage ? `
                <div class="mt-6 pt-6 border-t border-dark-border flex gap-3">
                    <button onclick="CalendarView.openEditModal(${e.id})" class="flex-1 btn-primary text-sm">
                        <i class="fa-solid fa-pen mr-2"></i> Bearbeiten
                    </button>
                    <button onclick="CalendarView.delete(${e.id}); App.closeModal()" class="flex-1 py-3 bg-dark-bg hover:bg-red-500/10 border border-dark-border hover:border-red-500/30 rounded-xl text-red-400 font-bold transition-all text-sm">
                        <i class="fa-regular fa-trash-can mr-2"></i> Löschen
                    </button>
                </div>` : ''}
            </div>
        `;
        
        App.openModal(html);
        
        // Modal Größe anpassen
        const modalContainer = document.getElementById('modal-content');
        if(modalContainer) {
            modalContainer.classList.remove('max-w-md');
            modalContainer.classList.add('max-w-3xl', 'w-full', 'max-h-[90vh]');
        }
    },

    /**
     * Modal NUR für die lange Beschreibung (Editor)
     */
    openDescriptionModal(id) {
        if(!App.can('manage_events')) return;

        const e = Store.state.events.find(ev => ev.id === id);
        if(!e) return;

        const html = `
            <div class="p-6 h-full flex flex-col">
                <div class="flex justify-between items-center mb-4 border-b border-dark-border pb-4">
                    <h3 class="text-lg font-bold text-white">Beschreibung bearbeiten</h3>
                    <button onclick="CalendarView.openDetailModal(${id})" class="text-dark-muted hover:text-white p-2 flex items-center gap-2 text-xs font-bold bg-dark-bg rounded-lg border border-dark-border transition-colors">
                        <i class="fa-solid fa-arrow-left"></i> Zurück
                    </button>
                </div>
                
                <form onsubmit="CalendarView.handleDescriptionUpdate(event, ${id})" class="flex-1 flex flex-col">
                    <div class="flex-1 mb-4 relative">
                        <textarea name="description" class="w-full h-full bg-dark-bg border border-dark-border rounded-xl p-4 text-white focus:outline-none focus:border-brand-500 transition-colors font-mono text-sm resize-none custom-scrollbar" placeholder="Hier können Details, Links und weitere Infos stehen...">${e.description || ''}</textarea>
                    </div>
                    <button type="submit" class="btn-primary w-full py-3">Speichern & Zurück</button>
                </form>
            </div>
        `;
        App.openModal(html);

        const modalContainer = document.getElementById('modal-content');
        if(modalContainer) {
            modalContainer.classList.remove('max-w-md');
            modalContainer.classList.add('max-w-4xl', 'w-full', 'h-[80vh]');
        }
    },

    delete(id) {
        if(!App.can('manage_events')) return;

        if(confirm("Termin wirklich löschen?")) {
            Store.remove('events', id);
            setTimeout(() => this.render(document.getElementById('content')), 100);
            App.showToast('Termin gelöscht');
        }
    },

    // --- ADD / EDIT FORM MODALS ---

    openAddModal() {
        if(!App.can('manage_events')) return;

        const html = `
            <div class="p-6 max-h-[85vh] overflow-y-auto custom-scrollbar">
                <div class="flex justify-between items-center mb-6 border-b border-dark-border pb-4 sticky top-0 bg-dark-card z-10">
                    <h3 class="text-xl font-bold text-white">Neuer Termin</h3>
                    <button onclick="App.closeModal()" class="text-dark-muted hover:text-white p-2 transition-colors"><i class="fa-solid fa-times text-xl"></i></button>
                </div>
                
                <form onsubmit="CalendarView.handleAdd(event)" class="space-y-5">
                    <div>
                        <label class="text-xs font-bold text-dark-muted uppercase mb-1 block">Titel</label>
                        <input type="text" name="title" required class="form-input" placeholder="z.B. Sommerfest">
                    </div>
                    
                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <label class="text-xs font-bold text-dark-muted uppercase mb-1 block">Start</label>
                            <input type="date" name="date" id="startDateInput" required class="form-input dark-date" onchange="document.getElementById('endDateInput').min = this.value; if(!document.getElementById('endDateInput').value) document.getElementById('endDateInput').value = this.value;">
                        </div>
                        <div>
                            <label class="text-xs font-bold text-dark-muted uppercase mb-1 block">Ende (Optional)</label>
                            <input type="date" name="endDate" id="endDateInput" class="form-input dark-date">
                        </div>
                    </div>

                    <div class="grid grid-cols-2 gap-4 items-end">
                        <div>
                            <label class="text-xs font-bold text-dark-muted uppercase mb-1 block">Uhrzeit</label>
                            <input type="time" name="time" id="eventTimeInput" required class="form-input dark-date">
                        </div>
                        <label class="flex items-center gap-3 p-3 bg-dark-bg/50 border border-dark-border rounded-xl cursor-pointer hover:border-brand-500/50 transition-colors h-[46px]">
                            <input type="checkbox" name="allDay" id="eventAllDay" class="w-5 h-5 rounded border-dark-border bg-dark-bg text-brand-600 focus:ring-brand-500" 
                                onchange="const t = document.getElementById('eventTimeInput'); t.disabled = this.checked; if(this.checked) t.value = ''; else t.focus(); t.required = !this.checked;">
                            <span class="text-sm font-medium text-white">Ganztägig</span>
                        </label>
                    </div>
                    
                    <div>
                        <label class="text-xs font-bold text-dark-muted uppercase mb-1 block">Ort</label>
                        <input type="text" name="location" class="form-input" placeholder="z.B. Vereinsheim">
                    </div>

                    <div>
                        <label class="text-xs font-bold text-dark-muted uppercase mb-1 block">Kurzbeschreibung (Vorschau)</label>
                        <input type="text" name="comment" class="form-input" placeholder="Z.B. 'Wichtig: Sportkleidung mitbringen'">
                    </div>
                    
                    <button type="submit" class="btn-primary w-full mt-4">Termin erstellen</button>
                </form>
            </div>
        `;
        App.openModal(html);
    },

    openEditModal(id) {
        if(!App.can('manage_events')) return;

        const e = Store.state.events.find(ev => ev.id === id);
        if(!e) return;

        const timeValue = e.time || '';
        const allDayChecked = e.allDay ? 'checked' : '';
        const timeDisabled = e.allDay ? 'disabled' : '';

        const html = `
            <div class="p-6 max-h-[85vh] overflow-y-auto custom-scrollbar">
                <div class="flex justify-between items-center mb-6 border-b border-dark-border pb-4 sticky top-0 bg-dark-card z-10">
                    <h3 class="text-xl font-bold text-white">Termin bearbeiten</h3>
                    <button onclick="App.closeModal()" class="text-dark-muted hover:text-white p-2 transition-colors"><i class="fa-solid fa-times text-xl"></i></button>
                </div>
                
                <form onsubmit="CalendarView.handleUpdate(event, ${id})" class="space-y-5">
                    <div>
                        <label class="text-xs font-bold text-dark-muted uppercase mb-1 block">Titel</label>
                        <input type="text" name="title" value="${e.title}" required class="form-input">
                    </div>
                    
                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <label class="text-xs font-bold text-dark-muted uppercase mb-1 block">Start</label>
                            <input type="date" name="date" value="${e.date}" id="editStartDateInput" required class="form-input dark-date" onchange="document.getElementById('editEndDateInput').min = this.value">
                        </div>
                        <div>
                            <label class="text-xs font-bold text-dark-muted uppercase mb-1 block">Ende</label>
                            <input type="date" name="endDate" value="${e.endDate || ''}" id="editEndDateInput" class="form-input dark-date">
                        </div>
                    </div>

                    <div class="grid grid-cols-2 gap-4 items-end">
                        <div>
                            <label class="text-xs font-bold text-dark-muted uppercase mb-1 block">Uhrzeit</label>
                            <input type="time" name="time" value="${timeValue}" id="editEventTimeInput" ${timeDisabled} required class="form-input dark-date">
                        </div>
                        <label class="flex items-center gap-3 p-3 bg-dark-bg/50 border border-dark-border rounded-xl cursor-pointer hover:border-brand-500/50 transition-colors h-[46px]">
                            <input type="checkbox" name="allDay" id="editEventAllDay" ${allDayChecked} class="w-5 h-5 rounded border-dark-border bg-dark-bg text-brand-600 focus:ring-brand-500" 
                                onchange="const t = document.getElementById('editEventTimeInput'); t.disabled = this.checked; if(this.checked) t.value = ''; else t.focus(); t.required = !this.checked;">
                            <span class="text-sm font-medium text-white">Ganztägig</span>
                        </label>
                    </div>
                    
                    <div>
                        <label class="text-xs font-bold text-dark-muted uppercase mb-1 block">Ort</label>
                        <input type="text" name="location" value="${e.location || ''}" class="form-input">
                    </div>

                    <div>
                        <label class="text-xs font-bold text-dark-muted uppercase mb-1 block">Kurzbeschreibung</label>
                        <input type="text" name="comment" value="${e.comment || ''}" class="form-input">
                    </div>
                    
                    <button type="submit" class="btn-primary w-full mt-4">Änderungen speichern</button>
                </form>
            </div>
        `;
        App.openModal(html);
    },

    handleAdd(e) {
        e.preventDefault();
        const fd = new FormData(e.target);
        const isAllDay = fd.get('allDay') === 'on';
        const startDate = fd.get('date');
        let endDate = fd.get('endDate');
        if (!endDate || new Date(endDate) < new Date(startDate)) endDate = startDate;

        const newEvent = {
            title: fd.get('title'),
            date: startDate,
            endDate: endDate,
            time: isAllDay ? null : fd.get('time'),
            allDay: isAllDay,
            location: fd.get('location'),
            comment: fd.get('comment'),
            description: '', 
            group: null 
        };
        
        Store.add('events', newEvent);
        App.closeModal();
        App.showToast('Termin erstellt');
    },

    async handleUpdate(e, id) {
        e.preventDefault();
        const fd = new FormData(e.target);
        const isAllDay = fd.get('allDay') === 'on';
        const startDate = fd.get('date');
        let endDate = fd.get('endDate');
        if (!endDate || new Date(endDate) < new Date(startDate)) endDate = startDate;

        // Wir holen das Original-Objekt, um die ID und andere Felder zu behalten
        const originalEvent = Store.state.events.find(ev => ev.id === id);
        
        if (originalEvent) {
            const updatedEvent = {
                ...originalEvent,
                title: fd.get('title'),
                date: startDate,
                endDate: endDate,
                time: isAllDay ? null : fd.get('time'),
                allDay: isAllDay,
                location: fd.get('location'),
                comment: fd.get('comment')
            };

            await Store.update('events', updatedEvent);
            
            // Lokales Update für sofortiges Feedback (Optional, da Realtime oft schnell genug ist)
            const index = Store.state.events.indexOf(originalEvent);
            if(index !== -1) Store.state.events[index] = updatedEvent;

            App.closeModal();
            App.showToast('Stammdaten gespeichert');
            // Zurück zur Detail-Ansicht um Änderungen zu sehen
            this.openDetailModal(id);
        }
    },

    async handleDescriptionUpdate(e, id) {
        e.preventDefault();
        const fd = new FormData(e.target);
        const originalEvent = Store.state.events.find(ev => ev.id === id);
        
        if (originalEvent) {
            const updatedEvent = {
                ...originalEvent,
                description: fd.get('description')
            };

            await Store.update('events', updatedEvent);
            
            // Lokales Update
            const index = Store.state.events.indexOf(originalEvent);
            if(index !== -1) Store.state.events[index] = updatedEvent;

            App.showToast('Inhalt gespeichert');
            this.openDetailModal(id);
        }
    }
};

// WICHTIG: Global verfügbar machen für die neue App.js
window.CalendarView = CalendarView;
