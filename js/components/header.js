class AppHeader extends HTMLElement {
    connectedCallback() {
        const currentPath = window.location.pathname.split("/").pop() || "index.html";

        this.innerHTML = `
            <header>
                <div class="nav-left">
                    <div class="logo" onclick="window.location.href='index.html'">🍁 Quebec Project</div>
                    <nav>
                        <a href="carte.html" class="${currentPath === 'carte.html' ? 'active' : ''}">🗺️ Carte Interactive</a>
                        <a href="carte-stats.html" class="${currentPath === 'carte-stats.html' ? 'active' : ''}">📊 Carte statistiques</a>
                        <a href="checklist.html" class="${currentPath === 'checklist.html' ? 'active' : ''}">📋 Mon Bloc-Notes</a>
                    </nav>
                </div>
            </header>
        `;
    }
}

customElements.define('app-header', AppHeader);