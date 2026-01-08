/**
 * =============================================================================
 * STORE MODULE
 * Verwaltet den State (Daten) der Anwendung.
 * Jetzt MANDANTENFÄHIG: Trennt Daten basierend auf der Vereins-ID.
 * =============================================================================
 */

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
        work_entries: [], // NEU: Arbeitsstunden
        currentView: 'dashboard'
    },

    /**
     * Hilfsfunktion: Generiert den LocalStorage Key basierend auf dem aktuellen Verein
     */
    getKey(key) {
        return `vm_${this.clubId}_${key}`;
    },

    /**
     * Wechselt den Verein und lädt die Daten neu
     */
    switchClub(newClubId) {
        this.clubId = newClubId;
        localStorage.setItem('vm_active_club_id', newClubId);
        this.init(); // Daten neu laden
    },

    /**
     * Lädt Daten aus dem LocalStorage für den aktuellen Verein
     */
    init() {
        const storedClubId = localStorage.getItem('vm_active_club_id');
        if (storedClubId) {
            this.clubId = storedClubId;
        }
        
        console.log(`Store initialisiert für Verein: ${this.clubId}`);

        const generateMocks = () => {
            let groups = [];
            let news = [];
            let members = [];
            let events = [];
            let work_entries = []; // NEU

            if (this.clubId === 'grokage') {
                groups = [
                    { id: 1, name: 'Mälscher Dominos', chat: [], files: [] },
                    { id: 2, name: 'Mälscher Nachtkrabb', chat: [], files: [] },
                    { id: 3, name: 'Verwaltung', chat: [], files: [] },
                    { id: 4, name: 'Storchengarde', chat: [], files: [] },
                    { id: 5, name: 'Jugendgarde', chat: [], files: [] },
                    { id: 6, name: 'Männerballett', chat: [], files: [] }
                ];
                news = [{ id: 1, title: 'Helau!', content: 'Willkommen bei der GroKaGe Malsch!', date: new Date().toISOString() }];
                members = [{ id: 999, firstName: 'Präsident', lastName: 'GroKaGe', role: 'Admin', group: 'Verwaltung', groups: ['Verwaltung'], status: 'active', email: 'admin@gmail.com', password: 'admin' }];
                events = [{ id: 1, title: 'Prunksitzung', date: '2024-02-10', time: '19:11', location: 'Bürgerhaus', group: null }];
            } else {
                groups = [ { id: 1, name: 'Vorstand', chat: [], files: [] }, { id: 2, name: 'Allgemein', chat: [], files: [] }, { id: 3, name: 'Fußball', chat: [], files: [] }, { id: 4, name: 'Turnen', chat: [], files: [] } ];
                news = [{ id: 1, title: 'Willkommen', content: `Willkommen in Verein ${this.clubId}!`, date: new Date().toISOString() }];
                members = [
                    { id: 1, firstName: 'Max', lastName: 'Mustermann', role: 'Vorstand', group: 'Verwaltung', groups: ['Verwaltung'], status: 'active', email: 'max@verein.de', password: 'demo' },
                    { id: 999, firstName: 'Super', lastName: 'Admin', role: 'Admin', group: 'Vorstand', groups: ['Vorstand'], status: 'active', email: 'admin@gmail.com', password: 'admin' }
                ];
                events = [{ id: 1, title: 'Jahreshauptversammlung', date: '2023-11-20', time: '19:00', location: 'Vereinsheim', group: null }];
                
                // Mock Arbeitsstunden
                work_entries = [
                    { id: 1, memberId: 1, activity: 'Aufbau Sommerfest', date: '2023-07-15', hours: 4, status: 'approved' }, // Genehmigt
                    { id: 2, memberId: 1, activity: 'Abbau Zelt', date: '2023-07-16', hours: 2.5, status: 'pending' }      // Ausstehend
                ];
            }

            return { members, groups, events, news, docs: [], work_entries };
        };

        const load = (key, fallback) => JSON.parse(localStorage.getItem(this.getKey(key))) || fallback;
        const mocks = generateMocks();

        this.state.members = load('members', mocks.members);
        this.state.groups = load('groups', mocks.groups);
        this.state.events = load('events', mocks.events);
        this.state.news = load('news', mocks.news);
        this.state.docs = load('docs', mocks.docs);
        this.state.work_entries = load('work_entries', mocks.work_entries); // NEU
    },

    save() {
        localStorage.setItem(this.getKey('members'), JSON.stringify(this.state.members));
        localStorage.setItem(this.getKey('groups'), JSON.stringify(this.state.groups));
        localStorage.setItem(this.getKey('events'), JSON.stringify(this.state.events));
        localStorage.setItem(this.getKey('news'), JSON.stringify(this.state.news));
        localStorage.setItem(this.getKey('docs'), JSON.stringify(this.state.docs));
        localStorage.setItem(this.getKey('work_entries'), JSON.stringify(this.state.work_entries)); // NEU
    },

    // --- CRUD Helper ---
    add(collection, item) {
        if (this.state[collection]) {
            this.state[collection].push(item);
            if(collection === 'news' || collection === 'docs' || collection === 'work_entries') {
                this.state[collection].sort((a,b) => b.id - a.id);
            }
            this.save();
        }
    },
    addFirst(collection, item) {
        if (this.state[collection]) {
            this.state[collection].unshift(item);
            this.save();
        }
    },
    remove(collection, id) {
        if (this.state[collection]) {
            this.state[collection] = this.state[collection].filter(i => i.id !== id);
            this.save();
        }
    },
    get(collection) { return this.state[collection] || []; }
};