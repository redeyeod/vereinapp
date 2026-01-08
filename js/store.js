/**
 * =============================================================================
 * STORE MODULE
 * Verwaltet den State (Daten) der Anwendung.
 * Jetzt MANDANTENFÄHIG: Trennt Daten basierend auf der Vereins-ID.
 * =============================================================================
 */

// Supabase Client Variable (wird in init erstellt)
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
        // Prüfen ob Config vorhanden
        if (typeof CONFIG === 'undefined' || !CONFIG.SUPABASE_URL || CONFIG.SUPABASE_URL.includes('HIER')) {
            console.error("Supabase Config fehlt in js/config.js!");
            alert("Bitte trage deine Supabase URL und Key in js/config.js ein.");
            return;
        }

        // Supabase Client initialisieren
        const { createClient } = supabase;
        _supabase = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY);

        // Zuletzt genutzten Verein laden
        const storedClubId = localStorage.getItem('vm_active_club_id');
        if (storedClubId) {
            this.clubId = storedClubId;
        }

        console.log(`Store initialisiert für Verein: ${this.clubId}`);

        // Echtzeit-Updates abonnieren
        _supabase.channel('public-db-changes')
            .on('postgres_changes', { event: '*', schema: 'public' }, (payload) => {
                console.log('Änderung empfangen:', payload);
                this.fetchTable(payload.table); // Tabelle neu laden
            })
            .subscribe();

        // Initiale Daten laden
        const tables = ['members', 'groups', 'events', 'news', 'docs', 'work_entries'];
        for(let t of tables) {
            await this.fetchTable(t);
        }
    },

    /**
     * Wechselt den Verein und lädt die Daten neu
     * (In dieser einfachen Version laden wir einfach alles neu. 
     * In einer echten App würde man hier filtern.)
     */
    switchClub(newClubId) {
        this.clubId = newClubId;
        localStorage.setItem('vm_active_club_id', newClubId);
        // Trigger Re-Fetch oder Reset
        // Da wir aktuell keine serverseitige Trennung haben (alles in einer DB), 
        // bleibt der Datenbestand gleich, aber die clubId ändert sich für neue Einträge (falls wir das implementieren würden).
        // Für diesen Prototyp laden wir neu.
        this.init(); 
        if(typeof App !== 'undefined') App.router('dashboard');
    },

    /**
     * Lädt eine komplette Tabelle
     */
    async fetchTable(table) {
        if(!_supabase) return;
        
        const { data, error } = await _supabase.from(table).select('*');
        
        if(error) {
            console.error(`Fehler beim Laden von ${table}:`, error);
        } else {
            this.state[table] = data;
            // App Bescheid geben, dass sich Daten geändert haben
            if (this.onUpdate) this.onUpdate();
        }
    },

    // --- CRUD OPERATIONEN (Cloud) ---

    /**
     * Fügt ein Item hinzu (oder überschreibt es bei ID-Konflikt -> Upsert)
     */
    async add(table, item) {
        if(!_supabase) return;

        // Klonen um Original nicht zu ändern
        const payload = { ...item };
        
        // ID-Handling: 
        // Wenn die ID sehr groß ist (Date.now()), ist es eine lokale ID.
        // Wir entfernen sie normalerweise, damit die DB eine ID generiert (auto-increment).
        // Ausnahme: Der Admin-User (999) soll fest bleiben.
        if (payload.id && typeof payload.id === 'number' && payload.id > 1000000000) {
             delete payload.id; 
        }
        
        // Wir nutzen upsert, um sowohl Insert als auch Update (bei fester ID) abzudecken
        const { error } = await _supabase.from(table).upsert(payload);
        
        if(error) {
            console.error("Fehler beim Speichern:", error);
            if(typeof App !== 'undefined') App.showToast('Fehler: ' + error.message);
        } else {
            if(typeof App !== 'undefined') App.showToast('Gespeichert');
        }
    },

    /**
     * Aktualisiert ein Item
     */
    async update(table, item) {
        if(!_supabase) return;

        const { error } = await _supabase.from(table).update(item).eq('id', item.id);
        
        if(error) {
            console.error("Fehler beim Aktualisieren:", error);
            if(typeof App !== 'undefined') App.showToast('Fehler beim Aktualisieren');
        } else {
            if(typeof App !== 'undefined') App.showToast('Aktualisiert');
        }
    },

    /**
     * Entfernt ein Item
     */
    async remove(table, id) {
        if(!_supabase) return;

        const { error } = await _supabase.from(table).delete().eq('id', id);
        
        if(error) {
            console.error("Fehler beim Löschen:", error);
            if(typeof App !== 'undefined') App.showToast('Fehler beim Löschen');
        } else {
            if(typeof App !== 'undefined') App.showToast('Gelöscht');
        }
    },

    /**
     * Alias für add (fügt am Anfang hinzu - DB sortiert aber meist anders)
     */
    async addFirst(table, item) {
        await this.add(table, item);
    },

    /**
     * Hilfsfunktion zum Abrufen lokaler Daten
     */
    get(collection) {
        return this.state[collection] || [];
    }
};