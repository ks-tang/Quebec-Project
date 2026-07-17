// =========================================================================
// 1. VARIABLES GLOBALES
// =========================================================================
var map;

// Données du fichier GeoJSON RTC stockées en mémoire globale
var rtcData = null; 

// Groupes de calques pour les POIs
var categoryGroups = {
    administration: L.layerGroup(),
    tourisme: L.layerGroup(),
    shopping: L.layerGroup(),
    restaurant: L.layerGroup(),
    logement: L.layerGroup()
};

// Groupe de calque pour les lignes de transport RTC
var rtcLinesGroup = L.featureGroup();


// =========================================================================
// 2. FONCTION DE NAVIGATION (TOUJOURS EN PREMIER)
// =========================================================================
// Variables globales pour suivre l'état d'initialisation des cartes
var mapInitialized = false;
var mapStatsInitialized = false;
var mapStats = null; // Objet pour la carte de statistiques

function switchPage(pageId) {
    // 1. Nettoyer la classe active sur TOUS les liens de navigation possibles
    document.querySelectorAll('header nav a').forEach(link => {
        link.classList.remove('active');
    });

    // 2. Ajouter la classe active sur le lien cliqué (s'il existe)
    var activeLink = document.getElementById('link-' + pageId);
    if (activeLink) {
        activeLink.classList.add('active');
    }

    // 3. Masquer TOUTES les sections de page de manière sécurisée
    const pages = ['page-accueil', 'page-carte', 'page-carte-stats'];
    pages.forEach(id => {
        var pageEl = document.getElementById(id);
        if (pageEl) {
            pageEl.classList.add('hidden');
        }
    });

    // 4. Afficher la bonne section et gérer les cartes Leaflet
    if (pageId === 'accueil') {
        var pageAccueil = document.getElementById('page-accueil');
        if (pageAccueil) pageAccueil.classList.remove('hidden');
    } 
    else if (pageId === 'carte') {
        var pageCarte = document.getElementById('page-carte');
        if (pageCarte) pageCarte.classList.remove('hidden');
        
        // Initialise la première carte si ce n'est pas fait
        if (!mapInitialized && typeof initMap === 'function') {
            initMap();
            mapInitialized = true;
        } else if (window.map) {
            // Force Leaflet à recalculer sa taille au cas où elle était cachée
            setTimeout(() => { window.map.invalidateSize(); }, 100);
        }
    } 
    else if (pageId === 'carte-stats') {
        var pageStatsEl = document.getElementById('page-carte-stats');
        if (pageStatsEl) pageStatsEl.classList.remove('hidden');
        
        // Initialise la deuxième carte (statistiques)
        if (!mapStatsInitialized && typeof initMapStats === 'function') {
            initMapStats();
            mapStatsInitialized = true;
        } else if (mapStats) {
            // Force la carte statistique à recalculer sa taille
            setTimeout(() => { mapStats.invalidateSize(); }, 100);
        }
    }
}


// =========================================================================
// 3. GÉNÉRATEURS ET STYLES VISUELS
// =========================================================================

// Générateur de pin carte en SVG
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

// Attribue une couleur unique ou par catégorie pour chaque tracé
function obtenirCouleurLigne(properties) {
    const parcours = String(properties.Parcours);
    const type = properties.Type || '';

    if (parcours.startsWith('80')) {
        return '#e67e22'; // Orange pour les Métrobus (800, 801, 802...)
    } else if (parcours.startsWith('50') || type.toLowerCase().includes('express')) {
        return '#2980b9'; // Bleu pour les Express
    } else if (parcours.startsWith('20') || parcours.startsWith('30')) {
        return '#27ae60'; // Vert pour certaines lignes spécifiques / eBus
    } else {
        // Génère une couleur semi-aléatoire mais stable
        const hash = parcours.split('').reduce((acc, char) => char.charCodeAt(0) + ((acc << 5) - acc), 0);
        return `hsl(${Math.abs(hash) % 360}, 75%, 50%)`;
    }
}


// =========================================================================
// 4. FILTRES ET GESTION DES COUCHES (VISIBILITÉ)
// =========================================================================

// Filtre des catégories (POIs)
function toggleCategory(category) {
    var checkbox = document.getElementById('chk-' + category);
    if (!map) return;

    if (checkbox.checked) {
        map.addLayer(categoryGroups[category]);
    } else {
        map.removeLayer(categoryGroups[category]);
    }
}

