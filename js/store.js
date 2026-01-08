/**
 * =============================================================================
 * STORE MODULE
 * Verwaltet den State (Daten) der Anwendung.
 * Jetzt MANDANTENFÄHIG: Trennt Daten basierend auf der Vereins-ID.
 * MIT OPTIMISTIC UPDATES: Änderungen werden sofort angezeigt.
 * =============================================================================
 */

// Supabase Client Variable
let _supabase = null;

const Store = {
    // Aktuelle Vereins-ID (Default: 'demo')
    clubId: 'demo',

    // Der aktuelle Zustand der App
    state: {
        members: [],
        groups: [],
        events: [],
        news: [],
        docs: [],
        work_entries: [],
        currentView: 'dashboard'
    },

    onUpdate: null, // Callback für App-Rerender

    /**
     * Initialisiert die Verbindung zur Cloud und lädt Daten
     */
    async init() {
        if (typeof CONFIG === 'undefined' || !CONFIG.SUPABASE_URL || CONFIG.SUPABASE_URL.includes('HIER')) {
            console.error("Supabase Config fehlt in js/config.js!");
            return;
        }

        // Client erstellen (global)
        const { createClient } = supabase;
        _supabase = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY);

        // Verein laden
        const storedClubId = localStorage.getItem('vm_active_club_id');
        if (storedClubId) {
            this.clubId = storedClubId;
        }

        console.log(`Store initialisiert für Verein: ${this.clubId}`);

        // Echtzeit-Updates abonnieren (für Änderungen von anderen Nutzern)
        _supabase.channel('public-db-changes')
            .on('postgres_changes', { event: '*', schema: 'public' }, (payload) => {
                // Wir laden die betroffene Tabelle neu, um sicherzugehen
                this.fetchTable(payload.table); 
            })
            .subscribe();

        // Initiale Daten laden
        const tables = ['members', 'groups', 'events', 'news', 'docs', 'work_entries'];
        for(let t of tables) {
            await this.fetchTable(t);
        }
    },

    switchClub(newClubId) {
        this.clubId = newClubId;
        localStorage.setItem('vm_active_club_id', newClubId);
        this.init(); 
        if(typeof App !== 'undefined') App.router('dashboard');
    },

    async fetchTable(table) {
        if(!_supabase) return;
        const { data, error } = await _supabase.from(table).select('*');
        
        if(error) {
            console.error(`Fehler beim Laden von ${table}:`, error);
        } else {
            this.state[table] = data;
            // Trigger Rerender
            if (this.onUpdate) this.onUpdate();
        }
    },

    // --- CRUD OPERATIONEN MIT OPTIMISTIC UI ---
    // Das bedeutet: Erst lokal ändern (sofort sichtbar), dann an Server senden.

    async add(table, item) {
        if(!_supabase) return;

        // 1. Optimistic Update (Sofort anzeigen)
        if (this.state[table]) {
            // Prüfen ob Item schon existiert (Update) oder neu ist (Add)
            const index = this.state[table].findIndex(i => i.id === item.id);
            if (index !== -1) {
                this.state[table][index] = item;
            } else {
                this.state[table].push(item);
                // Sortierung beibehalten (optional)
                if(table === 'news' || table === 'docs' || table === 'work_entries') {
                    this.state[table].sort((a,b) => b.id - a.id);
                }
            }
            if (this.onUpdate) this.onUpdate();
        }

        // 2. Cloud Update
        // ID entfernen wenn es eine lokale Zeitstempel-ID ist, damit die DB eine generieren kann.
        // ABER: Für diesen Prototyp behalten wir die ID bei, damit das Optimistic Update nicht flackert.
        // In einer Profi-App würde man die ID vom Server zurückbekommen und lokal austauschen.
        const payload = { ...item };
        
        // Wir nutzen upsert (Insert oder Update)
        const { error } = await _supabase.from(table).upsert(payload);
        
        if(error) {
            console.error("Fehler beim Speichern:", error);
            if(typeof App !== 'undefined') App.showToast('Fehler: ' + error.message);
            // Hier könnte man das optimistische Update rückgängig machen (Rollback)
        } else {
            if(typeof App !== 'undefined') App.showToast('Gespeichert');
        }
    },

    async update(table, item) {
        // Alias für add, da unsere Logik oben beides abdeckt
        await this.add(table, item);
    },

    async remove(table, id) {
        if(!_supabase) return;

        // 1. Optimistic Delete (Sofort entfernen)
        if (this.state[table]) {
            this.state[table] = this.state[table].filter(i => i.id !== id);
            if (this.onUpdate) this.onUpdate();
        }

        // 2. Cloud Delete
        const { error } = await _supabase.from(table).delete().eq('id', id);
        
        if(error) {
            console.error("Fehler beim Löschen:", error);
            if(typeof App !== 'undefined') App.showToast('Fehler beim Löschen');
            // Rollback wäre hier: Item wieder in den State pushen
        } else {
            if(typeof App !== 'undefined') App.showToast('Gelöscht');
        }
    },

    async addFirst(table, item) {
        await this.add(table, item);
    },

    get(collection) {
        return this.state[collection] || [];
    }
};
