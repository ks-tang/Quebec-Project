// Variables globales
var map;
var mapInitialized = false;

// --- FONCTION DE NAVIGATION (Changement de page) ---
function switchPage(pageId) {
    // 1. Mettre à jour visuellement le menu
    document.querySelectorAll('nav a').forEach(link => link.classList.remove('active'));
    document.getElementById('link-' + pageId).classList.add('active');

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

    // Marqueur : Consulat Général de France
    var consulat = L.marker([46.81230, -71.20611]).addTo(map);
    consulat.bindPopup("<b>Consulat Général de France</b><br>Démarches administratives indispensables !");

    // --- CHARGEMENT DU GEOJSON DES QUARTIERS ---
    // On utilise fetch() pour charger le fichier localisé dans ton dossier /data/
    fetch('data/vdq-quartier.geojson')
        .then(response => {
            if (!response.ok) {
                throw new Error("Erreur lors du chargement du fichier GeoJSON");
            }
            return response.json();
        })
        .then(geojsonData => {
            // Ajouter les contours géographiques des quartiers à la carte
            L.geoJSON(geojsonData, {
                style: function (feature) {
                    return {
                        color: "#2c3e50",      // Couleur des bordures (Bleu ardoise)
                        weight: 2,             // Épaisseur de la ligne
                        opacity: 0.7,          // Transparence de la bordure
                        fillColor: "#34495e",  // Couleur de remplissage des quartiers
                        fillOpacity: 0.1       // Très transparent par défaut pour lire la carte dessous
                    };
                },
                // Associer une action quand on clique sur un quartier
                onEachFeature: function (feature, layer) {
                    if (feature.properties && feature.properties.NOM) {
                        // Exemple de popup avec le nom officiel du quartier
                        layer.bindPopup("<b>Quartier :</b> " + feature.properties.NOM);
                    }
                }
            }).addTo(map);
        })
        .catch(error => {
            console.error("Impossible d'afficher les quartiers :", error);
        });

    mapInitialized = true;

    // Forcer le recalcul de la taille de la carte pour éviter les bugs d'affichage
    setTimeout(function(){ map.invalidateSize(); }, 100);
}