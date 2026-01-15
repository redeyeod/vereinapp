/**
 * =============================================================================
 * PROFILE VIEW (Clean & Mobile First)
 * Benutzerprofil und Einstellungen
 * =============================================================================
 */

const ProfileView = {
    /**
     * Rendert die Profil-Ansicht
     * @param {HTMLElement} container 
     */
    render(container) {
        // Aktuellen User aus LocalStorage laden
        const currentUserId = localStorage.getItem('vm_current_user_id');
        let user = {
            name: 'Gast User',
            role: 'Besucher',
            memberSince: '2023',
            position: 'Gast',
            email: 'unbekannt'
        };

        // Daten frisch aus dem Store holen
        const members = (typeof Store !== 'undefined' && Store.state && Store.state.members) ? Store.state.members : [];
        if(currentUserId) {
            const foundUser = members.find(m => m.id == currentUserId);
            if(foundUser) {
                // ROLES FIX: Prüfen ob Array oder String
                let roleDisplay = 'Mitglied';
                if (Array.isArray(foundUser.roles) && foundUser.roles.length > 0) {
                    roleDisplay = foundUser.roles.join(', ');
                } else if (foundUser.role) {
                    roleDisplay = foundUser.role;
                }

                user = {
                    name: `${foundUser.firstName} ${foundUser.lastName}`,
                    role: roleDisplay,
                    memberSince: foundUser.joinedDate ? new Date(foundUser.joinedDate).getFullYear() : '2024',
                    position: roleDisplay,
                    email: foundUser.email || 'Keine E-Mail hinterlegt'
                };
            }
        }

        container.innerHTML = `
            <div class="max-w-3xl mx-auto fade-in pb-20">
                
                <!-- Profil Header Karte -->
                <div class="bg-dark-card rounded-2xl border border-dark-border p-6 md:p-8 mb-6 flex flex-col md:flex-row items-center gap-6 shadow-sm">
                    
                    <!-- Avatar mit Edit Funktion -->
                    <div class="relative group cursor-pointer flex-shrink-0" onclick="App.showToast('Funktion: Bild ändern')">
                        <div class="w-24 h-24 md:w-32 md:h-32 rounded-full bg-gradient-to-br from-slate-700 to-slate-800 flex items-center justify-center text-4xl md:text-5xl text-slate-400 border-4 border-dark-bg shadow-inner overflow-hidden relative transition-transform group-hover:scale-105">
                            <i class="fa-solid fa-user"></i>
                        </div>
                        <!-- Overlay Icon -->
                        <div class="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-[2px]">
                            <i class="fa-solid fa-camera text-white text-2xl"></i>
                        </div>
                    </div>
                    
                    <!-- Infos -->
                    <div class="text-center md:text-left flex-1 min-w-0">
                        <h2 class="text-2xl md:text-4xl font-bold text-white mb-1 truncate">${user.name}</h2>
                        <p class="text-brand-400 font-medium text-sm md:text-lg mb-4 bg-brand-500/10 inline-block px-3 py-1 rounded-full border border-brand-500/20">${user.role}</p>
                        
                        <div class="flex flex-col md:flex-row gap-3 md:gap-6 text-sm text-dark-muted justify-center md:justify-start">
                             <div class="flex items-center gap-2 justify-center md:justify-start bg-dark-bg/50 px-3 py-1.5 rounded-lg border border-dark-border">
                                <i class="fa-solid fa-envelope w-4 text-center text-brand-500"></i> 
                                <span class="truncate max-w-[200px]">${user.email}</span>
                             </div>
                             <div class="flex items-center gap-2 justify-center md:justify-start bg-dark-bg/50 px-3 py-1.5 rounded-lg border border-dark-border">
                                <i class="fa-solid fa-star w-4 text-center text-yellow-500"></i> 
                                <span>Seit ${user.memberSince}</span>
                             </div>
                        </div>
                    </div>
                </div>

                <!-- Einstellungen Grid -->
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                    
                    <!-- Sicherheit / Zugangsdaten -->
                    <div class="bg-dark-card rounded-2xl border border-dark-border p-5 md:p-6 shadow-sm">
                        <h3 class="text-base font-bold text-white mb-4 flex items-center">
                            <i class="fa-solid fa-shield-halved mr-2 text-emerald-400"></i> Sicherheit
                        </h3>
                        
                        <div class="flex justify-between items-center p-3 rounded-xl bg-dark-bg/50 border border-dark-border group hover:border-brand-500/30 transition-colors">
                            <div class="min-w-0 pr-2">
                                <p class="text-sm text-white font-medium group-hover:text-brand-400 transition-colors">Zugangsdaten</p>
                                <p class="text-[10px] text-dark-muted truncate uppercase tracking-wider">E-Mail & Passwort ändern</p>
                            </div>
                            <button onclick="ProfileView.openCredentialsModal()" class="text-xs bg-dark-card hover:bg-dark-hover border border-dark-border text-white px-3 py-2 rounded-lg transition-colors font-bold whitespace-nowrap shadow-sm">
                                Ändern
                            </button>
                        </div>
                    </div>

                    <!-- Benachrichtigungen -->
                    <div class="bg-dark-card rounded-2xl border border-dark-border p-5 md:p-6 shadow-sm">
                        <h3 class="text-base font-bold text-white mb-4 flex items-center">
                            <i class="fa-solid fa-bell mr-2 text-amber-400"></i> Benachrichtigungen
                        </h3>
                        
                        <div class="space-y-2">
                            ${this.renderToggle('Email bei neuen Terminen', true)}
                            ${this.renderToggle('Push bei News', true)}
                        </div>
                    </div>
                    
                    <!-- App Info & Reset -->
                    <div class="bg-dark-card rounded-2xl border border-dark-border p-5 md:p-6 shadow-sm md:col-span-2 flex flex-col sm:flex-row items-center justify-between gap-4">
                        <div>
                            <p class="text-sm font-bold text-white flex items-center gap-2"><i class="fa-solid fa-layer-group text-brand-500"></i> VereinsManager App</p>
                            <p class="text-xs text-dark-muted mt-1">Version 2.1.0 • Authenticated</p>
                        </div>
                        <button onclick="if(confirm('Wirklich alle lokalen Daten löschen?')) { localStorage.clear(); location.reload(); }" class="text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 px-3 py-2 rounded-lg transition-colors flex items-center gap-2 border border-transparent hover:border-red-500/20">
                            <i class="fa-solid fa-trash-can"></i> App zurücksetzen & Cache leeren
                        </button>
                    </div>

                    <!-- Logout Button -->
                    <div class="md:col-span-2 mt-2">
                        <button onclick="App.logout()" class="w-full py-4 rounded-2xl bg-red-600 hover:bg-red-500 text-white font-bold text-lg transition-all shadow-lg shadow-red-900/20 flex items-center justify-center gap-2 hover:-translate-y-1 cursor-pointer group">
                            <i class="fa-solid fa-right-from-bracket group-hover:rotate-180 transition-transform duration-500"></i> Abmelden
                        </button>
                    </div>
                </div>
            </div>
        `;
    },

    /**
     * Öffnet das Modal zum Ändern von E-Mail und Passwort
     */
    openCredentialsModal() {
        const currentUserId = localStorage.getItem('vm_current_user_id');
        const members = (typeof Store !== 'undefined' && Store.state && Store.state.members) ? Store.state.members : [];
        const user = members.find(m => m.id == currentUserId);
        if(!user) return;

        const html = `
            <div class="p-6 md:p-8">
                <div class="flex justify-between items-center mb-6 border-b border-dark-border pb-4">
                    <h3 class="text-xl font-bold text-white">Zugangsdaten ändern</h3>
                    <button onclick="App.closeModal()" class="text-dark-muted hover:text-white p-2 transition-colors"><i class="fa-solid fa-times text-xl"></i></button>
                </div>
                
                <form onsubmit="ProfileView.handleCredentialsUpdate(event)" class="space-y-5">
                    <div>
                        <label class="block text-xs font-bold text-dark-muted uppercase mb-2">Neue E-Mail Adresse</label>
                        <input type="email" name="email" value="${user.email || ''}" required class="form-input">
                    </div>
                    
                    <div>
                        <label class="block text-xs font-bold text-dark-muted uppercase mb-2">Neues Passwort</label>
                        <input type="password" name="password" placeholder="Leer lassen zum Beibehalten" class="form-input">
                        <p class="text-[10px] text-dark-muted mt-1">Mindestens 6 Zeichen.</p>
                    </div>

                    <div class="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl flex gap-3 items-start">
                        <i class="fa-solid fa-triangle-exclamation text-amber-500 mt-0.5 text-sm"></i>
                        <p class="text-xs text-amber-500/90 leading-relaxed">Achtung: Bei Änderung der E-Mail müssen Sie diese ggf. erneut bestätigen. Beim nächsten Login gelten die neuen Daten.</p>
                    </div>
                    
                    <button type="submit" class="btn-primary w-full mt-2 shadow-lg shadow-brand-500/20">
                        Speichern
                    </button>
                </form>
            </div>
        `;
        App.openModal(html);
    },

    /**
     * Verarbeitet das Speichern der neuen Zugangsdaten
     */
    async handleCredentialsUpdate(e) {
        e.preventDefault();
        const fd = new FormData(e.target);
        const newEmail = fd.get('email');
        const newPass = fd.get('password');
        
        const currentUserId = localStorage.getItem('vm_current_user_id');
        const members = (typeof Store !== 'undefined' && Store.state && Store.state.members) ? Store.state.members : [];
        const user = members.find(m => m.id == currentUserId);
        
        if (!user) return;

        const btn = e.target.querySelector('button[type="submit"]');
        const originalText = btn.innerText;
        btn.innerText = "Speichere...";
        btn.disabled = true;

        try {
            // Objekt für Auth Update vorbereiten
            const updates = {};
            let emailChanged = false;

            if (newEmail && newEmail !== user.email) {
                updates.email = newEmail;
                emailChanged = true;
            }
            if (newPass && newPass.trim() !== "") {
                if (newPass.length < 6) throw new Error("Passwort muss mindestens 6 Zeichen lang sein.");
                updates.password = newPass;
            }

            if (Object.keys(updates).length === 0) {
                App.showToast('Keine Änderungen vorgenommen.');
                App.closeModal();
                return;
            }

            // 1. Supabase Auth Update durchführen
            if (typeof supabase !== 'undefined') {
                const sessionStr = localStorage.getItem('vm_supabase_session');
                const headers = {};
                if (sessionStr) { 
                    const session = JSON.parse(sessionStr); 
                    if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`; 
                }
                const client = supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY, { global: { headers } });

                const { data, error } = await client.auth.updateUser(updates);

                if (error) throw error;

                // 2. Wenn Email geändert wurde, auch in der Mitglieder-Tabelle updaten
                if (emailChanged) {
                    const { error: dbError } = await client.from('members').update({ email: newEmail }).eq('id', currentUserId);
                    if (dbError) throw dbError;
                    
                    // Lokalen Store aktualisieren
                    user.email = newEmail;
                    if(Store.update) Store.update('members', user);
                }

                App.showToast('Zugangsdaten erfolgreich aktualisiert');
                if (emailChanged) App.showToast('Bitte bestätige ggf. die neue E-Mail.', 'info');

            } else {
                // Fallback ohne Supabase (nur lokal)
                if (emailChanged) user.email = newEmail;
                if (updates.password) user.password = updates.password; // Mock
                
                await Store.update('members', user);
                App.showToast('Lokal aktualisiert (Kein Backend)');
            }
            
            App.closeModal();
            this.render(document.getElementById('content'));

        } catch (err) {
            console.error(err);
            App.showToast("Fehler: " + err.message, "error");
        } finally {
            btn.innerText = originalText;
            btn.disabled = false;
        }
    },

    /**
     * Hilfsfunktion für Toggle-Switches (nur visuell)
     */
    renderToggle(label, isActive) {
        const bgClass = isActive ? 'bg-brand-600' : 'bg-slate-700';
        const knobClass = isActive ? 'right-1' : 'left-1';
        
        const toggleScript = `this.classList.toggle('bg-brand-600'); this.classList.toggle('bg-slate-700'); this.children[0].classList.toggle('right-1'); this.children[0].classList.toggle('left-1');`;

        return `
            <div class="flex items-center justify-between p-3 rounded-xl bg-dark-bg/50 border border-dark-border cursor-pointer hover:bg-dark-bg/70 transition-colors group" onclick="this.querySelector('.toggle-switch').click()">
                <span class="text-sm text-dark-muted group-hover:text-white transition-colors select-none">${label}</span>
                <div class="toggle-switch w-10 h-5 ${bgClass} rounded-full relative transition-colors duration-200" onclick="event.stopPropagation(); ${toggleScript}">
                    <div class="absolute top-1 w-3 h-3 bg-white rounded-full transition-all duration-200 ${knobClass}"></div>
                </div>
            </div>
        `;
    }
};

// WICHTIG: Global verfügbar machen für die neue App.js
window.ProfileView = ProfileView;
