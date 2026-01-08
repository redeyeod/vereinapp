/**
 * =============================================================================
 * STORE MODULE
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
        console.log("Store: Init gestartet...");
        
        // 1. Config Check
        if (typeof CONFIG === 'undefined' || !CONFIG.SUPABASE_URL) {
            console.error("Store: Config fehlt!");
            return;
        }

        // 2. Supabase Check
        if (typeof supabase === 'undefined') {
            console.error("Store: Supabase JS Library fehlt!");
            return;
        }

        try {
            // 3. Client erstellen
            const { createClient } = supabase;
            _supabase = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY);

            // 4. Club laden
            const storedClubId = localStorage.getItem('vm_active_club_id');
            if (storedClubId) this.clubId = storedClubId;

            console.log(`Store: Initialisiert für ${this.clubId}`);

            // 5. Realtime
            _supabase.channel('public-db-changes')
                .on('postgres_changes', { event: '*', schema: 'public' }, (payload) => {
                    console.log('Store: DB Change', payload);
                    this.fetchTable(payload.table); 
                })
                .subscribe();

            // 6. Daten laden (Nicht blockierend, damit UI schneller rendert)
            // Wir warten hier NICHT mit await, damit die App schon starten kann
            this.loadAllData();
            
        } catch (err) {
            console.error("Store Init Fehler:", err);
        }
    },
    
    async loadAllData() {
        const tables = ['members', 'groups', 'events', 'news', 'docs', 'work_entries'];
        for(let t of tables) {
            await this.fetchTable(t);
        }
        console.log("Store: Alle Daten geladen.");
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
            // Fehler unterdrücken wenn Tabelle nicht existiert (passiert bei neuen Projekten oft)
            console.warn(`Store: Konnte ${table} nicht laden:`, error.message);
        } else {
            this.state[table] = data || [];
            if (this.onUpdate) this.onUpdate();
        }
    },

    // CRUD
    async add(table, item) {
        if(!_supabase) return;
        const payload = { ...item };
        if (payload.id && typeof payload.id === 'number' && payload.id > 1000000000) delete payload.id; 
        
        const { error } = await _supabase.from(table).insert(payload);
        if(error) {
            console.error("Store Add Error:", error);
            if(typeof App !== 'undefined') App.showToast('Fehler: ' + error.message);
        } else {
            if(typeof App !== 'undefined') App.showToast('Gespeichert');
        }
    },
    
    async addFirst(table, item) { await this.add(table, item); },

    async update(table, item) {
        if(!_supabase) return;
        const { error } = await _supabase.from(table).update(item).eq('id', item.id);
        if(error) {
            console.error("Store Update Error:", error);
            if(typeof App !== 'undefined') App.showToast('Fehler: ' + error.message);
        } else {
            if(typeof App !== 'undefined') App.showToast('Aktualisiert');
        }
    },

    async remove(table, id) {
        if(!_supabase) return;
        const { error } = await _supabase.from(table).delete().eq('id', id);
        if(error) {
            console.error("Store Delete Error:", error);
            if(typeof App !== 'undefined') App.showToast('Fehler: ' + error.message);
        } else {
            if(typeof App !== 'undefined') App.showToast('Gelöscht');
        }
    },

    get(collection) { return this.state[collection] || []; }
};

// WICHTIG: Global verfügbar machen
window.Store = Store;
