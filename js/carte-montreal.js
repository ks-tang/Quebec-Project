// =========================================================================
// 1. VARIABLES GLOBALES ET COUCHES
// =========================================================================
var map;
var rtcData = null;
var allPois = []; // Stockage global des données POI

// Groupes de calques pour les POIs
var categoryGroups = {
    administration: L.layerGroup(),
    tourisme: L.layerGroup(),
    shopping: L.layerGroup(),
    restaurant: L.layerGroup(),
    logement: L.layerGroup(),
    nature: L.layerGroup(),
    sport: L.layerGroup(),
    association: L.layerGroup()
};

// Groupe de calque pour les lignes de transport RTC/STM
var rtcLinesGroup = L.featureGroup();


// =========================================================================
// 2. HELPERS & GENERATEURS DE STYLE
// =========================================================================

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

// Extrait le numéro de ligne pur (ex: "2_238" -> "2", "10_12" -> "10")
function extraireNumeroLigne(props) {
    if (!props) return '';
    
    // Test des propriétés classiques STM et GTFS
    let raw = props.route_id || props.shape_id || props.route_short_name || props.Nom || props.NUM_LIGNE || '';
    raw = String(raw).trim();

    if (raw.includes('_')) {
        return raw.split('_')[0];
    }
    return raw;
}

function obtenirCouleurLigne(properties) {
    const route = extraireNumeroLigne(properties);
    const nomLigne = String(properties.route_long_name || properties.Nom || '').toLowerCase();

    // 1. Couleurs des 4 lignes du Métro de Montréal
    if (route === '1' || nomLigne.includes('verte')) return '#008e4f';  // Ligne Verte
    if (route === '2' || nomLigne.includes('orange')) return '#f37021'; // Ligne Orange
    if (route === '4' || nomLigne.includes('jaune')) return '#ffd400';  // Ligne Jaune
    if (route === '5' || nomLigne.includes('bleue')) return '#00a0e3';  // Ligne Bleue

    const num = parseInt(route, 10);

    // 2. Réseau Bus Express STM (Lignes 400+)
    if (!isNaN(num) && num >= 400 && num <= 499) return '#e74c3c'; // Rouge Express

    // 3. Réseau Bus Fréquent / Chrono (Lignes 500+)
    if (!isNaN(num) && num >= 500) return '#9b59b6'; 

    // 4. Couleur par défaut pour les bus réguliers
    return '#2980b9'; // Bleu bus standard
}


// =========================================================================
// 3. FILTRES DE VISIBILITE ET TRANSPORTS
// =========================================================================

function toggleAllCategories(isChecked) {
    if (!map) return;

    for (var category in categoryGroups) {
        var checkbox = document.getElementById('chk-' + category);
        if (checkbox) {
            checkbox.checked = isChecked;
            if (isChecked) {
                map.addLayer(categoryGroups[category]);
            } else {
                map.removeLayer(categoryGroups[category]);
            }
        }
    }
    
    rafraichirPOIsVisibles();
}

function toggleCategory(category) {
    var checkbox = document.getElementById('chk-' + category);
    if (!map || !checkbox) return;

    if (checkbox.checked) {
        map.addLayer(categoryGroups[category]);
    } else {
        map.removeLayer(categoryGroups[category]);
    }

    var chkToggleAll = document.getElementById('chk-toggle-all');
    if (chkToggleAll) {
        var touteslesCases = Object.keys(categoryGroups).map(cat => document.getElementById('chk-' + cat));
        chkToggleAll.checked = touteslesCases.every(chk => chk && chk.checked);
    }

    rafraichirPOIsVisibles();
}

