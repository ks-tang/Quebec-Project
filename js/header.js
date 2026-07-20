document.addEventListener("DOMContentLoaded", () => {
    const headerContainer = document.getElementById("header-container");
    
    if (headerContainer) {
        fetch("header.html")
            .then(response => {
                if (!response.ok) throw new Error("Erreur de chargement du header");
                return response.text();
            })
            .then(data => {
                headerContainer.innerHTML = data;

                // Gestion automatique du lien actif (class="active")
                const currentPath = window.location.pathname.split("/").pop() || "index.html";
                const navLinks = headerContainer.querySelectorAll("nav a");

                navLinks.forEach(link => {
                    if (link.getAttribute("href") === currentPath) {
                        link.classList.add("active");
                    }
                });
            })
            .catch(err => console.error("Impossible d'injecter le header :", err));
    }
});