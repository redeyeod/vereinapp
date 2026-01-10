/**
 * =============================================================================
 * NEWS VIEW (Clean & Mobile First)
 * Verwaltung der Ankündigungen und Neuigkeiten
 * =============================================================================
 */

const NewsView = {
    /**
     * Rendert die News-Ansicht
     * @param {HTMLElement} container 
     */
    render(container) {
        // News aus dem Store holen und sortieren (Neueste zuerst)
        const newsList = (Store.state.news || []).sort((a, b) => new Date(b.date) - new Date(a.date));
        
        // Berechtigungs-Check
        const canManage = App.can('manage_news');

        const addButton = canManage 
            ? `<button onclick="NewsView.openAddModal()" class="bg-brand-600 hover:bg-brand-500 text-white px-4 py-2 rounded-xl text-sm font-bold transition-all shadow-lg shadow-brand-500/20 flex items-center">
                <i class="fa-solid fa-pen-to-square mr-2"></i> <span class="hidden sm:inline">Beitrag erstellen</span><span class="sm:hidden">Neu</span>
               </button>`
            : '';

        container.innerHTML = `
            <div class="fade-in space-y-6 pb-20">
                <!-- Header -->
                <div class="flex justify-between items-end px-1">
                    <div>
                        <h2 class="text-2xl md:text-3xl font-bold text-white">Aktuelles</h2>
                        <p class="text-dark-muted text-sm mt-1">Neuigkeiten & Ankündigungen.</p>
                    </div>
                    ${addButton}
                </div>

                <!-- News Grid -->
                <div class="grid grid-cols-1 gap-4">
                    ${newsList.length > 0 ? newsList.map(n => this.renderNewsCard(n, canManage)).join('') : 
                    
                    // Leerer Zustand
                    `<div class="flex flex-col items-center justify-center py-20 text-center border border-dashed border-dark-border rounded-3xl bg-dark-bg/30">
                        <div class="w-16 h-16 bg-dark-card rounded-full flex items-center justify-center mb-4 border border-dark-border shadow-sm">
                            <i class="fa-solid fa-newspaper text-2xl text-dark-muted"></i>
                        </div>
                        <h3 class="text-white font-bold mb-1">Keine Neuigkeiten</h3>
                        <p class="text-dark-muted text-sm">Aktuell gibt es keine Ankündigungen.</p>
                    </div>`
                    }
                </div>
            </div>
        `;
    },

    renderNewsCard(n, canManage) {
        const date = new Date(n.date).toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: 'numeric' });
        
        return `
            <div class="bg-dark-card rounded-2xl border border-dark-border p-5 md:p-6 shadow-sm relative group hover:border-brand-500/30 transition-all flex flex-col md:flex-row gap-4 md:gap-6">
                
                <!-- Icon / Image Placeholder -->
                <div class="hidden md:flex w-16 h-16 rounded-xl bg-brand-500/10 text-brand-500 items-center justify-center text-2xl border border-brand-500/20 flex-shrink-0">
                    <i class="fa-solid fa-bullhorn"></i>
                </div>

                <div class="flex-1 min-w-0">
                    <!-- Header Mobile Icon + Title -->
                    <div class="flex items-start gap-3 mb-2">
                        <div class="md:hidden w-10 h-10 rounded-lg bg-brand-500/10 text-brand-500 flex items-center justify-center text-lg border border-brand-500/20 flex-shrink-0">
                            <i class="fa-solid fa-bullhorn"></i>
                        </div>
                        <div class="flex-1">
                            <div class="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-1">
                                <h4 class="text-lg md:text-xl font-bold text-white leading-tight break-words">${n.title}</h4>
                                <span class="text-[10px] uppercase font-bold text-dark-muted bg-dark-bg/50 px-2 py-1 rounded border border-dark-border self-start whitespace-nowrap">
                                    ${date}
                                </span>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Content -->
                    <div class="text-dark-muted leading-relaxed text-sm md:text-base whitespace-pre-wrap pl-1 md:pl-0">
                        ${n.content}
                    </div>
                </div>

                <!-- Admin Actions -->
                ${canManage ? `
                <div class="absolute top-4 right-4 md:static md:self-start opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onclick="NewsView.delete(${n.id})" class="text-dark-muted hover:text-red-400 p-2 rounded-lg hover:bg-red-500/10 border border-transparent hover:border-red-500/20 transition-all" title="Beitrag löschen">
                        <i class="fa-regular fa-trash-can"></i>
                    </button>
                </div>` : ''}
            </div>
        `;
    },

    /**
     * Löscht eine Ankündigung
     * @param {number} id 
     */
    async delete(id) {
        if(!App.can('manage_news')) return;

        if(confirm("Diesen Beitrag wirklich löschen?")) {
            await Store.remove('news', id);
            // Render wird durch Store.onUpdate getriggert, aber wir rufen es sicherheitshalber auf
            setTimeout(() => this.render(document.getElementById('content')), 100);
            App.showToast('Beitrag gelöscht');
        }
    },

    /**
     * Öffnet das Modal zum Erstellen einer neuen Ankündigung
     */
    openAddModal() {
        if(!App.can('manage_news')) return;

        const html = `
            <div class="p-6 md:p-8 max-h-[85vh] overflow-y-auto custom-scrollbar">
                <div class="flex justify-between items-center mb-6 border-b border-dark-border pb-4 sticky top-0 bg-dark-card z-10">
                    <h3 class="text-xl font-bold text-white">Neue Ankündigung</h3>
                    <button onclick="App.closeModal()" class="text-dark-muted hover:text-white p-2 transition-colors"><i class="fa-solid fa-times text-xl"></i></button>
                </div>
                
                <form onsubmit="NewsView.handleAdd(event)" class="space-y-6">
                    <div>
                        <label class="text-xs font-bold text-dark-muted uppercase mb-1 block">Titel</label>
                        <input type="text" name="title" required class="form-input" placeholder="Wichtige Info...">
                    </div>
                    
                    <div>
                        <label class="text-xs font-bold text-dark-muted uppercase mb-1 block">Inhalt</label>
                        <textarea name="content" rows="8" required class="form-input resize-none" placeholder="Schreiben Sie hier Ihren Text..."></textarea>
                    </div>
                    
                    <button type="submit" class="btn-primary w-full mt-2 shadow-lg shadow-brand-500/20">
                        Veröffentlichen
                    </button>
                </form>
            </div>
        `;
        App.openModal(html);
        const modalContainer = document.getElementById('modal-content');
        if(modalContainer) modalContainer.classList.add('max-h-[90vh]', 'overflow-y-auto', 'custom-scrollbar');
    },

    /**
     * Verarbeitet das Erstellen einer Ankündigung
     * @param {Event} e 
     */
    async handleAdd(e) {
        e.preventDefault();
        const fd = new FormData(e.target);
        
        const newNews = {
            title: fd.get('title'),
            content: fd.get('content'),
            date: new Date().toISOString()
        };
        
        // Fügt die News hinzu
        await Store.addFirst('news', newNews);
        
        App.closeModal();
        App.showToast('Ankündigung veröffentlicht');
        this.render(document.getElementById('content'));
    }
};

// WICHTIG: Global verfügbar machen für die neue App.js
window.NewsView = NewsView;
