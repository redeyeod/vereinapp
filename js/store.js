/**
 * =============================================================================
 * STORE MODULE (Reactive v2.0)
 * Handelt die Datenbank-Verbindung und zwingt die UI zum Update
 * =============================================================================
 */

let _supabase = null;

const Store = {
    clubId: 'demo',

    state: {
        members: [],
        groups: [],
        events: [],
        news: [],
        docs: [],
        work_entries: [],
        currentView: 'dashboard'
    },

    onUpdate: null,

    async init() {
        console.log("Store: Initialisierung...");
        
        if (typeof CONFIG === 'undefined' || !CONFIG.SUPABASE_URL) return;

        try {
            const { createClient } = supabase;
            
            // FIX: Prüfen, ob ein Token im LocalStorage liegt (so wie in members.js safeInsert)
            const sessionStr = localStorage.getItem('vm_supabase_session');
            let options = {};
            
            if (sessionStr) {
                try {
                    const session = JSON.parse(sessionStr);
                    if (session && session.access_token) {
                        console.log("Store: Auth-Token gefunden, logge ein...");
                        options = {
                            global: {
                                headers: {
                                    Authorization: `Bearer ${session.access_token}`
                                }
                            }
                        };
                    }
                } catch (e) {
                    console.warn("Store: Konnte Session nicht parsen", e);
                }
            }

            // Client mit Auth-Headern erstellen
            _supabase = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY, options);

            // Realtime-Kanal abonnieren
            _supabase.channel('room1')
                .on('postgres_changes', { event: '*', schema: 'public' }, (payload) => {
                    console.log('Store: Echtzeit-Änderung erkannt', payload.table);
                    this.fetchTable(payload.table); 
                })
                .subscribe();

            // Initialen Daten-Load starten
            await this.loadAllData();
            
        } catch (err) {
            console.error("Store Init Fehler:", err);
        }
    },
    
    async loadAllData() {
        const tables = ['members', 'groups', 'events', 'news', 'docs', 'work_entries'];
        // Wir laden alles parallel für maximale Geschwindigkeit
        await Promise.all(tables.map(t => this.fetchTable(t)));
        console.log("Store: Alle Daten sind bereit.");
    },

    async fetchTable(table) {
        if(!_supabase) return;
        const { data, error } = await _supabase.from(table).select('*');
        
        if(!error) {
            this.state[table] = data || [];
            // WICHTIG: Die App informieren, dass neue Daten da sind
            if (this.onUpdate) this.onUpdate();
        }
    },

    // --- CRUD OPERATIONEN MIT SOFORT-UPDATE ---

    async add(table, item) {
        if(!_supabase) return;
        
        // ID-Fix: Supabase generiert IDs selbst, falls das Feld leer ist
        const payload = { ...item };
        // Lösche ID nur, wenn es eine temporäre JS-Timestamp ID ist
        if (typeof payload.id === 'number' && payload.id > 1000000000) delete payload.id; 

        const { error } = await _supabase.from(table).insert(payload);
        
        if(error) {
            console.error("Fehler beim Speichern:", error);
            if(window.App) window.App.showToast('Fehler: ' + error.message, 'error');
        } else {
            // ERZWUNGENES UPDATE: Sofort neu laden, falls Realtime klemmt
            await this.fetchTable(table);
            if(window.App) window.App.showToast('Erfolgreich gespeichert');
        }
    },

    async update(table, item) {
        if(!_supabase) return;
        
        console.log(`Store: Update ${table}`, item.id); // Debug log

        const { data, error, count } = await _supabase
            .from(table)
            .update(item)
            .eq('id', item.id)
            .select(); // .select() hilft sicherzustellen, dass wir Rückmeldung bekommen
        
        if(error) {
            console.error("Fehler beim Update:", error);
            if(window.App) window.App.showToast('Update fehlgeschlagen: ' + error.message, 'error');
        } else {
            // Check ob tatsächlich was passiert ist (RLS Silent Fail Check)
            if (data && data.length === 0) {
                 console.warn("Update lief durch, aber keine Zeilen geändert. Prüfe RLS Policies!");
            }
            
            await this.fetchTable(table);
            if(window.App) window.App.showToast('Aktualisiert');
        }
    },

    async remove(table, id) {
        if(!_supabase) return;
        const { error } = await _supabase.from(table).delete().eq('id', id);
        
        if(error) {
            console.error("Fehler beim Löschen:", error);
            if(window.App) window.App.showToast('Löschen fehlgeschlagen', 'error');
        } else {
            await this.fetchTable(table);
            if(window.App) window.App.showToast('Eintrag wurde entfernt');
        }
    },

    // Alias für Kompatibilität
    async addFirst(table, item) { await this.add(table, item); }
};

window.Store = Store;
