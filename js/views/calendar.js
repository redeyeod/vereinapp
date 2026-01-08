/**
 * =============================================================================
 * CALENDAR VIEW
 * Verwaltung der Termine und Veranstaltungen (Global)
 * =============================================================================
 */

const CalendarView = {
    /**
     * Rendert die Kalender-Ansicht
     * @param {HTMLElement} container 
     */
    render(container) {
        // Filtere Events: NUR globale Events anzeigen (keine Gruppen-Events)
        // Sortiere Events nach Datum (nächste zuerst)
        const sortedEvents = Store.state.events
            .filter(e => !e.group) // Nur Events ohne Gruppe
            .sort((a, b) => new Date(a.date) - new Date(b.date));
        
        // Berechtigungs-Check
        const canManage = App.can('manage_events');

        // Add Button: Kompakt und modern
        const addButton = canManage 
            ? `<button onclick="CalendarView.openAddModal()" class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-bold transition-colors shadow-lg shadow-blue-900/20 flex items-center">
                    <i class="fa-solid fa-plus mr-2"></i> <span class="hidden sm:inline">Termin eintragen</span><span class="sm:hidden">Neu</span>
               </button>`
            : '';

        container.innerHTML = `
            <div class="flex justify-between items-center mb-4 md:mb-6">
                <h3 class="text-lg md:text-xl font-bold text-white">Kommende Veranstaltungen</h3>
                ${addButton}
            </div>

            <div class="space-y-3 fade-in">
                ${sortedEvents.length > 0 ? sortedEvents.map(e => {
                    // Datumslogik für mehrtägige Events
                    const startDate = new Date(e.date);
                    const endDate = e.endDate ? new Date(e.endDate) : null;
                    const isMultiDay = endDate && (endDate.getDate() !== startDate.getDate() || endDate.getMonth() !== startDate.getMonth() || endDate.getFullYear() !== startDate.getFullYear());
                    
                    const dateDisplayMonth = startDate.toLocaleString('de-DE', { month: 'short' });
                    const dateDisplayDay = startDate.getDate();

                    // Actions nur für Admins
                    const listActions = canManage 
                        ? `<div class="mt-3 sm:mt-0 sm:ml-4 flex gap-2 justify-end sm:justify-start border-t sm:border-t-0 border-dark-border/50 pt-3 sm:pt-0">
                             <button onclick="event.stopPropagation(); CalendarView.openEditModal(${e.id})" class="text-dark-muted hover:text-blue-400 p-2 rounded-lg hover:bg-blue-500/10 transition-colors" title="Daten bearbeiten">
                                <i class="fa-solid fa-pen"></i>
                             </button>
                             <button onclick="event.stopPropagation(); CalendarView.delete(${e.id})" class="text-dark-muted hover:text-red-400 p-2 rounded-lg hover:bg-red-500/10 transition-colors" title="Löschen">
                                <i class="fa-regular fa-trash-can"></i>
                             </button>
                           </div>` 
                        : '';

                    return `
                    <div onclick="CalendarView.openDetailModal(${e.id})" class="bg-dark-card p-4 md:p-5 rounded-2xl border border-dark-border flex flex-col sm:flex-row sm:items-start hover:border-blue-500/50 transition-all shadow-sm group cursor-pointer relative">
                        
                        <!-- Hover Stripe -->
                        <div class="absolute left-0 top-4 bottom-4 w-1 bg-blue-500 rounded-r-full opacity-0 group-hover:opacity-100 transition-opacity"></div>

                        <!-- Datums-Box -->
                        <div class="flex items-center sm:block mb-3 sm:mb-0 w-full sm:w-24 flex-shrink-0">
                            <div class="bg-dark-bg/50 border border-dark-border rounded-xl px-4 py-2 sm:py-3 mr-3 sm:mr-0 text-center flex-shrink-0 min-w-[70px]">
                                <div class="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-blue-400">
                                    ${dateDisplayMonth}
                                </div>
                                <div class="text-xl sm:text-2xl font-bold text-white leading-none mt-1">
                                    ${dateDisplayDay}
                                </div>
                                ${isMultiDay ? `<div class="text-[9px] mt-1 border-t border-dark-border pt-1 text-dark-muted">bis ${endDate.getDate()}.${endDate.toLocaleString('de-DE', { month: 'numeric' })}.</div>` : ''}
                            </div>
                            <div class="sm:hidden font-bold text-white text-base truncate flex-1">${e.title}</div>
                        </div>
                        
                        <!-- Details -->
                        <div class="flex-1 sm:pl-4 min-w-0">
                            <h4 class="text-white font-bold text-lg truncate hidden sm:block mb-1" title="${e.title}">
                                ${e.title}
                            </h4>
                            
                            <div class="flex flex-wrap gap-x-4 gap-y-1 text-xs text-dark-muted items-center">
                                <span class="flex items-center bg-dark-bg/30 px-2 py-1 rounded-md">
                                    <i class="fa-regular fa-clock mr-1.5 text-blue-400"></i>
                                    ${e.allDay ? 'Ganztägig' : (e.time ? e.time + ' Uhr' : 'Zeit n.a.')}
                                </span>
                                ${e.location ? `<span class="flex items-center"><i class="fa-solid fa-location-dot mr-1.5 text-red-400"></i> <span class="truncate max-w-[150px]">${e.location}</span></span>` : ''}
                            </div>
                            <!-- Kurzbeschreibung anzeigen (Vorschau) -->
                            ${e.comment ? `<div class="text-sm text-dark-muted mt-2 pl-2 border-l-2 border-dark-border line-clamp-2">${e.comment}</div>` : ''}
                        </div>

                        <!-- Aktionen -->
                        ${listActions}
                    </div>
                `}).join('') : 
                
                `<div class="text-center py-12 text-dark-muted border border-dashed border-dark-border rounded-2xl bg-dark-bg/20">
                    <i class="fa-regular fa-calendar-times text-4xl mb-3 opacity-50"></i>
                    <p class="text-sm">Keine anstehenden Termine.</p>
                </div>`
                }
            </div>
        `;
    },

    /**
     * Öffnet die Detail-Ansicht eines Termins (Großes Modal)
     */
    openDetailModal(id) {
        const e = Store.state.events.find(ev => ev.id === id);
        if(!e) return;
        
        const canManage = App.can('manage_events');

        const startDate = new Date(e.date);
        const endDate = e.endDate ? new Date(e.endDate) : null;
        const dateStr = startDate.toLocaleDateString('de-DE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        const endDateStr = endDate && endDate.getTime() !== startDate.getTime() ? endDate.toLocaleDateString('de-DE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : null;

        // Links im Text klickbar machen (einfache Regex)
        const formatDescription = (text) => {
            if(!text) return '<span class="text-dark-muted italic text-sm">Keine detaillierte Beschreibung vorhanden.</span>';
            let formatted = text.replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" class="text-blue-400 hover:underline break-all">$1</a>');
            return formatted.replace(/\n/g, '<br>');
        };

        // Edit Button für Beschreibung (nur für Admins)
        const editDescBtn = canManage 
            ? `<button onclick="CalendarView.openDescriptionModal(${e.id})" class="text-xs bg-dark-bg border border-dark-border hover:bg-dark-hover text-blue-400 px-3 py-1.5 rounded-lg transition-colors flex items-center">
                 <i class="fa-solid fa-pen mr-1.5"></i> Bearbeiten
               </button>` 
            : '';

        // Footer Actions (nur für Admins)
        const footerActions = canManage 
            ? `<div class="mt-6 pt-6 border-t border-dark-border flex flex-col sm:flex-row gap-3">
                    <button onclick="CalendarView.openEditModal(${e.id})" class="flex-1 bg-slate-700 hover:bg-slate-600 text-white px-6 py-3 rounded-xl font-bold transition-colors">
                        <i class="fa-solid fa-pen mr-2"></i> Termin bearbeiten
                    </button>
                    
                    <button onclick="CalendarView.delete(${e.id}); App.closeModal()" class="bg-dark-bg hover:bg-red-900/20 text-red-400 border border-dark-border hover:border-red-500/30 px-6 py-3 rounded-xl font-bold transition-colors" title="Löschen">
                        <i class="fa-regular fa-trash-can"></i>
                    </button>
               </div>` 
            : '';

        const html = `
            <div class="p-5 md:p-8 h-full flex flex-col">
                <div class="flex justify-between items-start mb-6 border-b border-dark-border pb-4">
                    <h3 class="text-xl md:text-2xl font-bold text-white pr-4 break-words leading-tight">${e.title}</h3>
                    <button onclick="App.closeModal()" class="text-dark-muted hover:text-white p-2 transition-colors"><i class="fa-solid fa-times text-xl"></i></button>
                </div>
                
                <div class="flex-1 overflow-y-auto custom-scrollbar pr-2">
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
                        <!-- Details -->
                        <div class="space-y-4">
                            <div class="bg-dark-bg p-4 rounded-xl border border-dark-border">
                                <div class="flex items-start gap-4 mb-3">
                                    <div class="w-8 h-8 rounded-full bg-blue-500/10 text-blue-400 flex items-center justify-center text-sm shrink-0">
                                        <i class="fa-regular fa-clock"></i>
                                    </div>
                                    <div>
                                        <p class="text-white font-medium text-sm">${dateStr}</p>
                                        ${endDateStr ? `<p class="text-dark-muted text-xs">bis ${endDateStr}</p>` : ''}
                                        <p class="text-blue-400 font-bold text-sm mt-0.5">${e.allDay ? 'Ganztägig' : (e.time + ' Uhr')}</p>
                                    </div>
                                </div>

                                ${e.location ? `
                                <div class="flex items-start gap-4 pt-3 border-t border-dark-border/50">
                                    <div class="w-8 h-8 rounded-full bg-red-500/10 text-red-400 flex items-center justify-center text-sm shrink-0">
                                        <i class="fa-solid fa-location-dot"></i>
                                    </div>
                                    <div>
                                        <p class="text-white font-medium text-sm">${e.location}</p>
                                        <a href="https://maps.google.com/?q=${encodeURIComponent(e.location)}" target="_blank" class="text-xs text-dark-muted hover:text-blue-400 underline decoration-dotted">Auf Karte zeigen</a>
                                    </div>
                                </div>` : ''}
                            </div>

                            ${e.comment ? `
                            <div class="p-4 rounded-xl bg-dark-bg/50 border border-dark-border/50">
                                <p class="text-[10px] text-dark-muted font-bold uppercase mb-1 tracking-wider">Notiz</p>
                                <p class="text-sm text-white italic leading-relaxed">${e.comment}</p>
                            </div>` : ''}
                        </div>

                        <!-- Beschreibung -->
                        <div>
                            <div class="flex justify-between items-center mb-2">
                                <h4 class="text-xs font-bold text-dark-muted uppercase tracking-wider">Beschreibung</h4>
                                ${editDescBtn}
                            </div>
                            <div class="bg-dark-bg p-5 rounded-xl border border-dark-border text-white leading-relaxed text-sm shadow-inner min-h-[150px]">
                                ${formatDescription(e.description)}
                            </div>
                        </div>
                    </div>
                </div>

                ${footerActions}
            </div>
        `;
        
        App.openModal(html);
        
        const modalContainer = document.getElementById('modal-content');
        if(modalContainer) {
            modalContainer.classList.remove('max-w-md');
            modalContainer.classList.add('max-w-4xl', 'w-full', 'max-h-[90vh]');
        }
    },

    /**
     * Neues Modal NUR für die lange Beschreibung
     */
    openDescriptionModal(id) {
        if(!App.can('manage_events')) return;

        const e = Store.state.events.find(ev => ev.id === id);
        if(!e) return;

        const html = `
            <div class="p-6 h-full flex flex-col">
                <div class="flex justify-between items-center mb-4 border-b border-dark-border pb-4">
                    <h3 class="text-lg font-bold text-white">Beschreibung bearbeiten</h3>
                    <!-- Zurück zum Detail, nicht schließen -->
                    <button onclick="CalendarView.openDetailModal(${id})" class="text-dark-muted hover:text-white p-2 flex items-center gap-2 text-xs font-bold bg-dark-bg rounded-lg border border-dark-border">
                        <i class="fa-solid fa-arrow-left"></i> Zurück
                    </button>
                </div>
                
                <form onsubmit="CalendarView.handleDescriptionUpdate(event, ${id})" class="flex-1 flex flex-col">
                    <div class="flex-1 mb-4">
                        <textarea name="description" class="w-full h-full bg-dark-bg border border-dark-border rounded-xl p-4 text-white focus:outline-none focus:border-blue-500 transition-colors font-mono text-sm resize-none" placeholder="Hier können Details, Links und weitere Infos stehen...">${e.description || ''}</textarea>
                    </div>
                    
                    <button type="submit" class="btn-primary w-full py-3">Speichern & Zurück</button>
                </form>
            </div>
        `;
        App.openModal(html);

        // Auch hier Großes Modal nutzen
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
            this.render(document.getElementById('content'));
            App.showToast('Termin gelöscht');
        }
    },

    openAddModal() {
        if(!App.can('manage_events')) return;

        const html = `
            <div class="p-6 max-h-[85vh] overflow-y-auto custom-scrollbar">
                <div class="flex justify-between items-center mb-6 border-b border-dark-border pb-4">
                    <h3 class="text-xl font-bold text-white">Neuer Termin</h3>
                    <button onclick="App.closeModal()" class="text-dark-muted hover:text-white p-2 transition-colors"><i class="fa-solid fa-times text-xl"></i></button>
                </div>
                
                <form onsubmit="CalendarView.handleAdd(event)" class="space-y-5">
                    <div>
                        <label class="text-muted">Titel der Veranstaltung</label>
                        <input type="text" name="title" required class="form-input" placeholder="z.B. Sommerfest">
                    </div>
                    
                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <label class="text-muted">Start Datum</label>
                            <input type="date" name="date" id="startDateInput" required class="form-input dark-date" onchange="document.getElementById('endDateInput').min = this.value">
                        </div>
                        <div>
                            <label class="text-muted">Ende Datum (Optional)</label>
                            <input type="date" name="endDate" id="endDateInput" class="form-input dark-date">
                        </div>
                    </div>

                    <div>
                        <label class="text-muted">Uhrzeit</label>
                        <div class="relative">
                            <input type="time" name="time" id="eventTimeInput" required class="form-input dark-date">
                            <div class="flex items-center mt-2">
                                <input type="checkbox" name="allDay" id="eventAllDay" class="w-4 h-4 rounded bg-dark-bg border-dark-border accent-blue-600" 
                                    onchange="const t = document.getElementById('eventTimeInput'); t.disabled = this.checked; if(this.checked) t.value = ''; else t.focus(); t.required = !this.checked;">
                                <label for="eventAllDay" class="ml-2 text-xs text-dark-muted cursor-pointer select-none">Ganztägig</label>
                            </div>
                        </div>
                    </div>
                    
                    <div>
                        <label class="text-muted">Ort / Treffpunkt</label>
                        <input type="text" name="location" class="form-input" placeholder="z.B. Vereinsheim">
                    </div>

                    <div>
                        <label class="text-muted">Kurzbeschreibung (für Vorschau)</label>
                        <input type="text" name="comment" class="form-input" placeholder="Z.B. 'Wichtig: Sportkleidung mitbringen'">
                    </div>
                    
                    <button type="submit" class="btn-primary w-full mt-2">Termin erstellen</button>
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
                <div class="flex justify-between items-center mb-6 border-b border-dark-border pb-4">
                    <h3 class="text-xl font-bold text-white">Termin bearbeiten</h3>
                    <button onclick="App.closeModal()" class="text-dark-muted hover:text-white p-2 transition-colors"><i class="fa-solid fa-times text-xl"></i></button>
                </div>
                
                <form onsubmit="CalendarView.handleUpdate(event, ${id})" class="space-y-5">
                    <div>
                        <label class="text-muted">Titel</label>
                        <input type="text" name="title" value="${e.title}" required class="form-input">
                    </div>
                    
                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <label class="text-muted">Start</label>
                            <input type="date" name="date" value="${e.date}" id="editStartDateInput" required class="form-input dark-date" onchange="document.getElementById('editEndDateInput').min = this.value">
                        </div>
                        <div>
                            <label class="text-muted">Ende</label>
                            <input type="date" name="endDate" value="${e.endDate || ''}" id="editEndDateInput" class="form-input dark-date">
                        </div>
                    </div>

                    <div>
                        <label class="text-muted">Uhrzeit</label>
                        <div class="relative">
                            <input type="time" name="time" value="${timeValue}" id="editEventTimeInput" ${timeDisabled} required class="form-input dark-date">
                            <div class="flex items-center mt-2">
                                <input type="checkbox" name="allDay" id="editEventAllDay" ${allDayChecked} class="w-4 h-4 rounded bg-dark-bg border-dark-border accent-blue-600" 
                                    onchange="const t = document.getElementById('editEventTimeInput'); t.disabled = this.checked; if(this.checked) t.value = ''; else t.focus(); t.required = !this.checked;">
                                <label for="editEventAllDay" class="ml-2 text-xs text-dark-muted cursor-pointer select-none">Ganztägig</label>
                            </div>
                        </div>
                    </div>
                    
                    <div>
                        <label class="text-muted">Ort</label>
                        <input type="text" name="location" value="${e.location || ''}" class="form-input">
                    </div>

                    <div>
                        <label class="text-muted">Kurzbeschreibung (Vorschau)</label>
                        <input type="text" name="comment" value="${e.comment || ''}" class="form-input">
                    </div>
                    
                    <button type="submit" class="btn-primary w-full mt-2">Änderungen speichern</button>
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
            id: Date.now(),
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
        this.render(document.getElementById('content'));
    },

    handleUpdate(e, id) {
        e.preventDefault();
        const fd = new FormData(e.target);
        const isAllDay = fd.get('allDay') === 'on';
        const startDate = fd.get('date');
        let endDate = fd.get('endDate');
        if (!endDate || new Date(endDate) < new Date(startDate)) endDate = startDate;

        const index = Store.state.events.findIndex(ev => ev.id === id);
        if (index !== -1) {
            Store.state.events[index] = {
                ...Store.state.events[index],
                title: fd.get('title'),
                date: startDate,
                endDate: endDate,
                time: isAllDay ? null : fd.get('time'),
                allDay: isAllDay,
                location: fd.get('location'),
                comment: fd.get('comment')
            };
            Store.save();
            App.closeModal();
            App.showToast('Stammdaten gespeichert');
            // Zurück zur Detail-Ansicht um Änderungen zu sehen
            this.openDetailModal(id);
        }
    },

    handleDescriptionUpdate(e, id) {
        e.preventDefault();
        const fd = new FormData(e.target);
        const index = Store.state.events.findIndex(ev => ev.id === id);
        if (index !== -1) {
            Store.state.events[index].description = fd.get('description');
            Store.save();
            App.showToast('Inhalt gespeichert');
            this.openDetailModal(id);
        }
    }
};