/**
 * =============================================================================
 * NEWS VIEW
 * Verwaltung der Ankündigungen und Neuigkeiten
 * =============================================================================
 */

const NewsView = {
    /**
     * Rendert die News-Ansicht
     * @param {HTMLElement} container 
     */
    render(container) {
        // News aus dem Store holen
        const newsList = Store.state.news;
        
        // Berechtigungs-Check
        const canManage = App.can('manage_news');

        const addButton = canManage 
            ? `<button onclick="NewsView.openAddModal()" class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-bold transition-colors shadow-lg shadow-blue-900/30 flex items-center">
                <i class="fa-solid fa-pen-to-square mr-2"></i> <span class="hidden sm:inline">Beitrag erstellen</span><span class="sm:hidden">Neu</span>
               </button>`
            : '';

        container.innerHTML = `
            <div class="flex justify-between items-center mb-6">
                <h3 class="text-lg md:text-xl font-bold text-white">Aktuelles & Ankündigungen</h3>
                ${addButton}
            </div>

            <div class="space-y-4 md:space-y-6 fade-in">
                ${newsList.length > 0 ? newsList.map(n => `
                    <div class="bg-dark-card rounded-2xl border border-dark-border p-5 md:p-8 shadow-sm relative group hover:border-blue-500/30 transition-all">
                        
                        <!-- Löschen Button (erscheint bei Hover, nur für Admins) -->
                        ${canManage ? `
                        <button onclick="NewsView.delete(${n.id})" class="absolute top-4 right-4 text-dark-muted hover:text-red-400 p-2 rounded-lg hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-all" title="Beitrag löschen">
                            <i class="fa-regular fa-trash-can"></i>
                        </button>` : ''}
                        
                        <!-- Header mit Titel und Datum -->
                        <div class="flex flex-col sm:flex-row sm:justify-between sm:items-start mb-3 gap-2 pr-8">
                            <h4 class="text-xl md:text-2xl font-bold text-white leading-tight">${n.title}</h4>
                            <span class="text-xs text-dark-muted bg-dark-bg/50 px-3 py-1 rounded-full border border-dark-border whitespace-nowrap self-start sm:self-auto">
                                ${new Date(n.date).toLocaleDateString('de-DE')}
                            </span>
                        </div>
                        
                        <!-- Inhalt -->
                        <div class="text-dark-muted leading-relaxed text-sm md:text-base whitespace-pre-wrap pl-1 border-l-2 border-dark-border/50">
                            ${n.content}
                        </div>
                    </div>
                `).join('') : 
                
                // Leerer Zustand
                `<div class="text-center py-16 text-dark-muted border border-dashed border-dark-border rounded-2xl bg-dark-bg/20 flex flex-col items-center">
                    <i class="fa-solid fa-newspaper text-4xl mb-3 opacity-30"></i>
                    <p class="text-sm">Keine Ankündigungen vorhanden.</p>
                </div>`
                }
            </div>
        `;
    },

    /**
     * Löscht eine Ankündigung
     * @param {number} id 
     */
    delete(id) {
        if(!App.can('manage_news')) return;

        if(confirm("Diesen Beitrag wirklich löschen?")) {
            Store.remove('news', id);
            this.render(document.getElementById('content'));
            App.showToast('Beitrag gelöscht');
        }
    },

    /**
     * Öffnet das Modal zum Erstellen einer neuen Ankündigung
     */
    openAddModal() {
        if(!App.can('manage_news')) return;

        const html = `
            <div class="p-6 md:p-8">
                <div class="flex justify-between items-center mb-6 border-b border-dark-border pb-4">
                    <h3 class="text-xl font-bold text-white">Neue Ankündigung</h3>
                    <button onclick="App.closeModal()" class="text-dark-muted hover:text-white p-2 transition-colors"><i class="fa-solid fa-times text-xl"></i></button>
                </div>
                
                <form onsubmit="NewsView.handleAdd(event)" class="space-y-5">
                    <div>
                        <label class="block text-sm font-medium text-dark-muted mb-2">Titel</label>
                        <input type="text" name="title" required class="form-input" placeholder="Wichtige Info...">
                    </div>
                    
                    <div>
                        <label class="block text-sm font-medium text-dark-muted mb-2">Inhalt</label>
                        <textarea name="content" rows="6" required class="form-input" placeholder="Schreiben Sie hier Ihren Text..."></textarea>
                    </div>
                    
                    <button type="submit" class="btn-primary w-full mt-2">
                        Veröffentlichen
                    </button>
                </form>
            </div>
        `;
        App.openModal(html);
    },

    /**
     * Verarbeitet das Erstellen einer Ankündigung
     * @param {Event} e 
     */
    handleAdd(e) {
        e.preventDefault();
        const fd = new FormData(e.target);
        
        const newNews = {
            id: Date.now(),
            title: fd.get('title'),
            content: fd.get('content'),
            date: new Date().toISOString()
        };
        
        // Fügt die News am Anfang der Liste hinzu, damit sie oben erscheint
        Store.addFirst('news', newNews);
        
        App.closeModal();
        App.showToast('Ankündigung veröffentlicht');
        this.render(document.getElementById('content'));
    }
};