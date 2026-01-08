/**
 * =============================================================================
 * STORE MODULE
 * Verwaltet den State (Daten) der Anwendung.
 * Verbindet sich mit Supabase und synchronisiert Daten in Echtzeit.
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
        // 1. Prüfen ob Config geladen wurde
        if (typeof CONFIG === 'undefined' || !CONFIG.SUPABASE_URL || CONFIG.SUPABASE_URL.includes('HIER')) {
            console.error("Supabase Config fehlt in js/config.js!");
            return;
        }

        // 2. Prüfen ob Supabase Client geladen ist
        if (typeof supabase === 'undefined') {
            console.error("Supabase Bibliothek nicht geladen! Bitte <script src='...supabase-js'></script> in index.html prüfen.");
            return;
        }

        // 3. Client erstellen
        const { createClient } = supabase;
        _supabase = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY);

        // 4. Zuletzt genutzten Verein laden
        const storedClubId = localStorage.getItem('vm_active_club_id');
        if (storedClubId) {
            this.clubId = storedClubId;
        }

        console.log(`Store initialisiert für Verein: ${this.clubId}`);

        // 5. Echtzeit-Updates abonnieren
        // Hört auf ALLE Änderungen in der Datenbank (Insert, Update, Delete)
        _supabase.channel('public-db-changes')
            .on('postgres_changes', { event: '*', schema: 'public' }, (payload) => {
                console.log('Änderung empfangen:', payload);
                // Wenn sich was ändert, laden wir die betroffene Tabelle neu
                this.fetchTable(payload.table); 
            })
            .subscribe();

        // 6. Initiale Daten laden
        const tables = ['members', 'groups', 'events', 'news', 'docs', 'work_entries'];
        for(let t of tables) {
            await this.fetchTable(t);
        }
    },

    /**
     * Wechselt den Verein und lädt die Daten neu
     */
    switchClub(newClubId) {
        this.clubId = newClubId;
        localStorage.setItem('vm_active_club_id', newClubId);
        // Wir laden alles neu (in einer echten SQL-Struktur würde man hier 
        // Queries mit 'WHERE club_id = ...' anpassen)
        this.init(); 
        if(typeof App !== 'undefined') App.router('dashboard');
    },

    /**
     * Lädt eine komplette Tabelle aus der Cloud
     */
    async fetchTable(table) {
        if(!_supabase) return;
        
        const { data, error } = await _supabase.from(table).select('*');
        
        if(error) {
            console.error(`Fehler beim Laden von ${table}:`, error);
        } else {
            this.state[table] = data;
            // App Bescheid geben, dass sich Daten geändert haben -> Re-Render
            if (this.onUpdate) this.onUpdate();
        }
    },

    // --- CRUD OPERATIONEN (Create, Read, Update, Delete) ---

    /**
     * Fügt ein Item hinzu
     */
    async add(table, item) {
        if(!_supabase) return;

        // Klonen um Original nicht zu ändern
        const payload = { ...item };
        
        // ID-Handling für Supabase:
        // Wir nutzen lokal oft Date.now() für temporäre IDs (große Zahlen).
        // Supabase/Postgres generiert aber eigene IDs (1, 2, 3...) beim Insert.
        // Deshalb entfernen wir die lokale ID vor dem Senden, damit die DB keinen Fehler wirft.
        // Ausnahme: Der Admin-User (ID 999) ist fest vorgegeben.
        if (payload.id && typeof payload.id === 'number' && payload.id > 1000000000) {
             delete payload.id; 
        }

        // Optimistic UI: Wir könnten es lokal schon anzeigen, 
        // aber wir warten hier auf das Realtime-Event für sauberere Datenkonsistenz.
        
        const { error } = await _supabase.from(table).insert(payload);
        
        if(error) {
            console.error("Fehler beim Speichern:", error);
            if(typeof App !== 'undefined') App.showToast('Fehler: ' + error.message);
        } else {
            if(typeof App !== 'undefined') App.showToast('Gespeichert');
        }
    },

    /**
     * Alias für add (kompatibilität)
     */
    async addFirst(table, item) {
        await this.add(table, item);
    },

    /**
     * Aktualisiert ein Item
     */
    async update(table, item) {
        if(!_supabase) return;

        // Beim Update brauchen wir die ID zwingend
        const { error } = await _supabase.from(table).update(item).eq('id', item.id);
        
        if(error) {
            console.error("Fehler beim Aktualisieren:", error);
            if(typeof App !== 'undefined') App.showToast('Fehler: ' + error.message);
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
            if(typeof App !== 'undefined') App.showToast('Fehler: ' + error.message);
        } else {
            if(typeof App !== 'undefined') App.showToast('Gelöscht');
        }
    },

    /**
     * Hilfsfunktion zum Abrufen lokaler Daten
     */
    get(collection) {
        return this.state[collection] || [];
    }
};

// Global verfügbar machen
window.Store = Store;
