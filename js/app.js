// Variables globales
var map;
var mapInitialized = false;

// --- FONCTION DE NAVIGATION (Changement de page) ---
function switchPage(pageId) {
    // 1. Mettre à jour visuellement le menu (si un lien actif existe)
    document.querySelectorAll('nav a').forEach(link => link.classList.remove('active'));
    
    var activeLink = document.getElementById('link-' + pageId);
    if (activeLink) {
        activeLink.classList.add('active');
    }

    // 2. Afficher/Masquer les sections
    if (pageId === 'accueil') {
        document.getElementById('page-accueil').classList.remove('hidden');
        document.getElementById('page-carte').classList.add('hidden');
    } else if (pageId === 'carte') {
        document.getElementById('page-accueil').classList.add('hidden');
        document.getElementById('page-carte').classList.remove('hidden');
        
        // Initialiser la carte au premier clic
        if (!mapInitialized) {
            initMap();
        }
    }
}

// --- GÉNÉRATEUR DE PIN CARTE EN SVG (Couleur personnalisable) ---
function createCustomMarker(color) {
    // Design moderne d'une épingle de carte (Pin) en SVG
    const svgTemplate = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="32" height="32">
            <!-- Ombre du marqueur -->
            <ellipse cx="12" cy="22" rx="4" ry="1.5" fill="rgba(0, 0, 0, 0.2)" />
            <!-- Forme du Pin avec couleur dynamique -->
            <path fill="${color}" stroke="#ffffff" stroke-width="1.5" 
                  d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
        </svg>
    `;

    return L.divIcon({
        html: svgTemplate,
        className: 'custom-svg-marker', // Classe CSS vide pour éviter les styles par défaut de Leaflet
        iconSize: [32, 32],
        iconAnchor: [16, 32],      // Pointe de l'épingle
        popupAnchor: [0, -32]      // Position du popup au-dessus du pin
    });
}

// --- INITIALISATION DE LA CARTE ---
function initMap() {
    // Initialisation centrée sur Québec
    map = L.map('map').setView([46.8139, -71.2080], 12);

    // Fond de carte élégant et sobre (CartoDB Voyager)
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        attribution: '© OpenStreetMap contributors © CARTO',
        subdomains: 'abcd',
        maxZoom: 20
    }).addTo(map);

    // --- CHARGEMENT DU GEOJSON DES QUARTIERS ---
    fetch('data/vdq-quartier.geojson')
        .then(response => {
            if (!response.ok) throw new Error("Erreur de chargement du GeoJSON");
            return response.json();
        })
        .then(geojsonData => {
            L.geoJSON(geojsonData, {
                style: function (feature) {
                    return {
                        color: "#2c3e50",      // Couleur des bordures des quartiers
                        weight: 1.5,
                        opacity: 0.6,
                        fillColor: "#34495e",  
                        fillOpacity: 0.05      // Presque transparent pour bien voir les rues
                    };
                },
                onEachFeature: function (feature, layer) {
                    if (feature.properties && feature.properties.NOM) {
                        layer.bindPopup("<b>Quartier :</b> " + feature.properties.NOM);
                    }
                }
            }).addTo(map);
        })
        .catch(error => console.error("Erreur quartiers :", error));

    // --- CHARGEMENT DES POINTS D'INTÉRÊT (POIs) ---
    fetch('data/pois.json')
        .then(response => {
            if (!response.ok) throw new Error("Erreur de chargement des POIs");
            return response.json();
        })
        .then(poisData => {
            // Parcourir chaque point dans le JSON et l'ajouter sur la carte
            poisData.forEach(poi => {
                // Utiliser notre générateur SVG avec la couleur du JSON
                var customIcon = createCustomMarker(poi.color);

                var marker = L.marker([poi.lat, poi.lng], { icon: customIcon }).addTo(map);
                
                // Popup au clic sur le marqueur
                marker.bindPopup(`
                    <div style="font-family: Arial, sans-serif; max-width: 200px;">
                        <h3 style="margin: 0 0 5px 0; color: ${poi.color}; font-size: 1.1rem;">${poi.name}</h3>
                        <p style="margin: 0; font-size: 0.9rem; color: #555;">${poi.description}</p>
                    </div>
                `);
            });
        })
        .catch(error => console.error("Erreur points d'intérêt :", error));

    mapInitialized = true;

    // Forcer le recalcul de l'affichage
    setTimeout(function(){ map.invalidateSize(); }, 100);
}