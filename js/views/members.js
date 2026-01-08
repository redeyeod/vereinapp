/**
 * =============================================================================
 * MEMBERS VIEW
 * Verwaltung der Vereinsmitglieder (Grid-Ansicht & Detail-Modals)
 * =============================================================================
 */

const MembersView = {
    standardRoles: [
        "1. Vorstand", "2. Vorstand", "3. Vorstand", "4. Vorstand",
        "Präsident", "Vize-Präsident",
        "Kassenwart", "Protokollant", "Ehren-Mitglied", "Beisitzer", "Mitglied"
    ],

    render(container) {
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

    updateList(filter = "") {
        const container = document.getElementById('membersListContainer');
        const emptyState = document.getElementById('noMembersFound');
        
        if(!container) return;

        const canManage = App.can('manage_members');
        const members = Store.state.members || [];

        const filtered = members.filter(m => {
            const searchStr = ((m.firstName || '') + ' ' + (m.lastName || '') + ' ' + (m.role || '')).toLowerCase();
            const groupStr = Array.isArray(m.groups) ? m.groups.join(' ') : '';
            return searchStr.includes(filter.toLowerCase()) || groupStr.toLowerCase().includes(filter.toLowerCase());
        });

        if (filtered.length === 0) {
            if(emptyState) emptyState.classList.remove('hidden');
            container.innerHTML = '';
        } else {
            if(emptyState) emptyState.classList.add('hidden');
            container.innerHTML = filtered.map(m => {
                let groupsText = 'Keine Gruppen';
                if (Array.isArray(m.groups) && m.groups.length > 0) groupsText = m.groups.join(', ');
                
                const isActive = m.status === 'active';
                const statusColor = isActive ? 'bg-green-500' : 'bg-red-500';

                return `
                <div onclick="MembersView.openDetailModal(${m.id})" class="bg-dark-card p-4 rounded-xl border border-dark-border flex items-center gap-4 hover:border-blue-500/50 transition-all cursor-pointer group shadow-sm relative overflow-hidden">
                    <div class="absolute right-3 top-3 w-2 h-2 ${statusColor} rounded-full shadow-sm"></div>

                    <div class="w-12 h-12 rounded-full bg-slate-800 text-slate-300 flex items-center justify-center text-sm font-bold border border-slate-700 flex-shrink-0">
                        ${(m.firstName || '?').charAt(0)}${(m.lastName || '?').charAt(0)}
                    </div>
                    
                    <div class="flex-1 min-w-0">
                        <h4 class="font-bold text-white truncate pr-4 text-base">${m.firstName || ''} ${m.lastName || ''}</h4>
                        <p class="text-xs text-blue-400 font-medium truncate mb-0.5">${m.role || 'Mitglied'}</p>
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
        const searchInput = document.getElementById('memberSearch');
        if(searchInput) this.updateList(searchInput.value); 
    },

    async delete(id) {
        if(!App.can('manage_members')) return;
        if(confirm("Möchten Sie dieses Mitglied wirklich löschen?")) { 
            await Store.remove('members', id); 
            App.showToast('Mitglied gelöscht'); 
            this.updateList();
        }
    },

    openDetailModal(id) {
        const m = Store.state.members.find(mem => mem.id === id);
        if(!m) return;

        const canManage = App.can('manage_members');

        let groupsHtml = '<span class="text-dark-muted text-xs italic">Keine Gruppen</span>';
        if (Array.isArray(m.groups) && m.groups.length > 0) {
            groupsHtml = m.groups.map(g => `<span class="bg-blue-900/30 text-blue-300 px-2 py-1 rounded-md text-xs border border-blue-500/30">${g}</span>`).join('');
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
                <div class="flex justify-between items-start mb-6 border-b border-dark-border pb-6">
                    <div class="flex items-center gap-4 min-w-0 flex-1 pr-2">
                        <div class="w-14 h-14 md:w-20 md:h-20 rounded-full bg-blue-600 flex items-center justify-center text-xl md:text-3xl font-bold text-white shadow-lg flex-shrink-0">
                            ${(m.firstName || '?').charAt(0)}${(m.lastName || '?').charAt(0)}
                        </div>
                        <div class="min-w-0">
                            <h2 class="text-lg md:text-3xl font-bold text-white leading-tight truncate pr-1">${m.firstName || ''} ${m.lastName || ''}</h2>
                            <p class="text-blue-400 font-medium text-xs md:text-lg mt-0.5 truncate">${m.role || 'Mitglied'}</p>
                        </div>
                    </div>
                    <button onclick="App.closeModal()" class="text-dark-muted hover:text-white p-2 transition-colors flex-shrink-0 bg-dark-bg/50 rounded-lg"><i class="fa-solid fa-times text-lg md:text-xl"></i></button>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
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
                    <div class="bg-dark-bg p-4 rounded-xl border border-dark-border h-fit">
                        <h4 class="text-xs font-bold text-dark-muted uppercase tracking-wider mb-3">Gruppen</h4>
                        <div class="flex flex-wrap gap-2">
                            ${groupsHtml}
                        </div>
                    </div>
                </div>
                ${footerHtml}
            </div>
        `;
        App.openModal(html);
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
            <div class="p-4 md:p-8">
                <div class="flex justify-between items-center mb-6 border-b border-dark-border pb-4 sticky top-0 bg-dark-card z-10">
                    <h3 class="text-lg md:text-xl font-bold text-white">Neues Mitglied</h3>
                    <button onclick="App.closeModal()" class="text-dark-muted hover:text-white p-2 transition-colors"><i class="fa-solid fa-times text-xl"></i></button>
                </div>
                <form onsubmit="MembersView.handleAdd(event)" class="space-y-5">
                    <div class="grid grid-cols-2 gap-4">
                        <div><label class="text-xs font-bold text-dark-muted uppercase mb-1 block">Vorname *</label><input type="text" name="firstName" required class="form-input" placeholder="Max"></div>
                        <div><label class="text-xs font-bold text-dark-muted uppercase mb-1 block">Nachname *</label><input type="text" name="lastName" required class="form-input" placeholder="Mustermann"></div>
                    </div>
                    <h4 class="text-xs font-bold text-white uppercase tracking-wider border-b border-dark-border pb-1 mt-6 mb-3">Adresse</h4>
                    <div class="grid grid-cols-3 gap-3">
                        <div class="col-span-2"><label class="text-xs font-bold text-dark-muted uppercase mb-1 block">Straße</label><input type="text" name="street" class="form-input"></div>
                        <div><label class="text-xs font-bold text-dark-muted uppercase mb-1 block">Nr.</label><input type="text" name="houseNumber" class="form-input"></div>
                    </div>
                    <div class="grid grid-cols-3 gap-3">
                        <div><label class="text-xs font-bold text-dark-muted uppercase mb-1 block">PLZ</label><input type="text" name="zip" class="form-input"></div>
                        <div class="col-span-2"><label class="text-xs font-bold text-dark-muted uppercase mb-1 block">Ort</label><input type="text" name="city" class="form-input"></div>
                    </div>
                    <h4 class="text-xs font-bold text-white uppercase tracking-wider border-b border-dark-border pb-1 mt-6 mb-3">Kontakt</h4>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div><label class="text-xs font-bold text-dark-muted uppercase mb-1 block">Email</label><input type="email" name="email" class="form-input" placeholder="Wichtig für Login"></div>
                        <div><label class="text-xs font-bold text-dark-muted uppercase mb-1 block">Telefon</label><input type="tel" name="phone" class="form-input"></div>
                    </div>
                    <div><label class="text-xs font-bold text-dark-muted uppercase mb-1 block">Geburtsdatum</label><input type="date" name="birthdate" class="form-input dark-date"></div>
                    <div class="mt-4">
                        <label class="text-xs font-bold text-dark-muted uppercase mb-1 block">Rolle *</label>
                        <select name="roleSelect" class="form-input cursor-pointer" onchange="document.getElementById('customRoleInput').classList.toggle('hidden', this.value !== 'custom'); if(this.value === 'custom') document.getElementById('customRoleInput').focus();">
                            ${roleOptions}<option value="" disabled>──────────</option><option value="custom">✎ Eigene...</option>
                        </select>
                        <input type="text" name="customRole" id="customRoleInput" class="form-input mt-2 hidden" placeholder="Bezeichnung der Rolle eingeben">
                    </div>
                    
                    <div class="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3 flex gap-3 items-start mt-4">
                        <i class="fa-solid fa-key text-blue-400 mt-0.5"></i>
                        <p class="text-xs text-blue-300">Ein sicheres Passwort wird automatisch generiert und im nächsten Schritt angezeigt.</p>
                    </div>

                    <button type="submit" class="btn-primary w-full mt-2">Mitglied anlegen</button>
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
                        <div><label class="text-xs font-bold text-dark-muted uppercase mb-1 block">Vorname</label><input type="text" name="firstName" value="${member.firstName || ''}" required class="form-input"></div>
                        <div><label class="text-xs font-bold text-dark-muted uppercase mb-1 block">Nachname</label><input type="text" name="lastName" value="${member.lastName || ''}" required class="form-input"></div>
                    </div>
                    <h4 class="text-xs font-bold text-white uppercase tracking-wider border-b border-dark-border pb-1 mt-6 mb-3">Adresse</h4>
                    <div class="grid grid-cols-3 gap-3">
                        <div class="col-span-2"><label class="text-xs font-bold text-dark-muted uppercase mb-1 block">Straße</label><input type="text" name="street" value="${member.street || ''}" class="form-input"></div>
                        <div><label class="text-xs font-bold text-dark-muted uppercase mb-1 block">Nr.</label><input type="text" name="houseNumber" value="${member.houseNumber || ''}" class="form-input"></div>
                    </div>
                    <div class="grid grid-cols-3 gap-3">
                        <div><label class="text-xs font-bold text-dark-muted uppercase mb-1 block">PLZ</label><input type="text" name="zip" value="${member.zip || ''}" class="form-input"></div>
                        <div class="col-span-2"><label class="text-xs font-bold text-dark-muted uppercase mb-1 block">Ort</label><input type="text" name="city" value="${member.city || ''}" class="form-input"></div>
                    </div>
                    <h4 class="text-xs font-bold text-white uppercase tracking-wider border-b border-dark-border pb-1 mt-6 mb-3">Kontakt</h4>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div><label class="text-xs font-bold text-dark-muted uppercase mb-1 block">Email</label><input type="email" name="email" value="${member.email || ''}" class="form-input"></div>
                        <div><label class="text-xs font-bold text-dark-muted uppercase mb-1 block">Telefon</label><input type="tel" name="phone" value="${member.phone || ''}" class="form-input"></div>
                    </div>
                    <div><label class="text-xs font-bold text-dark-muted uppercase mb-1 block">Geburtsdatum</label><input type="date" name="birthdate" value="${member.birthdate || ''}" class="form-input dark-date"></div>
                    <div class="mt-6">
                        <label class="text-xs font-bold text-dark-muted uppercase mb-1 block">Rolle</label>
                        <select name="roleSelect" class="form-input cursor-pointer" onchange="document.getElementById('editCustomRoleInput').classList.toggle('hidden', this.value !== 'custom'); if(this.value === 'custom') document.getElementById('editCustomRoleInput').focus();">
                            ${roleOptions}<option value="" disabled>──────────</option><option value="custom" ${roleSelectValue === 'custom' ? 'selected' : ''}>✎ Eigene...</option>
                        </select>
                        <input type="text" name="customRole" id="editCustomRoleInput" value="${customRoleValue}" class="form-input mt-2 ${customInputHidden}" placeholder="Rollenbezeichnung">
                    </div>
                    <div>
                        <label class="text-xs font-bold text-dark-muted uppercase mb-1 block">Status</label>
                        <select name="status" class="form-input cursor-pointer">
                            <option value="active" ${member.status === 'active' ? 'selected' : ''}>Aktiv</option>
                            <option value="inactive" ${member.status === 'inactive' ? 'selected' : ''}>Inaktiv</option>
                        </select>
                    </div>
                    <button type="submit" class="btn-primary w-full mt-4">Änderungen speichern</button>
                </form>
            </div>
        `;
        App.openModal(html);
        const modalContainer = document.getElementById('modal-content');
        if(modalContainer) modalContainer.classList.add('max-h-[90vh]', 'overflow-y-auto', 'custom-scrollbar');
    },

    generatePassword() {
        const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$";
        let pass = "";
        for (let i = 0; i < 12; i++) {
            pass += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return pass;
    },

    async handleAdd(e) {
        e.preventDefault(); 
        const fd = new FormData(e.target);
        let role = fd.get('roleSelect');
        if (role === 'custom') role = fd.get('customRole') || 'Mitglied';

        // Passwort generieren
        const generatedPassword = this.generatePassword();
        const email = fd.get('email');
        const firstName = fd.get('firstName');

        const newMember = { 
            firstName: firstName, 
            lastName: fd.get('lastName'),
            street: fd.get('street'),
            houseNumber: fd.get('houseNumber'),
            zip: fd.get('zip'),
            city: fd.get('city'),
            email: email,
            phone: fd.get('phone'),
            birthdate: fd.get('birthdate'),
            role: role, 
            status: 'active',
            groups: []
            // Hinweis: In einem echten Szenario würden wir das Passwort hier NICHT im Klartext speichern,
            // sondern über eine Edge Function den Auth-User anlegen. 
            // Für diese Simulation speichern wir es nicht, sondern zeigen es nur an.
        };
        
        await Store.add('members', newMember);
        
        // Modal zur Bestätigung & Email Simulation
        const mailSubject = encodeURIComponent("Willkommen im Verein!");
        const mailBody = encodeURIComponent(`Hallo ${firstName},\n\ndein Account wurde erfolgreich angelegt.\n\nDeine Zugangsdaten:\nE-Mail: ${email}\nPasswort: ${generatedPassword}\n\nBitte melde dich an und ändere dein Passwort.\n\nViele Grüße,\nDer Vorstand`);
        const mailtoLink = `mailto:${email}?subject=${mailSubject}&body=${mailBody}`;

        const successHtml = `
            <div class="p-8 text-center">
                <div class="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center text-green-500 text-3xl mx-auto mb-4 border border-green-500/20">
                    <i class="fa-solid fa-check"></i>
                </div>
                <h3 class="text-2xl font-bold text-white mb-2">Mitglied angelegt!</h3>
                <p class="text-dark-muted text-sm mb-6">Das Profil wurde erfolgreich gespeichert.</p>
                
                <div class="bg-dark-bg border border-dark-border rounded-xl p-4 mb-6 text-left relative group">
                    <p class="text-xs text-dark-muted uppercase font-bold mb-1">Generiertes Passwort</p>
                    <div class="flex justify-between items-center">
                        <code class="text-blue-400 font-mono text-lg select-all">${generatedPassword}</code>
                        <button onclick="navigator.clipboard.writeText('${generatedPassword}'); App.showToast('Passwort kopiert')" class="text-dark-muted hover:text-white p-2" title="Kopieren">
                            <i class="fa-regular fa-copy"></i>
                        </button>
                    </div>
                    <p class="text-[10px] text-red-400 mt-2"><i class="fa-solid fa-triangle-exclamation mr-1"></i> Bitte sofort notieren oder versenden!</p>
                </div>

                <div class="flex gap-3">
                    <button onclick="App.closeModal()" class="flex-1 py-3 rounded-xl border border-dark-border text-dark-muted hover:text-white transition-colors">
                        Schließen
                    </button>
                    <a href="${mailtoLink}" target="_blank" class="flex-1 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold transition-colors shadow-lg shadow-blue-900/20 flex items-center justify-center gap-2">
                        <i class="fa-solid fa-envelope"></i> E-Mail senden
                    </a>
                </div>
            </div>
        `;
        
        App.openModal(successHtml);
        this.updateList();
    },

    async handleUpdate(e, id) {
        e.preventDefault();
        const fd = new FormData(e.target);
        let role = fd.get('roleSelect');
        if (role === 'custom') role = fd.get('customRole') || 'Mitglied';

        const member = Store.state.members.find(m => m.id === id);
        if (member) {
            const updated = {
                ...member,
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
            await Store.update('members', updated);
            App.closeModal();
            this.updateList();
        }
    }
};

// WICHTIG: Global verfügbar machen für die neue App.js
window.MembersView = MembersView;
