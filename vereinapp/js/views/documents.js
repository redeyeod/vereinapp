/**
 * =============================================================================
 * DOCUMENTS VIEW
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
        const allDocs = Store.state.docs;
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
        let tempId = currentFolderId;
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

        // Actions Toolbar (Responsive: Text auf Mobile ausgeblendet)
        const actionsToolbar = canManage ? `
            <div class="flex gap-2 shrink-0 ml-2 md:ml-4">
                <button onclick="DocsView.createFolder()" class="bg-dark-bg hover:bg-dark-hover text-white w-10 h-10 md:w-auto md:px-4 md:py-2 rounded-lg text-sm border border-dark-border transition-colors flex items-center justify-center" title="Neuer Ordner">
                    <i class="fa-solid fa-folder-plus md:mr-2"></i> <span class="hidden md:inline">Ordner</span>
                </button>
                <button onclick="DocsView.openAddModal()" class="bg-blue-600 hover:bg-blue-700 text-white w-10 h-10 md:w-auto md:px-4 md:py-2 rounded-lg text-sm font-bold transition-colors shadow-lg shadow-blue-900/30 flex items-center justify-center" title="Datei hochladen">
                    <i class="fa-solid fa-cloud-arrow-up md:mr-2"></i> <span class="hidden md:inline">Upload</span>
                </button>
            </div>
        ` : '';

        // Drag & Drop Attribute
        const getDragAttr = (id) => canManage ? `draggable="true" ondragstart="DocsView.dragStart(event, ${id})"` : '';
        const getDropAttr = (id) => canManage ? `ondragover="DocsView.allowDrop(event)" ondrop="DocsView.drop(event, ${id})"` : '';
        const parentDropAttr = (canManage && currentFolderId !== null) ? `ondragover="DocsView.allowDrop(event)" ondrop="DocsView.drop(event, ${parentFolderId})"` : '';
        const containerDropAttr = canManage ? `ondragover="DocsView.allowDrop(event)" ondrop="DocsView.drop(event, ${currentFolderId})"` : '';

        container.innerHTML = `
            <div class="flex flex-col h-full fade-in">
                <!-- Toolbar -->
                <div class="flex justify-between items-center mb-4 md:mb-6 pb-4 border-b border-dark-border">
                    <div class="flex items-center overflow-hidden min-w-0">
                        <!-- Zurück Pfeil -->
                        ${currentFolderId !== null ? `
                            <button onclick="DocsView.openFolder(${parentFolderId})" 
                                    ${parentDropAttr}
                                    class="mr-2 text-dark-muted hover:text-white p-2 rounded-full hover:bg-dark-hover transition-colors flex-shrink-0" 
                                    title="Ebene höher">
                                <i class="fa-solid fa-arrow-left"></i>
                            </button>
                            <div class="h-6 w-px bg-dark-border mr-3 flex-shrink-0"></div>
                        ` : ''}

                        <!-- Breadcrumbs -->
                        <div class="flex items-center text-sm text-dark-muted overflow-x-auto whitespace-nowrap custom-scrollbar pb-1">
                            <i class="fa-solid fa-hard-drive mr-2 text-blue-400"></i>
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
                <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 md:gap-4">
                    ${contents.length > 0 ? contents.map(d => {
                        const isFolder = d.type === 'folder';
                        
                        let iconClass = 'fa-file';
                        let colorClass = 'text-gray-400';
                        
                        if (isFolder) { iconClass = 'fa-folder'; colorClass = 'text-yellow-400'; } 
                        else if (d.type === 'PDF') { iconClass = 'fa-file-pdf'; colorClass = 'text-red-500'; } 
                        else if (d.type === 'DOC' || d.type === 'DOCX') { iconClass = 'fa-file-word'; colorClass = 'text-blue-500'; } 
                        else if (d.type === 'IMG') { iconClass = 'fa-file-image'; colorClass = 'text-purple-500'; } 
                        else if (d.type === 'XLS') { iconClass = 'fa-file-excel'; colorClass = 'text-green-500'; }

                        const clickAction = isFolder ? `onclick="DocsView.openFolder(${d.id})"` : '';
                        
                        // Action Menu nur für Admins
                        const actionMenu = canManage ? `
                            <div class="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-10 flex gap-1">
                                <button onclick="event.stopPropagation(); DocsView.renameItem(${d.id}, '${d.name}')" class="bg-dark-card/90 text-dark-muted hover:text-blue-400 p-1.5 rounded-md shadow-sm border border-dark-border" title="Umbenennen">
                                    <i class="fa-solid fa-pen text-xs"></i>
                                </button>
                                <button onclick="event.stopPropagation(); DocsView.delete(${d.id})" class="bg-dark-card/90 text-dark-muted hover:text-red-400 p-1.5 rounded-md shadow-sm border border-dark-border" title="Löschen">
                                    <i class="fa-regular fa-trash-can text-xs"></i>
                                </button>
                            </div>
                        ` : '';

                        return `
                        <div ${clickAction} ${getDragAttr(d.id)} ${isFolder ? getDropAttr(d.id) : ''} 
                             class="group relative flex flex-col items-center p-4 rounded-xl bg-dark-card border border-dark-border hover:border-blue-500/50 hover:bg-dark-hover/50 transition-all cursor-pointer shadow-sm select-none h-full justify-center min-h-[120px]">
                             
                             ${actionMenu}
                            
                             <i class="fa-solid ${iconClass} text-4xl md:text-5xl mb-3 drop-shadow-md ${colorClass} transition-transform group-hover:scale-110"></i>
                             <span class="text-xs md:text-sm text-center text-dark-text font-medium truncate w-full px-1">${d.name}</span>
                             <span class="text-[10px] text-dark-muted mt-1">${d.type}</span>
                        </div>
                        `;
                    }).join('') : 
                    
                    // Leerer Zustand
                    `<div class="col-span-full text-center py-16 text-dark-muted border border-dashed border-dark-border rounded-bubble flex flex-col items-center justify-center bg-dark-bg/20" 
                          ${containerDropAttr}>
                        <i class="fa-solid fa-folder-open text-4xl mb-3 opacity-30"></i>
                        <p class="text-sm">Dieser Ordner ist leer.</p>
                        ${canManage ? '<p class="text-xs mt-2 opacity-50">Dateien hierher ziehen (Simulation)</p>' : ''}
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
        if (draggedId === targetFolderId) return;

        const draggedItem = Store.state.docs.find(d => d.id === draggedId);
        
        if (draggedItem) {
            draggedItem.parentId = targetFolderId;
            Store.save();
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
        const name = prompt("Name des neuen Ordners:");
        if (name && name.trim() !== "") {
            const newFolder = {
                id: Date.now(),
                parentId: this.state.currentFolderId,
                name: name.trim(),
                type: 'folder',
                date: new Date().toISOString().split('T')[0]
            };
            Store.add('docs', newFolder);
            this.render(document.getElementById('content'));
            App.showToast('Ordner erstellt');
        }
    },

    renameItem(id, oldName) {
        if(!App.can('manage_docs')) return;
        const newName = prompt("Neuer Name:", oldName);
        if (newName && newName.trim() !== "" && newName !== oldName) {
            const index = Store.state.docs.findIndex(d => d.id === id);
            if (index !== -1) {
                Store.state.docs[index].name = newName.trim();
                Store.save();
                this.render(document.getElementById('content'));
                App.showToast('Umbenannt');
            }
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
            this.render(document.getElementById('content'));
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
                        <label class="block text-sm font-medium text-dark-muted mb-2">Dateiname</label>
                        <input type="text" name="name" placeholder="z.B. Protokoll_JHV_2024.pdf" required class="form-input">
                    </div>
                    
                    <div>
                        <label class="block text-sm font-medium text-dark-muted mb-2">Dateityp</label>
                        <select name="type" class="form-input cursor-pointer">
                            <option value="PDF">PDF Dokument</option>
                            <option value="DOC">Word Dokument</option>
                            <option value="XLS">Excel Tabelle</option>
                            <option value="IMG">Bild / Scan</option>
                        </select>
                    </div>
                    
                    <div class="border-2 border-dashed border-dark-border rounded-xl p-8 text-center text-dark-muted bg-dark-bg hover:border-blue-500 hover:text-blue-400 transition-colors cursor-pointer">
                        <i class="fa-solid fa-cloud-arrow-up text-3xl mb-2"></i>
                        <p class="text-sm">Datei hier ablegen oder klicken</p>
                    </div>
                    
                    <button type="submit" class="btn-primary w-full mt-2">Hochladen</button>
                </form>
            </div>
        `;
        App.openModal(html);
    },

    handleAdd(e) {
        e.preventDefault();
        const formData = new FormData(e.target);
        
        const newDoc = {
            id: Date.now(),
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