// Filtre global de la case à cocher "Transport (RTC)"
function toggleTransport() {
    const checkBox = document.getElementById("chk-transport");
    const selectFiltre = document.getElementById("select-type-transport");

    if (!map || !checkBox || !selectFiltre) return;

    if (checkBox.checked) {
        selectFiltre.disabled = false;
        rtcLinesGroup.addTo(map);
        filtrerLesLignes(selectFiltre.value);
    } else {
        selectFiltre.disabled = true;
        map.removeLayer(rtcLinesGroup);
    }
}

// Dessine uniquement les entités filtrées dans le groupe rtcLinesGroup
// Dessine uniquement les entités filtrées dans le groupe rtcLinesGroup
function mettreAJourCarte(featuresFiltrees) {
    rtcLinesGroup.clearLayers();

    const tempLayer = L.geoJSON({
        type: "FeatureCollection",
        features: featuresFiltrees
    }, {
        style: function(feature) {
            return {
                color: obtenirCouleurLigne(feature.properties),
                weight: 4,
                opacity: 0.85
            };
        },
        onEachFeature: function(feature, layer) {
            const nom = feature.properties.Nom || feature.properties.Parcours;
            const type = feature.properties.Type || 'Régulier';
            
            // 1. Ajout du Popup classique
            layer.bindPopup(`
                <div style="font-family: sans-serif;">
                    <strong>Ligne ${nom}</strong><br>
                    <span style="color: #666;">Type : ${type}</span>
                </div>
            `);

            // 2. Gestion des événements de survol (Hover)
            layer.on({
                mouseover: function(e) {
                    const l = e.target;
                    l.setStyle({
                        weight: 7,          // On épaissit la ligne
                        color: '#f1c40f',    // Jaune fluo / Or pour l'effet brillant
                        opacity: 1.0         // Opacité maximale
                    });
                    
                    // Optionnel : amène la ligne survolée au premier plan
                    if (!L.Browser.ie && !L.Browser.opera && !L.Browser.edge) {
                        l.bringToFront();
                    }
                },
                mouseout: function(e) {
                    // Quand la souris part, on réapplique le style par défaut de cette entité
                    tempLayer.resetStyle(e.target);
                }
            });
        }
    });

    tempLayer.addTo(rtcLinesGroup);
}

// Applique le filtre en fonction du choix du menu déroulant
function filtrerLesLignes(choix) {
    if (!rtcData) return;

    if (choix === 'tous') {
        mettreAJourCarte(rtcData.features);
        return;
    }

    const featuresFiltrees = rtcData.features.filter(feature => {
        const parcours = String(feature.properties.Parcours);
        const type = String(feature.properties.Type).toLowerCase();

        if (choix === 'metrobus') {
            return parcours.startsWith('80');
        } else if (choix === 'express') {
            return parcours.startsWith('50') || type.includes('express');
        } else if (choix === 'regulier') {
            return !parcours.startsWith('80') && !parcours.startsWith('50') && !type.includes('express');
        }
        return true;
    });

    mettreAJourCarte(featuresFiltrees);
}


// =========================================================================
// 5. INITIALISATION DE LA CARTE LEAFLET
// =========================================================================
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
                        weight: 1,
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
    fetch('data/rtc-lignes.geojson')
        .then(response => response.json())
        .then(data => {
            rtcData = data;
            console.log("✨ Données RTC prêtes et chargées en mémoire !");
        })
        .catch(error => console.error("Erreur de chargement des lignes :", error));

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

                // 🌟 NOUVEAU : Zoom et centrage fluide au clic sur le marqueur
                marker.on('click', function(e) {
                    // map.setView([latitude, longitude], niveau_de_zoom, { options_de_transition })
                    map.setView([poi.lat, poi.lng], 16, {
                        animate: true,
                        duration: 1.0 // Durée de l'animation en secondes (glissement fluide)
                    });
                });

                if (categoryGroups[poi.category]) {
                    categoryGroups[poi.category].addLayer(marker);
                } else {
                    console.warn(`La catégorie "${poi.category}" pour le point "${poi.name}" n'est pas reconnue.`);
                }
            });

            for (var category in categoryGroups) {
                categoryGroups[category].addTo(map);
            }
        })
        .catch(error => console.error("Erreur points d'intérêt :", error));
}


