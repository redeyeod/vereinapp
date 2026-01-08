/**
 * =============================================================================
 * MEMBERS VIEW
 * Verwaltung der Mitgliederliste (Anzeigen, Suchen, Hinzufügen, Löschen, Bearbeiten)
 * =============================================================================
 */

const MembersView = {
    // Definierte Standard-Rollen für den Verein
    standardRoles: [
        "1. Vorstand", "2. Vorstand", "3. Vorstand", "4. Vorstand",
        "Präsident", "Vize-Präsident",
        "Kassenwart", "Protokollant", "Ehren-Mitglied", "Beisitzer", "Mitglied"
    ],

    /**
     * Rendert die Grundstruktur der Mitglieder-Ansicht
     * @param {HTMLElement} container 
     */
    render(container) {
        // Berechtigungs-Check für den "Hinzufügen"-Button
        const canManage = App.can('manage_members');
        const addButtonHtml = canManage 
            ? `<button onclick="MembersView.openAddModal()" class="bg-blue-600 hover:bg-blue-700 text-white w-10 h-10 md:w-auto md:px-4 md:py-2 rounded-lg text-sm font-bold flex-shrink-0 flex items-center justify-center transition-all shadow-lg shadow-blue-900/30">
                 <i class="fa-solid fa-plus md:mr-2"></i> <span class="hidden md:inline">Mitglied</span>
               </button>`
            : '';

        container.innerHTML = `
            <div class="flex flex-col gap-4 fade-in h-full">
                <!-- Toolbar -->
                <div class="flex items-center gap-3 bg-dark-card p-2 rounded-xl border border-dark-border sticky top-0 z-10 shadow-sm">
                    <div class="relative flex-1">
                        <i class="fa-solid fa-search absolute left-3 top-1/2 -translate-y-1/2 text-dark-muted text-sm"></i>
                        <input type="text" id="memberSearch" onkeyup="MembersView.filter()" placeholder="Suchen..." 
                            class="w-full bg-dark-bg border-none rounded-lg pl-9 pr-4 py-2 text-white focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm placeholder-dark-muted transition-shadow">
                    </div>
                    ${addButtonHtml}
                </div>

                <!-- Mitglieder Liste (Grid) -->
                <div id="membersListContainer" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pb-4">
                    <!-- Wird durch updateList() gefüllt -->
                </div>
                
                <!-- Leerer Zustand -->
                <div id="noMembersFound" class="hidden py-12 text-center text-dark-muted flex flex-col items-center justify-center">
                    <div class="w-16 h-16 bg-dark-bg rounded-full flex items-center justify-center mb-4 text-2xl opacity-50 border border-dark-border">
                        <i class="fa-solid fa-user-slash"></i>
                    </div>
                    <p class="text-sm">Keine Mitglieder gefunden.</p>
                </div>
            </div>
        `;
        
        this.updateList();
    },

    /**
     * Aktualisiert die Liste basierend auf dem Suchfilter
     */
    updateList(filter = "") {
        const container = document.getElementById('membersListContainer');
        const emptyState = document.getElementById('noMembersFound');
        
        if(!container) return;

        const canManage = App.can('manage_members');

        const filtered = Store.state.members.filter(m => {
            const searchStr = (m.firstName + ' ' + m.lastName + ' ' + m.role).toLowerCase();
            const groupStr = Array.isArray(m.groups) ? m.groups.join(' ') : (m.group || '');
            return searchStr.includes(filter.toLowerCase()) || groupStr.toLowerCase().includes(filter.toLowerCase());
        });

        if (filtered.length === 0) {
            emptyState.classList.remove('hidden');
            container.innerHTML = '';
        } else {
            emptyState.classList.add('hidden');
            container.innerHTML = filtered.map(m => {
                // Gruppen Text
                let groupsText = 'Keine Gruppen';
                if (Array.isArray(m.groups) && m.groups.length > 0) groupsText = m.groups.join(', ');
                else if (m.group && m.group !== "Keine") groupsText = m.group;

                // Status Indikator
                const isActive = m.status === 'active';
                const statusColor = isActive ? 'bg-green-500' : 'bg-red-500';

                return `
                <div onclick="MembersView.openDetailModal(${m.id})" class="bg-dark-card p-4 rounded-xl border border-dark-border flex items-center gap-4 hover:border-blue-500/50 transition-all cursor-pointer group shadow-sm relative overflow-hidden">
                    <!-- Status Dot -->
                    <div class="absolute right-3 top-3 w-2 h-2 ${statusColor} rounded-full shadow-sm"></div>

                    <div class="w-12 h-12 rounded-full bg-slate-800 text-slate-300 flex items-center justify-center text-sm font-bold border border-slate-700 flex-shrink-0">
                        ${m.firstName.charAt(0)}${m.lastName.charAt(0)}
                    </div>
                    
                    <div class="flex-1 min-w-0">
                        <h4 class="font-bold text-white truncate pr-4 text-base">${m.firstName} ${m.lastName}</h4>
                        <p class="text-xs text-blue-400 font-medium truncate mb-0.5">${m.role}</p>
                        <p class="text-[10px] text-dark-muted truncate flex items-center">
                            <i class="fa-solid fa-users mr-1.5 opacity-70"></i> ${groupsText}
                        </p>
                    </div>

                    ${canManage ? `
                        <button onclick="event.stopPropagation(); MembersView.openEditModal(${m.id})" class="w-8 h-8 rounded-lg bg-dark-bg text-dark-muted hover:text-blue-400 border border-transparent hover:border-dark-border flex items-center justify-center transition-colors">
                            <i class="fa-solid fa-pen text-xs"></i>
                        </button>
                    ` : '<i class="fa-solid fa-chevron-right text-dark-muted text-xs opacity-50"></i>'}
                </div>`;
            }).join('');
        }
    },

    filter() { 
        const val = document.getElementById('memberSearch').value;
        this.updateList(val); 
    },

    delete(id) {
        if(!App.can('manage_members')) return;
        if(confirm("Möchtest du dieses Mitglied wirklich löschen?")) { 
            Store.remove('members', id); 
            this.updateList(document.getElementById('memberSearch') ? document.getElementById('memberSearch').value : "");
            App.showToast('Mitglied gelöscht'); 
        }
    },

    openDetailModal(id) {
        const m = Store.state.members.find(mem => mem.id === id);
        if(!m) return;

        const canManage = App.can('manage_members');

        let groupsHtml = '<span class="text-dark-muted text-xs italic">Keine Gruppen</span>';
        if (Array.isArray(m.groups) && m.groups.length > 0) {
            groupsHtml = m.groups.map(g => `<span class="bg-blue-900/30 text-blue-300 px-2 py-1 rounded-md text-xs border border-blue-500/30">${g}</span>`).join('');
        } else if (m.group && m.group !== "Keine") {
            groupsHtml = `<span class="bg-blue-900/30 text-blue-300 px-2 py-1 rounded-md text-xs border border-blue-500/30">${m.group}</span>`;
        }

        const hasAddress = m.street || m.city;
        const addressHtml = hasAddress 
            ? `<p class="text-white text-sm leading-relaxed">${m.street || ''} ${m.houseNumber || ''}<br>${m.zip || ''} ${m.city || ''}</p>`
            : `<p class="text-dark-muted italic text-xs">Keine Adresse hinterlegt</p>`;

        const contactHtml = `
            ${m.email ? `<div class="flex items-center gap-3 mb-2 text-sm"><i class="fa-solid fa-envelope text-dark-muted w-4 flex-shrink-0"></i> <a href="mailto:${m.email}" class="text-blue-400 hover:underline truncate">${m.email}</a></div>` : ''}
            ${m.phone ? `<div class="flex items-center gap-3 mb-2 text-sm"><i class="fa-solid fa-phone text-dark-muted w-4 flex-shrink-0"></i> <span class="text-white">${m.phone}</span></div>` : ''}
            ${m.birthdate ? `<div class="flex items-center gap-3 text-sm"><i class="fa-solid fa-cake-candles text-dark-muted w-4 flex-shrink-0"></i> <span class="text-white">${new Date(m.birthdate).toLocaleDateString('de-DE')}</span></div>` : ''}
            ${!m.email && !m.phone && !m.birthdate ? '<p class="text-dark-muted italic text-xs">Keine Kontaktdaten</p>' : ''}
        `;

        const footerHtml = canManage ? `
            <div class="flex gap-3 pt-4 border-t border-dark-border mt-6">
                <button onclick="MembersView.openEditModal(${m.id})" class="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-bold transition-colors shadow-lg shadow-blue-900/20 text-sm">
                    Bearbeiten
                </button>
                <button onclick="MembersView.delete(${m.id}); App.closeModal()" class="bg-dark-bg hover:bg-red-900/20 text-red-400 border border-dark-border hover:border-red-500/30 px-4 py-3 rounded-xl font-bold transition-colors text-sm" title="Löschen">
                    <i class="fa-regular fa-trash-can"></i>
                </button>
            </div>
        ` : '';

        const html = `
            <div class="p-4 md:p-8">
                <!-- Header mit Avatar und Name (Optimiert für Mobile) -->
                <div class="flex justify-between items-start mb-6 border-b border-dark-border pb-6">
                    <div class="flex items-center gap-4 min-w-0 flex-1 pr-2">
                        <div class="w-14 h-14 md:w-20 md:h-20 rounded-full bg-blue-600 flex items-center justify-center text-xl md:text-3xl font-bold text-white shadow-lg flex-shrink-0">
                            ${m.firstName.charAt(0)}${m.lastName.charAt(0)}
                        </div>
                        <div class="min-w-0">
                            <h2 class="text-lg md:text-3xl font-bold text-white leading-tight truncate pr-1">${m.firstName} ${m.lastName}</h2>
                            <p class="text-blue-400 font-medium text-xs md:text-lg mt-0.5 truncate">${m.role}</p>
                            <span class="inline-flex items-center mt-1.5 px-2 py-0.5 text-[10px] rounded-full border ${m.status === 'active' ? 'bg-green-500/10 text-green-400 border-green-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'}">
                                ${m.status === 'active' ? '● Aktiv' : '○ Inaktiv'}
                            </span>
                        </div>
                    </div>
                    <button onclick="App.closeModal()" class="text-dark-muted hover:text-white p-2 transition-colors flex-shrink-0 bg-dark-bg/50 rounded-lg"><i class="fa-solid fa-times text-lg md:text-xl"></i></button>
                </div>

                <!-- Info Grid -->
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                    <!-- Kontakt & Adresse -->
                    <div class="space-y-4">
                        <div class="bg-dark-bg p-4 rounded-xl border border-dark-border">
                            <h4 class="text-xs font-bold text-dark-muted uppercase tracking-wider mb-3">Kontakt</h4>
                            ${contactHtml}
                        </div>
                        <div class="bg-dark-bg p-4 rounded-xl border border-dark-border">
                            <h4 class="text-xs font-bold text-dark-muted uppercase tracking-wider mb-3">Anschrift</h4>
                            ${addressHtml}
                        </div>
                    </div>

                    <!-- Gruppen -->
                    <div class="bg-dark-bg p-4 rounded-xl border border-dark-border h-fit">
                        <h4 class="text-xs font-bold text-dark-muted uppercase tracking-wider mb-3">Gruppen</h4>
                        <div class="flex flex-wrap gap-2">
                            ${groupsHtml}
                        </div>
                        ${canManage ? `<p class="text-[10px] text-dark-muted mt-3 pt-3 border-t border-dark-border/50">Gruppenzuordnungen können im Bereich "Abteilungen" verwaltet werden.</p>` : ''}
                    </div>
                </div>

                ${footerHtml}
            </div>
        `;
        
        App.openModal(html);
        
        // Modal breiter machen für Detailansicht
        const modalContainer = document.getElementById('modal-content');
        if(modalContainer) {
            modalContainer.classList.remove('max-w-md');
            modalContainer.classList.add('max-w-4xl', 'w-full', 'max-h-[90vh]', 'overflow-y-auto', 'custom-scrollbar');
        }
    },

    openAddModal() {
        if(!App.can('manage_members')) return;
        const roleOptions = this.standardRoles.map(r => `<option value="${r}">${r}</option>`).join('');

        const html = `
            <div class="p-4 md:p-8 max-h-[85vh] overflow-y-auto custom-scrollbar">
                <div class="flex justify-between items-center mb-6 border-b border-dark-border pb-4 sticky top-0 bg-dark-card z-10">
                    <h3 class="text-lg md:text-xl font-bold text-white">Neues Mitglied</h3>
                    <button onclick="App.closeModal()" class="text-dark-muted hover:text-white p-2 transition-colors"><i class="fa-solid fa-times text-xl"></i></button>
                </div>
                
                <form onsubmit="MembersView.handleAdd(event)" class="space-y-5">
                    <div class="grid grid-cols-2 gap-4">
                        <div><label class="text-muted">Vorname *</label><input type="text" name="firstName" required class="form-input" placeholder="Max"></div>
                        <div><label class="text-muted">Nachname *</label><input type="text" name="lastName" required class="form-input" placeholder="Mustermann"></div>
                    </div>

                    <h4 class="text-xs font-bold text-white uppercase tracking-wider border-b border-dark-border pb-1 mt-6 mb-3">Adresse</h4>
                    <div class="grid grid-cols-3 gap-3">
                        <div class="col-span-2"><label class="text-muted">Straße</label><input type="text" name="street" class="form-input"></div>
                        <div><label class="text-muted">Nr.</label><input type="text" name="houseNumber" class="form-input"></div>
                    </div>
                    <div class="grid grid-cols-3 gap-3">
                        <div><label class="text-muted">PLZ</label><input type="text" name="zip" class="form-input"></div>
                        <div class="col-span-2"><label class="text-muted">Ort</label><input type="text" name="city" class="form-input"></div>
                    </div>

                    <h4 class="text-xs font-bold text-white uppercase tracking-wider border-b border-dark-border pb-1 mt-6 mb-3">Kontakt</h4>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div><label class="text-muted">Email</label><input type="email" name="email" class="form-input"></div>
                        <div><label class="text-muted">Telefon</label><input type="tel" name="phone" class="form-input"></div>
                    </div>
                    <div><label class="text-muted">Geburtsdatum</label><input type="date" name="birthdate" class="form-input dark-date"></div>
                    
                    <div class="mt-4">
                        <label class="text-muted">Rolle *</label>
                        <select name="roleSelect" class="form-input cursor-pointer" onchange="document.getElementById('customRoleInput').classList.toggle('hidden', this.value !== 'custom'); if(this.value === 'custom') document.getElementById('customRoleInput').focus();">
                            ${roleOptions}<option value="" disabled>──────────</option><option value="custom">✎ Eigene...</option>
                        </select>
                        <input type="text" name="customRole" id="customRoleInput" class="form-input mt-2 hidden" placeholder="Bezeichnung der Rolle eingeben">
                    </div>

                    <div class="p-3 bg-dark-bg rounded-lg border border-dark-border text-xs text-dark-muted mt-4">
                        <i class="fa-solid fa-info-circle mr-1 text-blue-400"></i> Gruppen werden später zugewiesen.
                    </div>
                    
                    <button type="submit" class="btn-primary w-full mt-2">Speichern</button>
                </form>
            </div>
        `;
        App.openModal(html);
        const modalContainer = document.getElementById('modal-content');
        if(modalContainer) modalContainer.classList.add('max-h-[90vh]', 'overflow-y-auto', 'custom-scrollbar');
    },

    openEditModal(id) {
        if(!App.can('manage_members')) return;
        const member = Store.state.members.find(m => m.id === id);
        if (!member) return;

        const isStandardRole = this.standardRoles.includes(member.role);
        const roleSelectValue = isStandardRole ? member.role : 'custom';
        const customRoleValue = isStandardRole ? '' : member.role;
        const customInputHidden = isStandardRole ? 'hidden' : '';

        const roleOptions = this.standardRoles.map(r => `<option value="${r}" ${member.role === r ? 'selected' : ''}>${r}</option>`).join('');

        const html = `
            <div class="p-4 md:p-8 max-h-[85vh] overflow-y-auto custom-scrollbar">
                <div class="flex justify-between items-center mb-6 border-b border-dark-border pb-4 sticky top-0 bg-dark-card z-10">
                    <h3 class="text-lg md:text-xl font-bold text-white">Mitglied bearbeiten</h3>
                    <button onclick="App.closeModal()" class="text-dark-muted hover:text-white p-2 transition-colors"><i class="fa-solid fa-times text-xl"></i></button>
                </div>
                
                <form onsubmit="MembersView.handleUpdate(event, ${id})" class="space-y-5">
                    <div class="grid grid-cols-2 gap-4">
                        <div><label class="text-muted">Vorname</label><input type="text" name="firstName" value="${member.firstName || ''}" required class="form-input"></div>
                        <div><label class="text-muted">Nachname</label><input type="text" name="lastName" value="${member.lastName || ''}" required class="form-input"></div>
                    </div>

                    <h4 class="text-xs font-bold text-white uppercase tracking-wider border-b border-dark-border pb-1 mt-6 mb-3">Adresse</h4>
                    <div class="grid grid-cols-3 gap-3">
                        <div class="col-span-2"><label class="text-muted">Straße</label><input type="text" name="street" value="${member.street || ''}" class="form-input"></div>
                        <div><label class="text-muted">Nr.</label><input type="text" name="houseNumber" value="${member.houseNumber || ''}" class="form-input"></div>
                    </div>
                    <div class="grid grid-cols-3 gap-3">
                        <div><label class="text-muted">PLZ</label><input type="text" name="zip" value="${member.zip || ''}" class="form-input"></div>
                        <div class="col-span-2"><label class="text-muted">Ort</label><input type="text" name="city" value="${member.city || ''}" class="form-input"></div>
                    </div>

                    <h4 class="text-xs font-bold text-white uppercase tracking-wider border-b border-dark-border pb-1 mt-6 mb-3">Kontakt</h4>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div><label class="text-muted">Email</label><input type="email" name="email" value="${member.email || ''}" class="form-input"></div>
                        <div><label class="text-muted">Telefon</label><input type="tel" name="phone" value="${member.phone || ''}" class="form-input"></div>
                    </div>
                    <div><label class="text-muted">Geburtsdatum</label><input type="date" name="birthdate" value="${member.birthdate || ''}" class="form-input dark-date"></div>
                    
                    <div class="mt-6">
                        <label class="text-muted">Rolle</label>
                        <select name="roleSelect" class="form-input cursor-pointer" onchange="document.getElementById('editCustomRoleInput').classList.toggle('hidden', this.value !== 'custom'); if(this.value === 'custom') document.getElementById('editCustomRoleInput').focus();">
                            ${roleOptions}<option value="" disabled>──────────</option><option value="custom" ${roleSelectValue === 'custom' ? 'selected' : ''}>✎ Eigene...</option>
                        </select>
                        <input type="text" name="customRole" id="editCustomRoleInput" value="${customRoleValue}" class="form-input mt-2 ${customInputHidden}" placeholder="Bezeichnung der Rolle eingeben">
                    </div>

                    <div>
                        <label class="text-muted">Status</label>
                        <select name="status" class="form-input cursor-pointer">
                            <option value="active" ${member.status === 'active' ? 'selected' : ''}>Aktiv</option>
                            <option value="inactive" ${member.status === 'inactive' ? 'selected' : ''}>Inaktiv</option>
                        </select>
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
        let role = fd.get('roleSelect');
        if (role === 'custom') role = fd.get('customRole') || 'Mitglied';

        const newMember = { 
            id: Date.now(), 
            firstName: fd.get('firstName'), 
            lastName: fd.get('lastName'),
            street: fd.get('street'),
            houseNumber: fd.get('houseNumber'),
            zip: fd.get('zip'),
            city: fd.get('city'),
            email: fd.get('email'),
            phone: fd.get('phone'),
            birthdate: fd.get('birthdate'),
            role: role, 
            status: 'active',
            groups: [],
            group: 'Keine'
        };
        
        Store.add('members', newMember);
        App.closeModal(); 
        App.showToast('Mitglied erstellt'); 
        this.updateList();
    },

    handleUpdate(e, id) {
        e.preventDefault();
        const fd = new FormData(e.target);
        let role = fd.get('roleSelect');
        if (role === 'custom') role = fd.get('customRole') || 'Mitglied';

        const index = Store.state.members.findIndex(m => m.id === id);
        if (index !== -1) {
            Store.state.members[index] = {
                ...Store.state.members[index],
                firstName: fd.get('firstName'),
                lastName: fd.get('lastName'),
                street: fd.get('street'),
                houseNumber: fd.get('houseNumber'),
                zip: fd.get('zip'),
                city: fd.get('city'),
                email: fd.get('email'),
                phone: fd.get('phone'),
                birthdate: fd.get('birthdate'),
                role: role,
                status: fd.get('status')
            };
            Store.save();
            App.closeModal();
            App.showToast('Aktualisiert');
            this.updateList();
        }
    }
};