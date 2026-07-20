// =========================================================================
// 1. VARIABLES GLOBALES ET COUCHES
// =========================================================================
var map;
var rtcData = null;
var allPois = []; // <--- 1. Stockage global des données POI

// Groupes de calques pour les POIs
var categoryGroups = {
    administration: L.layerGroup(),
    tourisme: L.layerGroup(),
    shopping: L.layerGroup(),
    restaurant: L.layerGroup(),
    logement: L.layerGroup(),
    nature: L.layerGroup(),
    sport: L.layerGroup()
};

// Groupe de calque pour les lignes de transport RTC
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

function obtenirCouleurLigne(properties) {
    const parcours = String(properties.Parcours);
    const type = properties.Type || '';

    if (parcours.startsWith('80')) {
        return '#e67e22'; // Métrobus
    } else if (parcours.startsWith('50') || type.toLowerCase().includes('express')) {
        return '#2980b9'; // Express
    } else if (parcours.startsWith('20') || parcours.startsWith('30')) {
        return '#27ae60'; // Lignes spécifiques / eBus
    } else {
        const hash = parcours.split('').reduce((acc, char) => char.charCodeAt(0) + ((acc << 5) - acc), 0);
        return `hsl(${Math.abs(hash) % 360}, 75%, 50%)`;
    }
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
    
    // Mettre à jour la liste texte sous la carte
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

    // Mettre à jour la liste texte sous la carte
    rafraichirPOIsVisibles();
}

// <--- 2. Nouvelle fonction de filtrage pour la liste texte
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
            const nom = feature.properties.Nom || feature.properties.Parcours;
            const type = feature.properties.Type || 'Régulier';
            
            layer.bindPopup(`
                <div style="font-family: sans-serif;">
                    <strong>Ligne ${nom}</strong><br>
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
    if (!rtcData) return;

    if (choix === 'tous') {
        mettreAJourCarte(rtcData.features);
        return;
    }

    const featuresFiltrees = rtcData.features.filter(feature => {
        const parcours = String(feature.properties.Parcours);
        const type = String(feature.properties.Type).toLowerCase();

        if (choix === 'metrobus') return parcours.startsWith('80');
        if (choix === 'express') return parcours.startsWith('50') || type.includes('express');
        if (choix === 'regulier') return !parcours.startsWith('80') && !parcours.startsWith('50') && !type.includes('express');
        return true;
    });

    mettreAJourCarte(featuresFiltrees);
}


// =========================================================================
// 4. INITIALISATION ET CHARGEMENT
// =========================================================================
function initMap() {
    map = L.map('map').setView([46.8139, -71.2080], 12);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        attribution: '© OpenStreetMap contributors © CARTO',
        subdomains: 'abcd',
        maxZoom: 20
    }).addTo(map);

    // 1. Quartiers
    fetch('data/vdq-quartier.geojson')
        .then(response => {
            if (!response.ok) throw new Error("Erreur GeoJSON");
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

    // 2. Transports RTC
    fetch('data/rtc-lignes.geojson')
        .then(response => response.json())
        .then(data => { rtcData = data; })
        .catch(error => console.error("Erreur de chargement des lignes :", error));

    // 3. Points d'intérêt (POIs)
    fetch('data/pois.json')
        .then(response => {
            if (!response.ok) throw new Error("Erreur de chargement des POIs");
            return response.json();
        })
        .then(poisData => {
            allPois = poisData; // <--- Sauvegarde dans la variable globale

            allPois.forEach(poi => {
                var customIcon = createCustomMarker(poi.color);
                var marker = L.marker([poi.lat, poi.lng], { icon: customIcon });
                
                // On attache l'instance du marker sur le POI pour l'ouvrir au clic depuis la liste texte
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

            // Génération de la liste au premier chargement
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

    listeElement.innerHTML = ''; // Réinitialise la liste

    if (pointsVisibles.length === 0) {
        listeElement.innerHTML = '<li class="poi-empty">Aucun point d\'intérêt ne correspond aux filtres sélectionnés.</li>';
        return;
    }

    pointsVisibles.forEach(point => {
        const li = document.createElement('li');
        li.className = 'poi-item';
        
        // <--- 4. Adapté selon les clés de pois.json (name, category, description)
        li.innerHTML = `
            <span class="poi-categorie-tag" style="border-left: 3px solid ${point.color || '#3182ce'}">${point.category}</span>
            <strong class="poi-nom">${point.name}</strong>
            <span class="poi-adresse">${point.description || ''}</span>
        `;

        // Un clic sur la puce recentre la carte et ouvre le popup
        li.addEventListener('click', () => {
            map.setView([point.lat, point.lng], 16, { animate: true, duration: 1.0 });
            if (point.marker) {
                point.marker.openPopup();
            }
        });

        listeElement.appendChild(li);
    });
}