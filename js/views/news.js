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
            ? `<button onclick="NewsView.openAddModal()" class="bg-brand-600 hover:bg-brand-500 text-white px-4 py-2 rounded-xl text-sm font-bold transition-all shadow-lg shadow-brand-500/20 flex items-center hover:-translate-y-0.5">
                <i class="fa-solid fa-pen-to-square mr-2"></i> <span class="hidden sm:inline">Beitrag erstellen</span><span class="sm:hidden">Neu</span>
               </button>`
            : '';

        container.innerHTML = `
            <div class="fade-in pb-24 max-w-4xl mx-auto">
                <!-- Header Section -->
                <div class="flex justify-between items-end mb-8 px-2 md:px-0">
                    <div>
                        <h2 class="text-3xl font-bold text-white tracking-tight">Aktuelles</h2>
                        <p class="text-dark-muted text-sm mt-1">Neuigkeiten & Ankündigungen des Vereins.</p>
                    </div>
                    ${addButton}
                </div>

                <!-- News Grid -->
                <div class="space-y-6">
                    ${newsList.length > 0 ? newsList.map(n => this.renderNewsCard(n, canManage)).join('') : 
                    
                    // Leerer Zustand
                    `<div class="flex flex-col items-center justify-center py-24 text-center border border-dashed border-dark-border rounded-3xl bg-dark-card/30">
                        <div class="w-20 h-20 bg-dark-card rounded-full flex items-center justify-center mb-4 border border-dark-border shadow-inner">
                            <i class="fa-solid fa-newspaper text-3xl text-dark-muted/50"></i>
                        </div>
                        <h3 class="text-white font-bold text-lg mb-1">Keine Neuigkeiten</h3>
                        <p class="text-dark-muted text-sm">Aktuell gibt es keine Ankündigungen.</p>
                    </div>`
                    }
                </div>
            </div>
        `;
    },

    renderNewsCard(n, canManage) {
        const dateObj = new Date(n.date);
        const date = dateObj.toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: 'numeric' });
        const time = dateObj.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
        
        return `
            <div class="bg-dark-card rounded-2xl border border-dark-border p-6 shadow-sm relative group hover:border-brand-500/40 transition-all overflow-hidden">
                <!-- Decorative background gradient (subtle) -->
                <div class="absolute top-0 right-0 w-32 h-32 bg-brand-500/5 rounded-bl-full -mr-8 -mt-8 pointer-events-none transition-opacity opacity-50 group-hover:opacity-100"></div>

                <div class="flex flex-col md:flex-row gap-5 relative z-10">
                    
                    <!-- Icon / Date Box -->
                    <div class="flex flex-row md:flex-col items-center md:items-center gap-3 md:gap-1 text-dark-muted md:w-20 shrink-0 md:border-r border-dark-border/50 md:pr-5">
                        <div class="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-brand-500/10 text-brand-500 flex items-center justify-center text-xl md:text-2xl border border-brand-500/20 shadow-sm">
                            <i class="fa-solid fa-bullhorn"></i>
                        </div>
                        <div class="flex flex-col md:items-center md:text-center">
                            <span class="text-xs font-bold text-brand-400 md:hidden">Ankündigung</span>
                            <span class="text-xs font-medium md:mt-2 hidden md:block opacity-70">${date}</span>
                        </div>
                    </div>

                    <!-- Content Area -->
                    <div class="flex-1 min-w-0 pt-1">
                        <div class="flex justify-between items-start gap-4">
                            <div class="space-y-1">
                                <h3 class="text-xl md:text-2xl font-bold text-white leading-tight">${n.title}</h3>
                                <div class="flex items-center gap-2 text-xs text-dark-muted md:hidden">
                                    <i class="fa-regular fa-clock"></i> ${date}, ${time} Uhr
                                </div>
                            </div>
                            
                            <!-- Admin Actions (Desktop: visible on hover, Mobile: always visible but subtle) -->
                            ${canManage ? `
                            <button onclick="NewsView.delete(${n.id})" class="text-dark-muted hover:text-red-400 p-2 rounded-lg hover:bg-red-500/10 transition-colors flex-shrink-0" title="Löschen">
                                <i class="fa-regular fa-trash-can"></i>
                            </button>` : ''}
                        </div>

                        <div class="mt-4 text-gray-300 leading-relaxed text-sm md:text-base whitespace-pre-wrap font-light border-l-2 border-dark-border pl-4 ml-1">
                            ${n.content}
                        </div>
                    </div>
                </div>
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
            setTimeout(() => {
                const container = document.getElementById('content');
                if(container) this.render(container);
            }, 100);
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
                        <input type="text" name="title" required class="form-input text-lg font-bold" placeholder="Titel der Nachricht...">
                    </div>
                    
                    <div>
                        <label class="text-xs font-bold text-dark-muted uppercase mb-1 block">Inhalt</label>
                        <div class="relative">
                            <textarea name="content" rows="10" required class="form-input resize-none leading-relaxed" placeholder="Was gibt es Neues?"></textarea>
                            <div class="absolute bottom-2 right-2 text-xs text-dark-muted pointer-events-none opacity-50">Markdown supported</div>
                        </div>
                    </div>
                    
                    <div class="pt-2">
                        <button type="submit" class="btn-primary w-full shadow-lg shadow-brand-500/20 py-3 text-base">
                            Veröffentlichen
                        </button>
                    </div>
                </form>
            </div>
        `;
        App.openModal(html);
        const modalContainer = document.getElementById('modal-content');
        if(modalContainer) modalContainer.classList.add('max-h-[90vh]', 'overflow-y-auto', 'custom-scrollbar', 'md:max-w-2xl');
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