// =========================================================================
// 6. ENREGISTREMENT DES ÉCOUTEURS D'ÉVÉNEMENTS SECURISÉS
// =========================================================================
document.addEventListener("DOMContentLoaded", () => {
    // Écouteur global sécurisé pour le changement du menu déroulant
    document.addEventListener('change', function(e) {
        if (e.target && e.target.id === 'select-type-transport') {
            const checkBox = document.getElementById("chk-transport");
            if (checkBox && checkBox.checked) {
                filtrerLesLignes(e.target.value);
            }
        }
    });
});


// =========================================================================
// 7. INITIALISATION DE LA CARTE STATISTIQUES
// =========================================================================

// Fonction pour initialiser la page statistique (Carte + Graphique)
function initMapStats() {
    // 1. Initialisation de la deuxième carte Leaflet
    mapStats = L.map('map-stats').setView([46.8139, -71.2082], 11); // Centré sur Québec

    // Ajouter un fond de carte neutre (CartoDB Positron est parfait pour les stats)
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap &copy; CARTO'
    }).addTo(mapStats);

    // 2. Charger les données du fichier analyses.json
    fetch('data/analyses.json')
        .then(response => response.json())
        .then(data => {
            // Une fois les données chargées, on crée le graphique et on prépare l'interaction
            buildChart(data);
            setupMapInteractions(data);
        })
        .catch(error => console.error("Erreur lors du chargement des analyses :", error));
}

// Fonction pour attribuer une couleur selon le prix du loyer (liée à ta légende HTML)
function getColorByLoyer(loyer) {
    return loyer >= 1400 ? '#810f7c' :
           loyer >= 1300 ? '#8856a7' :
           loyer >= 1200 ? '#8c96c6' :
           loyer >= 1100 ? '#b3cde3' :
                           '#edf8fb';
}

// Fonction pour construire le graphique Chart.js
function buildChart(data) {
    if (typeof Chart === 'undefined') {
        console.warn("Chart.js n'est pas encore prêt, réessai dans 100ms...");
        setTimeout(() => buildChart(data), 100);
        return;
    }
    var ctx = document.getElementById('chart-loyers-stats').getContext('2d');
    
    // Extraire les étiquettes (zones) et les valeurs (loyers 2025)
    var labels = data.map(item => item.zone);
    var loyers2025 = data.map(item => item.loyer_2025);
    var couleurs = data.map(item => getColorByLoyer(item.loyer_2025));

    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Loyer moyen 2025 ($)',
                data: loyers2025,
                backgroundColor: couleurs,
                borderColor: '#cbd5e1',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false } // Masqué car on a déjà les couleurs
            },
            scales: {
                y: {
                    beginAtZero: false,
                    min: 800, // Pour mieux voir les disparités
                    title: { display: true, text: 'En dollars ($)' }
                }
            },
            onClick: (e, activeElements) => {
                if (activeElements.length > 0) {
                    var index = activeElements[0].index;
                    afficherDetailsZone(data[index]);
                }
            }
        }
    });
}

// Fonction pour mettre à jour le panneau de texte au clic
function afficherDetailsZone(zoneData) {
    document.getElementById('details-zone-titre').innerHTML = `📍 ${zoneData.zone}`;
    
    var tauxVacance = zoneData.taux_inoccupation_2025 !== null ? `${zoneData.taux_inoccupation_2025} %` : 'Donnée non disponible';
    
    document.getElementById('details-zone-texte').innerHTML = `
        <strong>Loyer moyen 2025 :</strong> ${zoneData.loyer_2025} $ / mois<br>
        <strong>Loyer moyen 2024 :</strong> ${zoneData.loyer_2024} $<br>
        <strong>Taux d'inoccupation :</strong> ${tauxVacance}<br>
        <strong>Profil du secteur :</strong> ${zoneData.description}
    `;
}

// Pour l'instant, on lie simplement les données sans polygones
function setupMapInteractions(data) {
    // Si l'utilisateur clique n'importe où sur la carte pour le moment, 
    // on lui rappelle gentiment d'utiliser le graphique en attendant le GeoJSON des secteurs
    mapStats.on('click', function() {
        // Optionnel : interaction future
    });
}