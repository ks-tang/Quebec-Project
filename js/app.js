// Variables globales
var map;
var mapInitialized = false;

// 1. Groupes de calques pour les POIs
var categoryGroups = {
    administration: L.layerGroup(),
    tourisme: L.layerGroup(),
    shopping: L.layerGroup(),
    restaurant: L.layerGroup(),
    logement: L.layerGroup()
};

// 2. Groupe de calque séparé pour les lignes de transport
var transportGroup = L.layerGroup();

// --- FONCTION DE NAVIGATION ---
function switchPage(pageId) {
    document.querySelectorAll('nav a').forEach(link => link.classList.remove('active'));
    
    var activeLink = document.getElementById('link-' + pageId);
    if (activeLink) {
        activeLink.classList.add('active');
    }

    if (pageId === 'accueil') {
        document.getElementById('page-accueil').classList.remove('hidden');
        document.getElementById('page-carte').classList.add('hidden');
    } else if (pageId === 'carte') {
        document.getElementById('page-accueil').classList.add('hidden');
        document.getElementById('page-carte').classList.remove('hidden');
        
        if (!mapInitialized) {
            initMap();
        }
    }
}

// --- GÉNÉRATEUR DE PIN CARTE EN SVG ---
function createCustomMarker(color) {
    const svgTemplate = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="32" height="32">
            <ellipse cx="12" cy="22" rx="4" ry="1.5" fill="rgba(0, 0, 0, 0.2)" />
            <path fill="${color}" stroke="#ffffff" stroke-width="1.5" 
                  d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
        </svg>
    `;

    return L.divIcon({
        html: svgTemplate,
        className: 'custom-svg-marker',
        iconSize: [32, 32],
        iconAnchor: [16, 32],
        popupAnchor: [0, -32]
    });
}

// --- FILTRES DES CATÉGORIES (POIs) ---
function toggleCategory(category) {
    var checkbox = document.getElementById('chk-' + category);
    if (!map) return;

    if (checkbox.checked) {
        map.addLayer(categoryGroups[category]);
    } else {
        map.removeLayer(categoryGroups[category]);
    }
}

// --- FILTRE UNIQUE POUR LES TRANSPORTS ---
function toggleTransport() {
    var checkbox = document.getElementById('chk-transport');
    if (!map) return;

    if (checkbox.checked) {
        map.addLayer(transportGroup);
    } else {
        map.removeLayer(transportGroup);
    }
}

// --- INITIALISATION DE LA CARTE ---
function initMap() {
    map = L.map('map').setView([46.8139, -71.2080], 12);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        attribution: '© OpenStreetMap contributors © CARTO',
        subdomains: 'abcd',
        maxZoom: 20
    }).addTo(map);

    // --- 1. CHARGEMENT DU GEOJSON DES QUARTIERS ---
    fetch('data/vdq-quartier.geojson')
        .then(response => {
            if (!response.ok) throw new Error("Erreur de chargement du GeoJSON");
            return response.json();
        })
        .then(geojsonData => {
            L.geoJSON(geojsonData, {
                style: function () {
                    return {
                        color: "#2c3e50",
                        weight: 1.5,
                        opacity: 0.4,
                        fillColor: "#34495e",  
                        fillOpacity: 0.03
                    };
                },
                onEachFeature: function (feature, layer) {
                    if (feature.properties && feature.properties.NOM) {
                        layer.bindPopup("<b>Quartier :</b> " + feature.properties.NOM);
                    }
                }
            }).addTo(map);
        })
        .catch(error => console.warn("Impossible d'afficher les quartiers :", error));

    // --- 2. CHARGEMENT DES LIGNES DE TRANSPORT (RTC) ---
    // 1. Charger le fichier GeoJSON
    fetch('data/rtc-lignes.geojson')
    .then(response => {
        if (!response.ok) {
            throw new Error("Erreur de chargement du fichier GeoJSON");
        }
        return response.json();
    })
    .then(data => {
        console.log("Données chargées avec les bonnes propriétés !");

        // Fonction pour attribuer une couleur selon le Type ou le numéro de Parcours
        function obtenirCouleur(properties) {
            const numParcours = String(properties.Parcours);
            const type = properties.Type || '';

            if (numParcours.startsWith('80')) {
                return '#e67e22'; // Orange pour les Métrobus (800, 801, etc.)
            } else if (type.toLowerCase().includes('express') || numParcours.startsWith('50')) {
                return '#2980b9'; // Bleu pour les Express
            }
            return '#7f8c8d'; // Gris/Ardoise par défaut pour les lignes régulières
        }

        // Ajouter les lignes à la carte
        const rtcLinesLayer = L.geoJSON(data, {
            style: function(feature) {
                return {
                    color: obtenirCouleur(feature.properties),
                    weight: 3.5, // Une épaisseur moyenne pour bien voir les tracés
                    opacity: 0.85
                };
            },
            onEachFeature: function(feature, layer) {
                // Création d'un popup propre basé sur tes vraies propriétés : Nom et Type
                const nomLigne = feature.properties.Nom || feature.properties.Parcours || 'Inconnu';
                const typeLigne = feature.properties.Type || 'Régulier';

                layer.bindPopup(`
                    <div style="font-family: Arial, sans-serif;">
                        <strong style="font-size: 14px; color: #2c3e50;">Ligne ${nomLigne}</strong><br/>
                        <span style="color: #7f8c8d; font-size: 12px;">Type : ${typeLigne}</span>
                    </div>
                `);
            }
        }).addTo(map);

        // Ajuster automatiquement la vue de la carte sur les tracés du RTC
        if (rtcLinesLayer.getBounds().isValid()) {
            map.fitBounds(rtcLinesLayer.getBounds());
        }
    })
    .catch(error => {
        console.error("Erreur d'affichage des lignes :", error);
    });

    // --- 3. CHARGEMENT DES POINTS D'INTÉRÊT (POIs) ---
    fetch('data/pois.json')
        .then(response => {
            if (!response.ok) throw new Error("Erreur de chargement des POIs");
            return response.json();
        })
        .then(poisData => {
            poisData.forEach(poi => {
                var customIcon = createCustomMarker(poi.color);
                var marker = L.marker([poi.lat, poi.lng], { icon: customIcon });
                
                marker.bindPopup(`
                    <div style="font-family: Arial, sans-serif; max-width: 200px;">
                        <h3 style="margin: 0 0 5px 0; color: ${poi.color}; font-size: 1rem;">${poi.name}</h3>
                        <p style="margin: 0; font-size: 0.85rem; color: #555;">${poi.description}</p>
                    </div>
                `);

                if (categoryGroups[poi.category]) {
                    categoryGroups[poi.category].addLayer(marker);
                } else {
                    console.warn(`La catégorie "${poi.category}" pour le point "${poi.name}" n'est pas reconnue.`);
                }
            });

            // Ajouter tous les groupes de POI à la carte au démarrage
            for (var category in categoryGroups) {
                categoryGroups[category].addTo(map);
            }
        })
        .catch(error => console.error("Erreur points d'intérêt :", error));

    mapInitialized = true;
    setTimeout(function(){ map.invalidateSize(); }, 100);
}