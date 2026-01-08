/**
 * =============================================================================
 * DASHBOARD VIEW
 * =============================================================================
 */

const DashboardView = {
    render(container) {
        // Daten aus dem Store holen
        const membersCount = Store.state.members ? Store.state.members.length : 0;
        const user = App.state.currentUser || { firstName: 'Gast' };
        
        // HTML Template
        container.innerHTML = `
            <div class="fade-in space-y-8">
                <!-- Begrüßung -->
                <div class="flex flex-col md:flex-row justify-between items-end md:items-center gap-4">
                    <div>
                        <h2 class="text-3xl font-extrabold text-white tracking-tight">Hallo, ${user.firstName}! 👋</h2>
                        <p class="text-dark-muted mt-1">Hier ist der aktuelle Status deines Vereins.</p>
                    </div>
                    <div class="flex gap-2">
                        <button onclick="App.router('members')" class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-sm font-bold transition-colors shadow-lg shadow-blue-900/20">
                            <i class="fa-solid fa-plus mr-2"></i>Mitglied
                        </button>
                    </div>
                </div>

                <!-- KPI Karten -->
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <!-- Mitglieder Karte -->
                    <div onclick="App.router('members')" class="bubble-card p-6 rounded-bubble border border-dark-border cursor-pointer group relative overflow-hidden">
                        <div class="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                            <i class="fa-solid fa-users text-6xl text-blue-500"></i>
                        </div>
                        <div class="flex items-center justify-between mb-4 relative z-10">
                            <h3 class="text-lg font-bold text-white">Mitglieder</h3>
                            <span class="bg-blue-500/20 text-blue-400 text-xs font-bold px-2 py-1 rounded-full border border-blue-500/20">Gesamt</span>
                        </div>
                        <p class="text-4xl font-extrabold text-white relative z-10">${membersCount}</p>
                        <p class="text-sm text-dark-muted mt-2 relative z-10 group-hover:text-blue-400 transition-colors">Vereinsmitglieder verwalten &rarr;</p>
                    </div>

                    <!-- Finanzen Karte (Mockup) -->
                    <div class="bubble-card p-6 rounded-bubble border border-dark-border group relative overflow-hidden">
                        <div class="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                            <i class="fa-solid fa-euro-sign text-6xl text-green-500"></i>
                        </div>
                        <div class="flex items-center justify-between mb-4 relative z-10">
                            <h3 class="text-lg font-bold text-white">Finanzen</h3>
                            <span class="bg-green-500/20 text-green-400 text-xs font-bold px-2 py-1 rounded-full border border-green-500/20">Stabil</span>
                        </div>
                        <p class="text-4xl font-extrabold text-white relative z-10">€ 12.450</p>
                        <p class="text-sm text-dark-muted mt-2 relative z-10">Aktueller Kontostand</p>
                    </div>

                    <!-- Aufgaben Karte -->
                    <div class="bubble-card p-6 rounded-bubble border border-dark-border group relative overflow-hidden">
                        <div class="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                            <i class="fa-solid fa-list-check text-6xl text-orange-500"></i>
                        </div>
                        <div class="flex items-center justify-between mb-4 relative z-10">
                            <h3 class="text-lg font-bold text-white">Aufgaben</h3>
                            <span class="bg-orange-500/20 text-orange-400 text-xs font-bold px-2 py-1 rounded-full border border-orange-500/20">3 Offen</span>
                        </div>
                        <p class="text-4xl font-extrabold text-white relative z-10">3</p>
                        <p class="text-sm text-dark-muted mt-2 relative z-10">Nächste: Vorstandssitzung Planen</p>
                    </div>
                </div>

                <!-- Schnellzugriff / Grid -->
                <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
                    ${this.renderQuickAction('workhours', 'fa-briefcase', 'Stunden', 'bg-purple-500')}
                    ${this.renderQuickAction('messenger', 'fa-comments', 'Chat', 'bg-pink-500')}
                    ${this.renderQuickAction('documents', 'fa-folder-open', 'Dateien', 'bg-yellow-500')}
                    ${this.renderQuickAction('calendar', 'fa-calendar-days', 'Termine', 'bg-teal-500')}
                </div>
            </div>
        `;
    },

    renderQuickAction(route, icon, label, colorClass) {
        return `
            <button onclick="App.router('${route}')" class="p-4 bg-dark-card border border-dark-border rounded-xl hover:bg-dark-hover transition-all flex flex-col items-center gap-3 group">
                <div class="w-12 h-12 rounded-full ${colorClass}/20 flex items-center justify-center text-${colorClass.replace('bg-', '')} group-hover:scale-110 transition-transform">
                    <i class="fa-solid ${icon} text-xl"></i>
                </div>
                <span class="text-sm font-bold text-dark-text">${label}</span>
            </button>
        `;
    }
};

// WICHTIG: Global verfügbar machen für die neue App.js
window.DashboardView = DashboardView;