function rafraichirPOIsVisibles() {
    const poisFiltres = allPois.filter(poi => {
        const chk = document.getElementById('chk-' + poi.category);
        return chk ? chk.checked : true;
    });
    mettreAJourListePOI(poisFiltres);
}

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
            const props = feature.properties || {};
            const numLigne = extraireNumeroLigne(props);
            const nom = props.route_long_name || props.Nom || `Ligne ${numLigne}`;
            const type = props.Type || (['1','2','4','5'].includes(numLigne) ? 'Métro' : 'Bus');
            
            layer.bindPopup(`
                <div style="font-family: sans-serif;">
                    <strong>Ligne ${numLigne} ${nom ? '- ' + nom : ''}</strong><br>
                    <span style="color: #666;">Type : ${type}</span>
                </div>
            `);

            layer.on({
                mouseover: function(e) {
                    const l = e.target;
                    l.setStyle({
                        weight: 7,
                        color: '#f1c40f',
                        opacity: 1.0
                    });
                    if (!L.Browser.ie && !L.Browser.opera && !L.Browser.edge) {
                        l.bringToFront();
                    }
                },
                mouseout: function(e) {
                    tempLayer.resetStyle(e.target);
                }
            });
        }
    });

    tempLayer.addTo(rtcLinesGroup);
}

function filtrerLesLignes(choix) {
    if (!rtcData || !rtcData.features) return;

    if (choix === 'tous') {
        mettreAJourCarte(rtcData.features);
        return;
    }

    const featuresFiltrees = rtcData.features.filter(feature => {
        const props = feature.properties || {};
        const route = extraireNumeroLigne(props);
        const typeStr = String(props.route_type || props.Type || '').toLowerCase();
        const numLigne = parseInt(route, 10);

        // 1. Détection stricte du Métro (Lignes 1, 2, 4, 5 ou route_type 1)
        const estMetro = ['1', '2', '4', '5'].includes(route) || typeStr === '1';

        // 2. Détection des Bus Express (Lignes 400 à 499)
        const estExpress = !estMetro && ((!isNaN(numLigne) && numLigne >= 400 && numLigne <= 499) || typeStr.includes('express'));

        // 3. Détection des Bus Fréquents / Métrobus (Lignes 500+ ou mention max/chrono)
        const estFrequente = !estMetro && ((!isNaN(numLigne) && numLigne >= 500) || typeStr.includes('max') || typeStr.includes('chrono'));

        // --- FILTRE METRO ---
        if (choix === 'metro') {
            return estMetro;
        }

        // --- FILTRE EXPRESS ---
        if (choix === 'express') {
            return estExpress;
        }

        // --- FILTRE BUS FRÉQUENT / MÉTROBUS ---
        // Accepte plusieurs valeurs possibles de votre <option> HTML
        if (choix === 'metrobus' || choix === 'frequente' || choix === 'frequent' || choix === 'chrono') {
            return estFrequente;
        }

        // --- FILTRE BUS RÉGULIER ---
        if (choix === 'regulier' || choix === 'bus') {
            return !estMetro && !estExpress && !estFrequente;
        }

        // Si aucun filtre ne correspond, par sécurité on n'affiche rien ou tout
        return false; 
    });

    mettreAJourCarte(featuresFiltrees);
}

