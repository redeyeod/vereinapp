/**
 * =============================================================================
 * MEMBERS VIEW (Multi-Role Update)
 * Erlaubt nun die Zuweisung mehrerer Rollen per Checkbox.
 * =============================================================================
 */

const MembersView = {
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
                    <button onclick="MembersView.refreshData()" class="bg-dark-bg hover:bg-dark-hover border border-dark-border text-dark-muted hover:text-white w-10 h-10 rounded-lg flex items-center justify-center transition-colors" title="Neu laden">
                        <i class="fa-solid fa-rotate-right"></i>
                    </button>
                    ${addButtonHtml}
                </div>

                <div id="membersListContainer" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pb-4"></div>
                
                <div id="noMembersFound" class="hidden py-12 text-center text-dark-muted flex flex-col items-center justify-center">
                    <div class="w-16 h-16 bg-dark-bg rounded-full flex items-center justify-center mb-4 text-2xl opacity-50 border border-dark-border">
                        <i class="fa-solid fa-user-slash"></i>
                    </div>
                    <p class="text-sm font-bold">Keine Mitglieder gefunden.</p>
                </div>
            </div>
        `;
        
        this.updateList();
    },

    async refreshData() {
        const icon = document.querySelector('button[title="Neu laden"] i');
        if(icon) icon.classList.add('animate-spin');
        
        if (typeof Store !== 'undefined' && Store.fetchTable) {
            await Store.fetchTable('members');
            await Store.fetchTable('roles');
        }
        this.updateList();
        
        if(icon) icon.classList.remove('animate-spin');
        App.showToast("Liste aktualisiert");
    },

    // Helfer um Rollen als String anzuzeigen
    getRolesString(member) {
        if (Array.isArray(member.roles) && member.roles.length > 0) {
            return member.roles.join(', ');
        }
        return member.role || 'Mitglied'; // Fallback für alte Daten
    },

    updateList(filter = "") {
        const container = document.getElementById('membersListContainer');
        const emptyState = document.getElementById('noMembersFound');
        if(!container) return;

        const canManage = App.can('manage_members');
        const members = (Store.state && Store.state.members) ? Store.state.members : [];

        const filtered = members.filter(m => {
            const roleStr = this.getRolesString(m);
            const searchStr = ((m.firstName || '') + ' ' + (m.lastName || '') + ' ' + roleStr).toLowerCase();
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
                
                const roleDisplay = this.getRolesString(m);
                const isActive = m.status === 'active';
                const statusColor = isActive ? 'bg-green-500' : 'bg-red-500';

                return `
                <div onclick="MembersView.openDetailModal('${m.id}')" class="bg-dark-card p-4 rounded-xl border border-dark-border flex items-center gap-4 hover:border-blue-500/50 transition-all cursor-pointer group shadow-sm relative overflow-hidden">
                    <div class="absolute right-3 top-3 w-2 h-2 ${statusColor} rounded-full shadow-sm"></div>
                    <div class="w-12 h-12 rounded-full bg-slate-800 text-slate-300 flex items-center justify-center text-sm font-bold border border-slate-700 flex-shrink-0">
                        ${(m.firstName || '?').charAt(0)}${(m.lastName || '?').charAt(0)}
                    </div>
                    <div class="flex-1 min-w-0">
                        <h4 class="font-bold text-white truncate pr-4 text-base">${m.firstName || ''} ${m.lastName || ''}</h4>
                        <p class="text-xs text-blue-400 font-medium truncate mb-0.5">${roleDisplay}</p>
                        <p class="text-[10px] text-dark-muted truncate flex items-center">
                            <i class="fa-solid fa-users mr-1.5 opacity-70"></i> ${groupsText}
                        </p>
                    </div>
                    ${canManage ? `
                        <button onclick="event.stopPropagation(); MembersView.openEditModal('${m.id}')" class="w-8 h-8 rounded-lg bg-dark-bg text-dark-muted hover:text-blue-400 border border-transparent hover:border-dark-border flex items-center justify-center transition-colors">
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
        if(confirm("Mitglied wirklich löschen?")) { 
            await Store.remove('members', id); 
            await this.refreshData();
        }
    },

    openDetailModal(id) {
        const m = Store.state.members.find(mem => mem.id == id);
        if(!m) return;
        
        const canManage = App.can('manage_members');
        let groupsHtml = '<span class="text-dark-muted text-xs italic">Keine Gruppen</span>';
        if (Array.isArray(m.groups) && m.groups.length > 0) {
            groupsHtml = m.groups.map(g => `<span class="bg-blue-900/30 text-blue-300 px-2 py-1 rounded-md text-xs border border-blue-500/30">${g}</span>`).join('');
        }

        const roleDisplay = this.getRolesString(m);

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
            <div class="mt-6 pt-4 border-t border-dark-border flex gap-3">
                <button onclick="MembersView.openEditModal('${m.id}')" class="btn-primary flex-1">Bearbeiten</button>
                <button onclick="MembersView.delete('${m.id}'); App.closeModal()" class="flex-1 py-3 bg-dark-bg border border-dark-border rounded-xl text-red-400 font-bold hover:bg-red-900/20">Löschen</button>
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
                            <p class="text-blue-400 font-medium text-xs md:text-lg mt-0.5 truncate">${roleDisplay}</p>
                        </div>
                    </div>
                    <button onclick="App.closeModal()" class="text-dark-muted hover:text-white p-2 transition-colors flex-shrink-0 bg-dark-bg/50 rounded-lg"><i class="fa-solid fa-times text-lg md:text-xl"></i></button>
                </div>
                <div class="space-y-4">
                    <div class="bg-dark-bg p-4 rounded-xl border border-dark-border">
                        <h4 class="text-xs font-bold text-dark-muted uppercase tracking-wider mb-3">Kontakt</h4>
                        ${contactHtml}
                    </div>
                    <div class="bg-dark-bg p-4 rounded-xl border border-dark-border">
                        <h4 class="text-xs font-bold text-dark-muted uppercase tracking-wider mb-3">Anschrift</h4>
                        ${addressHtml}
                    </div>
                    <div class="bg-dark-bg p-4 rounded-xl border border-dark-border h-fit">
                        <h4 class="text-xs font-bold text-dark-muted uppercase tracking-wider mb-3">Gruppen</h4>
                        <div class="flex flex-wrap gap-2">${groupsHtml}</div>
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

    openEditModal(id) {
        const m = Store.state.members.find(mem => mem.id == id);
        if(!m) return;
        this.openAddModal(m);
    },

    generatePassword() {
        const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$";
        let pass = "";
        for (let i = 0; i < 12; i++) pass += chars.charAt(Math.floor(Math.random() * chars.length));
        return pass;
    },

    openAddModal(editModeData = null) {
        if(!App.can('manage_members')) { App.showToast("Keine Berechtigung", "error"); return; }
        
        const isEdit = !!editModeData;
        const data = editModeData || {};
        const title = isEdit ? "Mitglied bearbeiten" : "Neues Mitglied";
        const btnText = isEdit ? "Speichern" : "Mitglied anlegen";
        const handler = isEdit ? `MembersView.handleUpdate(event, '${data.id}')` : "MembersView.handleAdd(event)";
        
        // --- ROLLEN CHECKBOX LOGIK (NEU) ---
        const dbRoles = (Store.state.roles && Store.state.roles.length > 0) ? Store.state.roles : [{name: 'Mitglied'}];
        
        // Aktuelle Rollen des Users ermitteln
        let currentRoles = [];
        if (Array.isArray(data.roles)) currentRoles = data.roles;
        else if (data.role) currentRoles = [data.role]; // Fallback
        
        const roleCheckboxes = dbRoles.map(r => {
            const isChecked = currentRoles.includes(r.name) ? 'checked' : '';
            return `
                <label class="flex items-center gap-3 p-3 bg-dark-bg/50 hover:bg-dark-bg rounded-lg cursor-pointer border border-transparent hover:border-blue-500/30 transition-all">
                    <input type="checkbox" name="roles" value="${r.name}" ${isChecked} class="w-4 h-4 rounded border-dark-border bg-slate-800 text-blue-600 focus:ring-blue-500">
                    <span class="text-sm font-medium text-white">${r.name}</span>
                </label>
            `;
        }).join('');

        const html = `
            <div class="p-4 md:p-8 max-h-[85vh] overflow-y-auto custom-scrollbar">
                <div class="flex justify-between items-center mb-6 border-b border-dark-border pb-4 sticky top-0 bg-dark-card z-10">
                    <h3 class="text-lg md:text-xl font-bold text-white">${title}</h3>
                    <button onclick="App.closeModal()" class="text-dark-muted hover:text-white p-2 transition-colors"><i class="fa-solid fa-times text-xl"></i></button>
                </div>
                <form onsubmit="${handler}" class="space-y-5">
                    <!-- Names -->
                    <div class="grid grid-cols-2 gap-4">
                        <div><label class="text-xs font-bold text-dark-muted uppercase mb-1 block">Vorname *</label><input type="text" name="firstName" value="${data.firstName||''}" required class="form-input" placeholder="Max"></div>
                        <div><label class="text-xs font-bold text-dark-muted uppercase mb-1 block">Nachname *</label><input type="text" name="lastName" value="${data.lastName||''}" required class="form-input" placeholder="Mustermann"></div>
                    </div>
                    
                    <!-- Address -->
                    <h4 class="text-xs font-bold text-white uppercase tracking-wider border-b border-dark-border pb-1 mt-6 mb-3">Adresse</h4>
                    <div class="grid grid-cols-3 gap-3">
                        <div class="col-span-2"><label class="text-xs font-bold text-dark-muted uppercase mb-1 block">Straße</label><input type="text" name="street" value="${data.street||''}" class="form-input"></div>
                        <div><label class="text-xs font-bold text-dark-muted uppercase mb-1 block">Nr.</label><input type="text" name="houseNumber" value="${data.houseNumber||''}" class="form-input"></div>
                    </div>
                    <div class="grid grid-cols-3 gap-3">
                        <div><label class="text-xs font-bold text-dark-muted uppercase mb-1 block">PLZ</label><input type="text" name="zip" value="${data.zip||''}" class="form-input"></div>
                        <div class="col-span-2"><label class="text-xs font-bold text-dark-muted uppercase mb-1 block">Ort</label><input type="text" name="city" value="${data.city||''}" class="form-input"></div>
                    </div>

                    <!-- Contact -->
                    <h4 class="text-xs font-bold text-white uppercase tracking-wider border-b border-dark-border pb-1 mt-6 mb-3">Kontakt</h4>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div><label class="text-xs font-bold text-dark-muted uppercase mb-1 block">Email (Login) *</label><input type="email" name="email" value="${data.email||''}" required class="form-input"></div>
                        <div><label class="text-xs font-bold text-dark-muted uppercase mb-1 block">Telefon</label><input type="tel" name="phone" value="${data.phone||''}" class="form-input"></div>
                    </div>
                    <div><label class="text-xs font-bold text-dark-muted uppercase mb-1 block">Geburtsdatum</label><input type="date" name="birthdate" value="${data.birthdate||''}" class="form-input dark-date"></div>

                    <!-- Role & Status -->
                    <div class="mt-6">
                        <label class="text-xs font-bold text-dark-muted uppercase mb-2 block">Rollen (Rechte)</label>
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-40 overflow-y-auto custom-scrollbar bg-dark-bg/20 p-2 rounded-lg border border-dark-border">
                            ${roleCheckboxes}
                        </div>
                        <p class="text-[10px] text-dark-muted mt-2">Du kannst einem Mitglied mehrere Rollen zuteilen.</p>
                    </div>
                    
                    ${isEdit ? `
                    <div class="mt-4">
                        <label class="text-xs font-bold text-dark-muted uppercase mb-1 block">Status</label>
                        <select name="status" class="form-input cursor-pointer">
                            <option value="active" ${data.status === 'active' ? 'selected' : ''}>Aktiv</option>
                            <option value="inactive" ${data.status === 'inactive' ? 'selected' : ''}>Inaktiv</option>
                        </select>
                    </div>` : ''}
                    
                    ${!isEdit ? `<div class="bg-blue-500/10 p-3 rounded-lg text-xs text-blue-300 border border-blue-500/20 flex gap-2 items-start mt-4"><i class="fa-solid fa-key mt-0.5"></i> Ein sicheres Passwort wird automatisch generiert und im nächsten Schritt angezeigt.</div>` : ''}
                    
                    <button type="submit" class="btn-primary w-full mt-6">${btnText}</button>
                </form>
            </div>
        `;
        App.openModal(html);
        const modalContainer = document.getElementById('modal-content');
        if(modalContainer) modalContainer.classList.add('max-h-[90vh]', 'overflow-y-auto', 'custom-scrollbar');
    },

    // Helfer: Sammelt alle angehakten Rollen ein
    getSelectedRoles(form) {
        const checkboxes = form.querySelectorAll('input[name="roles"]:checked');
        const roles = [];
        checkboxes.forEach(cb => roles.push(cb.value));
        if(roles.length === 0) roles.push('Mitglied'); // Fallback: Mindestens "Mitglied"
        return roles;
    },

    async handleAdd(e) {
        e.preventDefault(); 
        const btn = e.target.querySelector('button[type="submit"]');
        const originalText = btn.innerText;
        btn.innerText = "Registriere...";
        btn.disabled = true;

        try {
            const fd = new FormData(e.target);
            const roles = this.getSelectedRoles(e.target);
            
            const firstName = fd.get('firstName');
            const email = fd.get('email');
            const generatedPassword = this.generatePassword();

            // 1. Auth User anlegen
            const tempClient = supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY, { auth: { persistSession: false } });
            const { data: authData, error: signUpError } = await tempClient.auth.signUp({ email, password: generatedPassword });

            if (signUpError) throw new Error("Auth Fehler: " + signUpError.message);

            // 2. Datenbank Eintrag erstellen
            let newUserId = authData.user ? authData.user.id : Date.now();
            
            const newMember = { 
                id: newUserId, 
                firstName: firstName, 
                lastName: fd.get('lastName'),
                street: fd.get('street'),
                houseNumber: fd.get('houseNumber'),
                zip: fd.get('zip'),
                city: fd.get('city'),
                phone: fd.get('phone'),
                birthdate: fd.get('birthdate'),
                email: email,
                roles: roles, // NEU: Array speichern
                role: roles[0], // BACKWARD COMPATIBILITY: Erste Rolle als String
                status: 'active',
                groups: []
            };
            
            let insertError = await this.safeInsert(newMember);
            
            if (insertError) {
                console.warn("UUID Insert failed (" + insertError.message + "), trying Auto-ID...");
                const memberClone = { ...newMember };
                delete memberClone.id;
                const retryError = await this.safeInsert(memberClone);
                if (retryError) throw new Error("Datenbank-Fehler: " + retryError.message);
                else App.showToast("Warnung: Login-Verknüpfung evtl. fehlerhaft (ID-Format)", "error");
            }
            
            // Erfolg!
            const mailtoLink = `mailto:${email}?subject=Zugangsdaten&body=Passwort: ${generatedPassword}`;
            const successHtml = `
                <div class="p-6 text-center">
                    <div class="w-14 h-14 bg-green-500/20 rounded-full flex items-center justify-center text-green-500 text-2xl mx-auto mb-4"><i class="fa-solid fa-check"></i></div>
                    <h3 class="text-xl font-bold text-white mb-2">Erfolgreich!</h3>
                    <p class="text-sm text-dark-muted mb-4">Profil erstellt & Login angelegt.</p>
                    <div class="bg-dark-bg p-3 rounded mb-4 text-left">
                        <p class="text-xs text-dark-muted uppercase">Passwort</p>
                        <code class="text-blue-400 select-all font-mono text-lg">${generatedPassword}</code>
                    </div>
                    <div class="flex gap-2">
                        <button onclick="App.closeModal()" class="flex-1 py-2 border border-dark-border rounded text-dark-muted">Schließen</button>
                        <a href="${mailtoLink}" class="flex-1 py-2 bg-blue-600 rounded text-white font-bold">E-Mail</a>
                    </div>
                </div>`;
            
            App.openModal(successHtml);
            await this.refreshData();

        } catch(err) {
            console.error(err);
            App.showToast(err.message, "error");
            btn.innerText = originalText;
            btn.disabled = false;
        }
    },

    async safeInsert(item) {
        if(typeof supabase === 'undefined') return { message: "Supabase fehlt" };
        const sessionStr = localStorage.getItem('vm_supabase_session');
        if (!sessionStr) return { message: "Nicht eingeloggt" };
        const token = JSON.parse(sessionStr).access_token;
        const client = supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY, {
            global: { headers: { Authorization: `Bearer ${token}` } }
        });
        const { error } = await client.from('members').insert(item);
        return error;
    },

    async safeUpdate(id, updates) {
        if(typeof supabase === 'undefined') return { message: "Supabase fehlt" };
        const sessionStr = localStorage.getItem('vm_supabase_session');
        if (!sessionStr) return { message: "Nicht eingeloggt" };
        
        try {
            const token = JSON.parse(sessionStr).access_token;
            const client = supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY, {
                global: { headers: { Authorization: `Bearer ${token}` } }
            });
            
            const cleanUpdates = { ...updates };
            if ('id' in cleanUpdates) delete cleanUpdates.id;

            const { data, error } = await client.from('members').update(cleanUpdates).eq('id', id).select();
            
            if (error) return error;
            if (!data || data.length === 0) {
                return { message: "Keine Daten geändert. Fehlende Berechtigung oder ID nicht gefunden." };
            }
            
            return null;
        } catch(e) {
            return e;
        }
    },

    async handleUpdate(e, id) {
        e.preventDefault();
        
        const btn = e.target.querySelector('button[type="submit"]');
        const oldText = btn.innerText;
        btn.innerText = "Speichere...";
        btn.disabled = true;

        const fd = new FormData(e.target);
        const roles = this.getSelectedRoles(e.target);
        
        const updates = { 
            firstName: fd.get('firstName'), 
            lastName: fd.get('lastName'), 
            street: fd.get('street'),
            houseNumber: fd.get('houseNumber'),
            zip: fd.get('zip'),
            city: fd.get('city'),
            email: fd.get('email'), 
            phone: fd.get('phone'),
            birthdate: fd.get('birthdate') ? fd.get('birthdate') : null,
            roles: roles, // NEU: Array
            role: roles[0], // FALLBACK: String
            status: fd.get('status') 
        };
            
        const error = await this.safeUpdate(id, updates);
        
        if (error) {
            console.error("Update Fehler:", error);
            App.showToast(error.message || "Fehler beim Update", "error");
            btn.innerText = oldText;
            btn.disabled = false;
            return;
        }

        App.closeModal();
        this.refreshData();
    }
};

window.MembersView = MembersView;
