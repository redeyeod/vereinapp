/**
 * =============================================================================
 * STORE MODULE (Reactive v2.1 - Improved)
 * - Ein einziger Supabase Client (Singleton)
 * - Realtime lädt nur erlaubte Tabellen nach
 * - Besseres Error-Logging (zeigt auch Codes)
 * - Optional: Realtime an/aus schaltbar
 * =============================================================================
 */

let _supabase = null;

const Store = {
  clubId: "demo",

  // Nur diese Tabellen verwaltet der Store
  allowedTables: new Set(["members", "groups", "events", "news", "docs", "work_entries"]),

  // Realtime optional (falls du debuggen willst)
  realtimeEnabled: true,

  state: {
    members: [],
    groups: [],
    events: [],
    news: [],
    docs: [],
    work_entries: [],
    currentView: "dashboard",
  },

  // Callback: App kann hier rendern
  onUpdate: null,

  /**
   * Getter, damit andere Module (Views) den EINEN Client nutzen können
   * -> wichtig: NICHT in Views nochmal createClient() aufrufen
   */
  getClient() {
    return _supabase;
  },

  /**
   * Interne Helper: Standard-Fehlerausgabe
   */
  _logError(context, error) {
    if (!error) return;
    console.error(`[Store] ${context}:`, {
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint,
    });
    if (window.App?.showToast) {
      const code = error.code ? ` (${error.code})` : "";
      window.App.showToast(`DB Fehler: ${error.message}${code}`, "error");
    }
  },

  /**
   * Initialisierung
   */
  async init() {
    console.log("Store: Initialisierung...");

    if (typeof CONFIG === "undefined" || !CONFIG.SUPABASE_URL || !CONFIG.SUPABASE_KEY) {
      console.warn("Store: CONFIG fehlt (SUPABASE_URL / SUPABASE_KEY).");
      return;
    }

    try {
      const { createClient } = supabase;
      _supabase = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY);

      // Realtime abonnieren (nur erlaubte Tabellen)
      if (this.realtimeEnabled) {
        _supabase
          .channel("room1")
          .on("postgres_changes", { event: "*", schema: "public" }, (payload) => {
            const table = payload?.table;
            if (!table) return;

            // Nur Tabellen nachladen, die wir auch im Store verwalten
            if (!this.allowedTables.has(table)) return;

            console.log("Store: Echtzeit-Änderung erkannt:", table, payload.eventType);
            this.fetchTable(table); // bewusst ohne await, damit Realtime nicht blockiert
          })
          .subscribe((status) => {
            console.log("Store: Realtime Status:", status);
          });
      }

      // Initialer Load
      await this.loadAllData();
      console.log("Store: Alle Daten sind bereit.");
    } catch (err) {
      console.error("Store Init Fehler:", err);
    }
  },

  /**
   * Lädt alle Tabellen parallel
   */
  async loadAllData() {
    const tables = Array.from(this.allowedTables);
    await Promise.all(tables.map((t) => this.fetchTable(t)));
  },

  /**
   * Lädt eine Tabelle neu
   */
  async fetchTable(table) {
    if (!_supabase) return;
    if (!this.allowedTables.has(table)) return;

    const { data, error } = await _supabase.from(table).select("*");

    if (error) {
      this._logError(`fetchTable(${table})`, error);
      return;
    }

    this.state[table] = data || [];

    // UI informieren
    if (typeof this.onUpdate === "function") this.onUpdate(table);
  },

  // ===========================================================================
  // CRUD OPERATIONEN MIT SOFORT-UPDATE
  // ===========================================================================

  /**
   * INSERT
   * Hinweis: Wenn deine Tabellen UUIDs nutzen, lass "id" komplett weg.
   */
  async add(table, item) {
    if (!_supabase) return;
    if (!this.allowedTables.has(table)) return;

    const payload = { ...item };

    // ID-Fix: Wenn du bisher Date.now() (Number) genutzt hast, aber die DB UUID/Identity macht:
    // -> id entfernen, damit DB sie generiert.
    if (typeof payload.id === "number" && payload.id > 1000000000) delete payload.id;

    const { error } = await _supabase.from(table).insert(payload);

    if (error) {
      this._logError(`add(${table})`, error);
      return;
    }

    // Erzwungenes Update (falls Realtime mal hängt)
    await this.fetchTable(table);
    window.App?.showToast?.("Erfolgreich gespeichert", "success");
  },

  /**
   * UPDATE (by id)
   * Achtung: item muss eine id haben
   */
  async update(table, item) {
    if (!_supabase) return;
    if (!this.allowedTables.has(table)) return;

    if (!item || item.id === undefined || item.id === null) {
      console.warn(`[Store] update(${table}) ohne id`, item);
      window.App?.showToast?.("Update fehlgeschlagen: keine ID", "error");
      return;
    }

    // Optional: kein id-Feld im Update mitschicken (sauberer)
    const { id, ...payload } = item;

    const { error } = await _supabase.from(table).update(payload).eq("id", id);

    if (error) {
      this._logError(`update(${table})`, error);
      return;
    }

    await this.fetchTable(table);
    window.App?.showToast?.("Aktualisiert", "success");
  },

  /**
   * DELETE (by id)
   */
  async remove(table, id) {
    if (!_supabase) return;
    if (!this.allowedTables.has(table)) return;

    if (id === undefined || id === null) {
      console.warn(`[Store] remove(${table}) ohne id`, id);
      window.App?.showToast?.("Löschen fehlgeschlagen: keine ID", "error");
      return;
    }

    const { error } = await _supabase.from(table).delete().eq("id", id);

    if (error) {
      this._logError(`remove(${table})`, error);
      return;
    }

    await this.fetchTable(table);
    window.App?.showToast?.("Eintrag wurde entfernt", "success");
  },

  // Alias für Kompatibilität
  async addFirst(table, item) {
    await this.add(table, item);
  },
};

window.Store = Store;