// =========================================================================
// 4. INITIALISATION ET CHARGEMENT
// =========================================================================
function initMap() {
    map = L.map('map').setView([45.5017, -73.5673], 12);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        attribution: '© OpenStreetMap contributors © CARTO',
        subdomains: 'abcd',
        maxZoom: 20
    }).addTo(map);

    // 1. Quartiers
    fetch('data/montreal-quartier.geojson')
        .then(response => {
            if (!response.ok) throw new Error("Erreur GeoJSON Quartiers");
            return response.json();
        })
        .then(geojsonData => {
            L.geoJSON(geojsonData, {
                style: () => ({
                    color: "#2c3e50",
                    weight: 1,
                    opacity: 0.4,
                    fillColor: "#34495e",  
                    fillOpacity: 0.03
                }),
                onEachFeature: (feature, layer) => {
                    if (feature.properties && feature.properties.NOM) {
                        layer.bindPopup("<b>Quartier :</b> " + feature.properties.NOM);
                    }
                }
            }).addTo(map);
        })
        .catch(error => console.warn("Impossible d'afficher les quartiers :", error));

    // 2. Transports STM / RTC
    fetch('data/stm-lignes.geojson')
        .then(response => {
            if (!response.ok) throw new Error("Erreur GeoJSON Lignes");
            return response.json();
        })
        .then(data => { 
            rtcData = data; 
            // Si la case à cocher transport est déjà activée au chargement
            const chkTransport = document.getElementById("chk-transport");
            if (chkTransport && chkTransport.checked) {
                toggleTransport();
            }
        })
        .catch(error => console.error("Erreur de chargement des lignes :", error));

    // 3. Points d'intérêt (POIs)
    fetch('data/pois-montreal.json')
        .then(response => {
            if (!response.ok) throw new Error("Erreur de chargement des POIs");
            return response.json();
        })
        .then(poisData => {
            allPois = poisData;

            allPois.forEach(poi => {
                var customIcon = createCustomMarker(poi.color);
                var marker = L.marker([poi.lat, poi.lng], { icon: customIcon });
                
                poi.marker = marker; 

                marker.bindPopup(`
                    <div style="font-family: Arial, sans-serif; max-width: 200px;">
                        <h3 style="margin: 0 0 5px 0; color: ${poi.color}; font-size: 1rem;">${poi.name}</h3>
                        <p style="margin: 0; font-size: 0.85rem; color: #555;">${poi.description}</p>
                    </div>
                `);

                marker.on('click', () => {
                    map.setView([poi.lat, poi.lng], 16, { animate: true, duration: 1.0 });
                });

                if (categoryGroups[poi.category]) {
                    categoryGroups[poi.category].addLayer(marker);
                }
            });

            for (var category in categoryGroups) {
                categoryGroups[category].addTo(map);
            }

            rafraichirPOIsVisibles();
        })
        .catch(error => console.error("Erreur POIs :", error));
}

// Lancement automatique au chargement du DOM
document.addEventListener("DOMContentLoaded", () => {
    initMap();

    const chkToggleAll = document.getElementById('chk-toggle-all');
    if (chkToggleAll) {
        chkToggleAll.addEventListener('change', (e) => toggleAllCategories(e.target.checked));
    }

    const chkTransport = document.getElementById('chk-transport');
    if (chkTransport) {
        chkTransport.addEventListener('change', toggleTransport);
    }

    const selectTransport = document.getElementById('select-type-transport');
    if (selectTransport) {
        selectTransport.addEventListener('change', (e) => {
            const checkBox = document.getElementById("chk-transport");
            if (checkBox && checkBox.checked) {
                filtrerLesLignes(e.target.value);
            }
        });
    }
});


// =========================================================================
// 5. FONCTION POUR METTRE À JOUR LA LISTE TEXTE
// =========================================================================
function mettreAJourListePOI(pointsVisibles) {
    const listeElement = document.getElementById('poi-list');
    if (!listeElement) return;

    listeElement.innerHTML = '';

    if (pointsVisibles.length === 0) {
        listeElement.innerHTML = '<li class="poi-empty">Aucun point d\'intérêt ne correspond aux filtres sélectionnés.</li>';
        return;
    }

    pointsVisibles.forEach(point => {
        const li = document.createElement('li');
        li.className = 'poi-item';
        
        li.innerHTML = `
            <span class="poi-categorie-tag" style="border-left: 3px solid ${point.color || '#3182ce'}">${point.category}</span>
            <strong class="poi-nom">${point.name}</strong>
            <span class="poi-adresse">${point.description || ''}</span>
        `;

        li.addEventListener('click', () => {
            map.setView([point.lat, point.lng], 16, { animate: true, duration: 1.0 });
            if (point.marker) {
                point.marker.openPopup();
            }
        });

        listeElement.appendChild(li);
    });
}

// TEST