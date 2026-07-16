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
    const checkBox = document.getElementById("chk-transport");
    const selectFiltre = document.getElementById("select-type-transport");

    if (checkBox.checked) {
        // 1. Réactiver le menu déroulant visuellement
        selectFiltre.disabled = false;
        
        // 2. Relancer le filtre pour afficher ce qui est sélectionné dans le menu
        filtrerLesLignes(selectFiltre.value);
    } else {
        // 1. Désactiver le menu déroulant (il devient gris et inutilisable)
        selectFiltre.disabled = true;
        
        // 2. Effacer absolument toutes les lignes de la carte
        rtcLinesGroup.clearLayers();
    }
}

// Fonction unique qui s'occupe de filtrer et dessiner
function filtrerLesLignes(choix) {
    if (!rtcData) return; // Sécurité si le fichier n'est pas encore chargé

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

// Écouteur sur le menu déroulant
const selectFiltre = document.getElementById('select-type-transport');
if (selectFiltre) {
    selectFiltre.addEventListener('change', function(e) {
        filtrerLesLignes(e.target.value);
    });
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
    // 1. Charger le fichier GeoJSON
    const rtcLinesGroup = L.featureGroup().addTo(map);
    let rtcData = null; // Contiendra nos données en mémoire

    // Charger le fichier GeoJSON
    fetch('data/rtc-lignes.geojson')
        .then(response => response.json())
        .then(data => {
            rtcData = data; // On stocke les données en mémoire globale
            
            // ⚠️ IMPORTANT : On NE lance PLUS "mettreAJourCarte()" ici !
            // Les données sont prêtes en arrière-plan, mais rien ne s'affiche tant qu'on ne coche pas la case.
            console.log("Données RTC prêtes et chargées en mémoire !");
        })
        .catch(error => console.error("Erreur de chargement :", error));

    // 2. Fonction magique pour attribuer une couleur unique ou par catégorie
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
            // Génère une couleur semi-aléatoire mais stable basée sur le numéro de parcours
            // pour que chaque ligne régulière ait sa propre couleur distinctive
            const hash = parcours.split('').reduce((acc, char) => char.charCodeAt(0) + ((acc << 5) - acc), 0);
            return `hsl(${Math.abs(hash) % 360}, 75%, 50%)`;
        }
    }

    // 3. Fonction pour dessiner les lignes filtrées sur la carte
    function mettreAJourCarte(featuresFiltrees) {
        // Étape cruciale : on vide d'abord les anciennes lignes de la carte !
        rtcLinesGroup.clearLayers();

        // On recrée la couche GeoJSON avec uniquement les lignes filtrées
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
                layer.bindPopup(`
                    <div style="font-family: sans-serif;">
                        <strong>Ligne ${nom}</strong><br>
                        <span style="color: #666;">Type : ${type}</span>
                    </div>
                `);
            }
        });

        // On ajoute les nouvelles lignes filtrées au groupe sur la carte
        tempLayer.addTo(rtcLinesGroup);
    }

    // 4. Ton écouteur d'événement sur la barre de recherche ou le filtre (HTML)
    // Remplace 'mon-input-filtre' par l'ID réel de ton champ de saisie <input> ou <select>
    const selectFiltre = document.getElementById('select-type-transport');

    if (selectFiltre) {
        selectFiltre.addEventListener('change', function(e) {
            const choix = e.target.value;

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
                    // Pas un Métrobus ni un Express
                    return !parcours.startsWith('80') && !parcours.startsWith('50') && !type.includes('express');
                }
                return true;
            });

            mettreAJourCarte(featuresFiltrees);
        });
    }

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