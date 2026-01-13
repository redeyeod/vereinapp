<!DOCTYPE html>
<html lang="de" class="dark">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title>VereinsManager</title>
    
    <!-- Scripts -->
    <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
    <script src="https://cdn.tailwindcss.com"></script>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
    
    <script>
        tailwind.config = {
            darkMode: 'class',
            theme: {
                extend: {
                    fontFamily: { sans: ['"Plus Jakarta Sans"', 'sans-serif'] },
                    colors: {
                        dark: { bg: '#0f172a', card: '#1e293b', hover: '#334155', border: '#334155', text: '#f8fafc', muted: '#94a3b8' },
                        brand: { 500: '#3b82f6', 600: '#2563eb' }
                    }
                }
            }
        }
    </script>
    
    <style>
        body { font-family: 'Plus Jakarta Sans', sans-serif; -webkit-tap-highlight-color: transparent; }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-thumb { background: #334155; border-radius: 10px; }
        .glass { background: rgba(30, 41, 59, 0.7); backdrop-filter: blur(12px); border: 1px solid rgba(255, 255, 255, 0.05); }
        .fade-in { animation: fadeIn 0.3s ease-out forwards; }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        .safe-bottom { padding-bottom: env(safe-area-inset-bottom); }
        #toast { visibility: hidden; position: fixed; bottom: 80px; left: 50%; transform: translateX(-50%); background: #1e293b; color: white; padding: 10px 20px; border-radius: 50px; opacity: 0; transition: opacity 0.3s; z-index: 100; border: 1px solid #334155; }
        #toast.show { visibility: visible; opacity: 1; }
    </style>
</head>
<body class="bg-dark-bg text-dark-text antialiased overflow-hidden selection:bg-brand-500/30">

    <!-- LOGIN -->
    <div id="auth-view" class="h-screen w-full flex items-center justify-center p-4 relative overflow-hidden">
        <div class="relative z-10 w-full max-w-sm glass p-8 rounded-2xl shadow-2xl">
            <h1 class="text-2xl font-bold text-white text-center mb-6">Login</h1>
            <form onsubmit="App.handleLogin(event)" class="space-y-4">
                <input type="email" name="email" required placeholder="Email" class="w-full bg-dark-bg/50 border border-dark-border rounded-xl px-4 py-3 text-white focus:outline-none focus:border-brand-500">
                <input type="password" name="password" required placeholder="Passwort" class="w-full bg-dark-bg/50 border border-dark-border rounded-xl px-4 py-3 text-white focus:outline-none focus:border-brand-500">
                <button type="submit" class="w-full bg-brand-600 hover:bg-brand-500 text-white font-bold py-3 rounded-xl transition-all">Anmelden</button>
            </form>
            <div id="login-error" class="text-red-400 text-xs text-center mt-4 hidden"></div>
        </div>
    </div>

    <!-- MAIN APP -->
    <div id="app-view" class="h-screen flex flex-col overflow-hidden hidden">
        
        <!-- HEADER (Desktop Only / Mobile controlled via JS) -->
        <header id="main-header" class="h-16 md:h-20 bg-dark-card/90 backdrop-blur-xl border-b border-dark-border flex items-center justify-between px-4 md:px-8 z-30 sticky top-0 transition-transform duration-300">
            <button onclick="App.router('dashboard')" class="flex items-center gap-3">
                <div class="w-9 h-9 rounded-lg bg-gradient-to-tr from-brand-600 to-brand-500 flex items-center justify-center text-white"><i class="fa-solid fa-users-rectangle"></i></div>
                <h1 class="text-lg font-bold text-white hidden sm:block">VereinApp</h1>
            </button>
            
            <nav class="hidden md:flex items-center gap-1 bg-dark-bg/50 p-1 rounded-full border border-white/5">
                <button onclick="App.router('dashboard')" class="px-4 py-2 rounded-full text-dark-muted hover:text-white transition-colors"><i class="fa-solid fa-house"></i></button>
                <button onclick="App.router('members')" class="px-4 py-2 rounded-full text-dark-muted hover:text-white transition-colors"><i class="fa-solid fa-users"></i></button>
                <button onclick="App.router('messenger')" class="px-4 py-2 rounded-full text-dark-muted hover:text-white transition-colors"><i class="fa-solid fa-comments"></i></button>
            </nav>

            <div class="flex items-center gap-4">
                <button onclick="App.router('profile')" class="hidden md:flex items-center gap-3 text-right group">
                    <div><p id="current-user-name" class="text-sm font-bold text-white">User</p><p id="current-user-role" class="text-[10px] text-dark-muted uppercase">Rolle</p></div>
                    <div class="w-9 h-9 rounded-full bg-dark-hover flex items-center justify-center border border-transparent group-hover:border-brand-500 transition-all"><i class="fa-solid fa-user text-dark-muted"></i></div>
                </button>
                <button onclick="App.toggleMobileMenu()" class="md:hidden text-white text-xl p-2"><i class="fa-solid fa-bars"></i></button>
            </div>
        </header>

        <!-- CONTENT -->
        <main id="content" class="flex-1 overflow-y-auto overflow-x-hidden p-4 md:p-8 scroll-smooth w-full relative">
            <!-- Dynamic Content -->
        </main>

        <!-- MOBILE BOTTOM FOOTER (NEW) -->
        <div id="mobile-bottom-nav" class="md:hidden fixed bottom-0 left-0 w-full h-16 bg-dark-card border-t border-dark-border flex items-center justify-around z-50 pb-safe shadow-2xl">
            <!-- App Button: Loads Dashboard or last App view -->
            <button id="footer-btn-app" onclick="App.router('dashboard')" class="flex flex-col items-center justify-center w-full h-full text-brand-500 transition-colors">
                <i class="fa-solid fa-layer-group text-xl mb-1"></i>
                <span class="text-[10px] font-bold uppercase tracking-wider">App</span>
            </button>
            
            <!-- Chat Button: Loads Messenger -->
            <button id="footer-btn-chat" onclick="App.router('messenger')" class="flex flex-col items-center justify-center w-full h-full text-dark-muted hover:text-white transition-colors">
                <i class="fa-solid fa-comments text-xl mb-1"></i>
                <span class="text-[10px] font-bold uppercase tracking-wider">Chat</span>
            </button>
        </div>

        <!-- Mobile Menu Drawer (Overlay) -->
        <div id="mobile-menu" class="fixed inset-0 z-[60] pointer-events-none">
            <div id="mobile-menu-backdrop" onclick="App.toggleMobileMenu()" class="absolute inset-0 bg-black/80 opacity-0 transition-opacity duration-300"></div>
            <div id="mobile-menu-drawer" class="absolute right-0 top-0 h-full w-[80%] bg-dark-bg border-l border-dark-border transform translate-x-full transition-transform duration-300 pointer-events-auto flex flex-col p-4">
                <div class="flex justify-end mb-6"><button onclick="App.toggleMobileMenu()" class="p-2 text-white"><i class="fa-solid fa-times text-xl"></i></button></div>
                <div class="space-y-4">
                    <button onclick="App.router('profile')" class="flex items-center gap-3 p-3 bg-dark-card rounded-xl border border-dark-border w-full"><i class="fa-solid fa-user text-brand-500"></i> <span class="text-white font-bold">Mein Profil</span></button>
                    <div class="h-px bg-dark-border"></div>
                    <button onclick="App.router('dashboard')" class="block w-full text-left p-2 text-dark-muted hover:text-white">Dashboard</button>
                    <button onclick="App.router('members')" class="block w-full text-left p-2 text-dark-muted hover:text-white">Mitglieder</button>
                    <button onclick="App.router('groups')" class="block w-full text-left p-2 text-dark-muted hover:text-white">Gruppen</button>
                    <button onclick="App.logout()" class="block w-full text-left p-2 text-red-400 mt-4">Abmelden</button>
                </div>
            </div>
        </div>

    </div>

    <!-- Modals & Toasts -->
    <div id="modal-overlay" class="fixed inset-0 bg-black/80 backdrop-blur-sm z-[70] hidden flex items-center justify-center p-4">
        <div class="glass border border-white/10 rounded-2xl shadow-2xl w-full max-w-md p-0 opacity-0 transition-all transform scale-95" id="modal-content"></div>
    </div>
    <div id="toast"></div>

    <!-- Load Scripts -->
    <script src="js/config.js"></script>
    <script src="js/store.js"></script>
    <script src="js/views/dashboard.js"></script>
    <script src="js/views/members.js"></script>
    <script src="js/views/groups.js"></script>
    <script src="js/views/calendar.js"></script>
    <script src="js/views/news.js"></script>
    <script src="js/views/documents.js"></script>
    <script src="js/views/messenger.js"></script>
    <script src="js/views/profile.js"></script>
    <script src="js/views/workhours.js"></script>
    <script src="js/views/admin_roles.js"></script>
    <script src="js/app.js"></script>
</body>
</html>
