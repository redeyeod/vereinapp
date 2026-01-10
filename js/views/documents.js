/**
 * =============================================================================
 * DOCUMENTS VIEW (Clean & Mobile First)
 * Verwaltung der Vereinsdokumente mit Ordnerstruktur und Drag & Drop
 * =============================================================================
 */

const DocsView = {
    // Lokaler State für Navigation
    state: {
        currentFolderId: null
    },

    /**
     * Rendert die Dokumenten-Ansicht
     * @param {HTMLElement} container 
     */
    render(container) {
        // Sicherheits-Check
        const allDocs = Store.state.docs || [];
        const currentFolderId = this.state.currentFolderId;

        // Inhalte filtern: Nur Items anzeigen, die im aktuellen Ordner liegen
        const contents = allDocs.filter(d => {
            if (currentFolderId === null) return !d.parentId;
            return d.parentId === currentFolderId;
        }).sort((a, b) => {
            if (a.type === 'folder' && b.type !== 'folder') return -1;
            if (a.type !== 'folder' && b.type === 'folder') return 1;
            return a.name.localeCompare(b.name);
        });

        // Breadcrumbs & Parent ID ermitteln
        let breadcrumbs = [{ id: null, name: 'Home' }];
        let parentFolderId = null; 
        
        if (currentFolderId !== null) {
            const currentFolderObj = allDocs.find(d => d.id === currentFolderId);
            if (currentFolderObj) {
                parentFolderId = currentFolderObj.parentId; 
            }
        }

        let safeGuard = 0;
        const path = [];
        let walkerId = currentFolderId;
        while (walkerId && safeGuard < 50) {
            const folder = allDocs.find(d => d.id === walkerId);
            if (folder) {
                path.unshift({ id: folder.id, name: folder.name });
                walkerId = folder.parentId;
            } else {
                walkerId = null;
            }
            safeGuard++;
        }
        breadcrumbs = [...breadcrumbs, ...path];

        // --- BERECHTIGUNGS-CHECK ---
        const canManage = App.can('manage_docs');

        // Actions Toolbar
        const actionsToolbar = canManage ? `
            <div class="flex gap-2 shrink-0 ml-4">
                <button onclick="DocsView.createFolder()" class="bg-dark-card hover:bg-dark-hover text-dark-muted hover:text-white w-10 h-10 md:w-auto md:px-4 md:py-2 rounded-xl text-sm border border-dark-border transition-all flex items-center justify-center shadow-sm">
                    <i class="fa-solid fa-folder-plus md:mr-2"></i> <span class="hidden md:inline">Ordner</span>
                </button>
                <button onclick="DocsView.openAddModal()" class="bg-brand-600 hover:bg-brand-500 text-white w-10 h-10 md:w-auto md:px-4 md:py-2 rounded-xl text-sm font-bold transition-all shadow-lg shadow-brand-500/20 flex items-center justify-center">
                    <i class="fa-solid fa-cloud-arrow-up md:mr-2"></i> <span class="hidden md:inline">Upload</span>
                </button>
            </div>
        ` : '';

        // Drag & Drop Attribute Helper
        const getDragAttr = (id) => canManage ? `draggable="true" ondragstart="DocsView.dragStart(event, ${id})"` : '';
        const getDropAttr = (id) => canManage ? `ondragover="DocsView.allowDrop(event)" ondrop="DocsView.drop(event, ${id})"` : '';
        const parentDropAttr = (canManage && currentFolderId !== null) ? `ondragover="DocsView.allowDrop(event)" ondrop="DocsView.drop(event, ${parentFolderId})"` : '';
        const containerDropAttr = canManage ? `ondragover="DocsView.allowDrop(event)" ondrop="DocsView.drop(event, ${currentFolderId})"` : '';

        container.innerHTML = `
            <div class="flex flex-col h-full fade-in pb-20">
                <!-- Toolbar -->
                <div class="flex justify-between items-center mb-6 pb-4 border-b border-dark-border sticky top-0 bg-dark-bg/95 backdrop-blur-sm z-20 pt-1">
                    <div class="flex items-center overflow-hidden min-w-0">
                        <!-- Zurück Pfeil -->
                        ${currentFolderId !== null ? `
                            <button onclick="DocsView.openFolder(${parentFolderId})" 
                                    ${parentDropAttr}
                                    class="mr-3 text-dark-muted hover:text-white p-2 rounded-xl hover:bg-dark-card border border-transparent hover:border-dark-border transition-all flex-shrink-0" 
                                    title="Ebene höher">
                                <i class="fa-solid fa-arrow-left"></i>
                            </button>
                            <div class="h-6 w-px bg-dark-border mr-3 flex-shrink-0 hidden sm:block"></div>
                        ` : ''}

                        <!-- Breadcrumbs -->
                        <div class="flex items-center text-sm text-dark-muted overflow-x-auto whitespace-nowrap custom-scrollbar pb-1 mask-linear-fade">
                            ${currentFolderId === null ? '<i class="fa-solid fa-hard-drive mr-2 text-brand-500"></i>' : ''}
                            ${breadcrumbs.map((b, idx) => `
                                <span onclick="DocsView.openFolder(${b.id === null ? 'null' : b.id})" 
                                    ${(canManage && b.id !== currentFolderId) ? `ondragover="DocsView.allowDrop(event)" ondrop="DocsView.drop(event, ${b.id})"` : ''}
                                    class="cursor-pointer hover:text-white hover:underline transition-colors ${idx === breadcrumbs.length - 1 ? 'font-bold text-white' : ''}">
                                    ${b.name}
                                </span>
                                ${idx < breadcrumbs.length - 1 ? '<i class="fa-solid fa-chevron-right text-[10px] mx-2 opacity-50"></i>' : ''}
                            `).join('')}
                        </div>
                    </div>

                    <!-- Actions -->
                    ${actionsToolbar}
                </div>

                <!-- Grid View -->
                <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 md:gap-4 flex-1 content-start">
                    ${contents.length > 0 ? contents.map(d => {
                        const isFolder = d.type === 'folder';
                        
                        let iconClass = 'fa-file';
                        let colorClass = 'text-gray-400';
                        let bgClass = 'bg-dark-card';
                        
                        if (isFolder) { iconClass = 'fa-folder'; colorClass = 'text-amber-400'; bgClass = 'bg-dark-card'; } 
                        else if (d.type === 'PDF') { iconClass = 'fa-file-pdf'; colorClass = 'text-red-500'; } 
                        else if (d.type === 'DOC' || d.type === 'DOCX') { iconClass = 'fa-file-word'; colorClass = 'text-blue-500'; } 
                        else if (d.type === 'IMG') { iconClass = 'fa-file-image'; colorClass = 'text-purple-500'; } 
                        else if (d.type === 'XLS') { iconClass = 'fa-file-excel'; colorClass = 'text-emerald-500'; }

                        const clickAction = isFolder ? `onclick="DocsView.openFolder(${d.id})"` : '';
                        
                        // Action Menu nur für Admins
                        const actionMenu = canManage ? `
                            <div class="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-10 flex gap-1 bg-dark-bg/80 backdrop-blur-sm rounded-lg p-1 border border-dark-border shadow-lg">
                                <button onclick="event.stopPropagation(); DocsView.renameItem(${d.id}, '${d.name}')" class="text-dark-muted hover:text-blue-400 p-1.5 rounded hover:bg-white/5" title="Umbenennen">
                                    <i class="fa-solid fa-pen text-xs"></i>
                                </button>
                                <button onclick="event.stopPropagation(); DocsView.delete(${d.id})" class="text-dark-muted hover:text-red-400 p-1.5 rounded hover:bg-white/5" title="Löschen">
                                    <i class="fa-regular fa-trash-can text-xs"></i>
                                </button>
                            </div>
                        ` : '';

                        return `
                        <div ${clickAction} ${getDragAttr(d.id)} ${isFolder ? getDropAttr(d.id) : ''} 
                             class="group relative flex flex-col items-center p-5 rounded-2xl ${bgClass} border border-dark-border hover:border-brand-500/50 hover:shadow-lg transition-all cursor-pointer select-none aspect-square justify-center">
                             
                             ${actionMenu}
                            
                             <i class="fa-solid ${iconClass} text-4xl md:text-5xl mb-4 drop-shadow-md ${colorClass} transition-transform group-hover:scale-110"></i>
                             <span class="text-xs md:text-sm text-center text-white font-medium truncate w-full px-1">${d.name}</span>
                             ${!isFolder ? `<span class="text-[10px] text-dark-muted mt-1 uppercase tracking-wider">${d.type}</span>` : ''}
                        </div>
                        `;
                    }).join('') : 
                    
                    // Leerer Zustand
                    `<div class="col-span-full py-20 text-center text-dark-muted border border-dashed border-dark-border rounded-3xl bg-dark-bg/30 flex flex-col items-center justify-center min-h-[300px]" 
                          ${containerDropAttr}>
                        <div class="w-16 h-16 bg-dark-card rounded-full flex items-center justify-center mb-4 border border-dark-border">
                            <i class="fa-solid fa-folder-open text-3xl opacity-30"></i>
                        </div>
                        <h3 class="text-white font-bold mb-1">Dieser Ordner ist leer</h3>
                        <p class="text-sm">Keine Dateien gefunden.</p>
                        ${canManage ? '<p class="text-xs mt-4 opacity-50 bg-dark-bg px-3 py-1 rounded-full border border-dark-border">Tipp: Drag & Drop wird unterstützt</p>' : ''}
                    </div>`
                    }
                </div>
            </div>
        `;
    },

    // --- Drag & Drop Handler ---

    dragStart(ev, id) {
        if(!App.can('manage_docs')) return;
        ev.dataTransfer.setData("text/plain", id);
        ev.dataTransfer.effectAllowed = "move";
    },

    allowDrop(ev) {
        if(!App.can('manage_docs')) return;
        ev.preventDefault();
        ev.dataTransfer.dropEffect = "move";
    },

    drop(ev, targetFolderId) {
        if(!App.can('manage_docs')) return;
        ev.preventDefault();
        ev.stopPropagation();

        const draggedId = parseInt(ev.dataTransfer.getData("text/plain"));
        // Verhindern, dass man einen Ordner in sich selbst zieht
        if (draggedId === targetFolderId) return;

        const draggedItem = Store.state.docs.find(d => d.id === draggedId);
        
        if (draggedItem) {
            // Update via Store
            const updatedItem = { ...draggedItem, parentId: targetFolderId };
            
            // Simuliertes Update (in echt DB Call)
            Store.update('docs', updatedItem);
            
            // Lokales Update
            const index = Store.state.docs.indexOf(draggedItem);
            if(index !== -1) Store.state.docs[index] = updatedItem;

            this.render(document.getElementById('content'));
            App.showToast(`"${draggedItem.name}" verschoben`);
        }
    },

    // --- Navigation & Actions ---

    openFolder(folderId) {
        this.state.currentFolderId = folderId;
        this.render(document.getElementById('content'));
    },

    createFolder() {
        if(!App.can('manage_docs')) return;
        
        const html = `
            <div class="p-6">
                <div class="flex justify-between items-center mb-6 border-b border-dark-border pb-4">
                    <h3 class="text-xl font-bold text-white">Neuer Ordner</h3>
                    <button onclick="App.closeModal()" class="text-dark-muted hover:text-white p-2"><i class="fa-solid fa-times text-xl"></i></button>
                </div>
                <form onsubmit="DocsView.handleCreateFolder(event)">
                    <div>
                        <label class="text-xs font-bold text-dark-muted uppercase mb-1 block">Ordnername</label>
                        <input type="text" name="folderName" class="form-input" placeholder="z.B. Protokolle" required autofocus>
                    </div>
                    <button type="submit" class="btn-primary w-full mt-6">Erstellen</button>
                </form>
            </div>
        `;
        App.openModal(html);
    },

    handleCreateFolder(e) {
        e.preventDefault();
        const name = new FormData(e.target).get('folderName');
        if (name && name.trim() !== "") {
            const newFolder = {
                id: Date.now(),
                parentId: this.state.currentFolderId,
                name: name.trim(),
                type: 'folder',
                date: new Date().toISOString().split('T')[0]
            };
            Store.add('docs', newFolder);
            App.closeModal();
            this.render(document.getElementById('content'));
            App.showToast('Ordner erstellt');
        }
    },

    renameItem(id, oldName) {
        if(!App.can('manage_docs')) return;
        
        const html = `
            <div class="p-6">
                <div class="flex justify-between items-center mb-6 border-b border-dark-border pb-4">
                    <h3 class="text-xl font-bold text-white">Umbenennen</h3>
                    <button onclick="App.closeModal()" class="text-dark-muted hover:text-white p-2"><i class="fa-solid fa-times text-xl"></i></button>
                </div>
                <form onsubmit="DocsView.handleRename(event, ${id})">
                    <div>
                        <label class="text-xs font-bold text-dark-muted uppercase mb-1 block">Neuer Name</label>
                        <input type="text" name="newName" class="form-input" value="${oldName}" required autofocus>
                    </div>
                    <button type="submit" class="btn-primary w-full mt-6">Speichern</button>
                </form>
            </div>
        `;
        App.openModal(html);
    },

    handleRename(e, id) {
        e.preventDefault();
        const newName = new FormData(e.target).get('newName');
        
        const item = Store.state.docs.find(d => d.id === id);
        if (item && newName && newName.trim() !== "" && newName !== item.name) {
            const updatedItem = { ...item, name: newName.trim() };
            Store.update('docs', updatedItem);
            
            // Lokal
            const index = Store.state.docs.indexOf(item);
            if(index !== -1) Store.state.docs[index] = updatedItem;

            App.closeModal();
            this.render(document.getElementById('content'));
            App.showToast('Umbenannt');
        }
    },

    delete(id) {
        if(!App.can('manage_docs')) return;
        const item = Store.state.docs.find(d => d.id === id);
        if(!item) return;

        const isFolder = item.type === 'folder';
        const msg = isFolder 
            ? "Möchtest du diesen Ordner und seinen gesamten Inhalt wirklich löschen?" 
            : "Möchtest du dieses Dokument wirklich löschen?";

        if(confirm(msg)) {
            if(isFolder) {
                const children = Store.state.docs.filter(d => d.parentId === id);
                if (children.length > 0) {
                    children.forEach(child => Store.remove('docs', child.id));
                }
            }
            Store.remove('docs', id);
            setTimeout(() => this.render(document.getElementById('content')), 100);
            App.showToast('Gelöscht');
        }
    },

    openAddModal() {
        if(!App.can('manage_docs')) return;
        const html = `
            <div class="p-6">
                <div class="flex justify-between items-center mb-6 border-b border-dark-border pb-4">
                    <h3 class="text-xl font-bold text-white">Dokument hochladen</h3>
                    <button onclick="App.closeModal()" class="text-dark-muted hover:text-white p-2 transition-colors"><i class="fa-solid fa-times text-xl"></i></button>
                </div>
                
                <form onsubmit="DocsView.handleAdd(event)" class="space-y-4">
                      <div>
                        <label class="text-xs font-bold text-dark-muted uppercase mb-1 block">Dateiname</label>
                        <input type="text" name="name" placeholder="z.B. Protokoll_JHV_2024.pdf" required class="form-input">
                    </div>
                    
                    <div>
                        <label class="text-xs font-bold text-dark-muted uppercase mb-1 block">Dateityp</label>
                        <select name="type" class="form-input cursor-pointer">
                            <option value="PDF">PDF Dokument</option>
                            <option value="DOC">Word Dokument</option>
                            <option value="XLS">Excel Tabelle</option>
                            <option value="IMG">Bild / Scan</option>
                        </select>
                    </div>
                    
                    <div class="border-2 border-dashed border-dark-border rounded-xl p-8 text-center text-dark-muted bg-dark-bg hover:border-brand-500 hover:text-brand-400 transition-colors cursor-pointer mt-4">
                        <i class="fa-solid fa-cloud-arrow-up text-3xl mb-2"></i>
                        <p class="text-sm">Datei hier ablegen oder klicken</p>
                    </div>
                    
                    <button type="submit" class="btn-primary w-full mt-6">Hochladen</button>
                </form>
            </div>
        `;
        App.openModal(html);
    },

    handleAdd(e) {
        e.preventDefault();
        const formData = new FormData(e.target);
        
        const newDoc = {
            parentId: this.state.currentFolderId,
            name: formData.get('name'),
            type: formData.get('type'),
            date: new Date().toISOString().split('T')[0]
        };
        
        Store.add('docs', newDoc);
        App.closeModal();
        App.showToast('Dokument erfolgreich hochgeladen');
        this.render(document.getElementById('content'));
    }
};

window.DocsView = DocsView;
