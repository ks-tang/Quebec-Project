// =========================================================================
// 1. INITIALISATION DE LA CARTE LEAFLET
// =========================================================================

// Centre de la carte par défaut sur la ville de Québec
const map = L.map('map').setView([46.8139, -71.2080], 12);

// Ajout d'un fond de carte neutre et moderne (CartoDB Positron)
L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    subdomains: 'abcd',
    maxZoom: 20
}).addTo(map);


// =========================================================================
// 2. VARIABLES GLOBALES & COUCHES (LAYERS)
// =========================================================================

// Groupe de couches qui contiendra les tracés de bus (facilite le masquage/affichage)
const rtcLinesGroup = L.featureGroup().addTo(map);

// Variable globale pour stocker les données brutes une fois chargées (évite de recharger le fichier à chaque filtre)
let rtcData = null;


// =========================================================================
// 3. CHARGEMENT DES DONNÉES (GEOJSON)
// =========================================================================

// On charge le fichier GeoJSON en arrière-plan dès l'ouverture de la page
fetch('data/rtc-lignes.geojson')
    .then(response => {
        if (!response.ok) {
            throw new Error("Impossible de charger le fichier rtc-lignes.geojson");
        }
        return response.json();
    })
    .then(data => {
        rtcData = data; // Stockage en mémoire
        console.log("✨ Données du réseau RTC chargées avec succès en mémoire !");
        
        // Note : On ne dessine rien pour le moment car la case "Transport" est décochée par défaut.
    })
    .catch(error => {
        console.error("Erreur lors de l'initialisation des données RTC :", error);
    });


// =========================================================================
// 4. FONCTIONS DE STYLISATION & D'AFFICHAGE
// =========================================================================

/**
 * Détermine une couleur stable et esthétique pour chaque ligne de bus
 * @param {Object} properties - Les propriétés de l'entité GeoJSON (Nom, Parcours, Type)
 */
function obtenirCouleurLigne(properties) {
    const parcours = String(properties.Parcours);
    const type = (properties.Type || '').toLowerCase();

    if (parcours.startsWith('80')) {
        return '#e67e22'; // Orange vif pour les Métrobus (800, 801, 802, etc.)
    } else if (parcours.startsWith('50') || type.includes('express')) {
        return '#2980b9'; // Bleu dynamique pour les Express
    } else {
        // Génère une couleur unique et stable basée sur le numéro de la ligne (ex: Ligne 13, 25...)
        // pour que chaque ligne régulière ait sa propre identité visuelle distincte
        const hash = parcours.split('').reduce((acc, char) => char.charCodeAt(0) + ((acc << 5) - acc), 0);
        const hue = Math.abs(hash) % 360;
        return `hsl(${hue}, 70%, 45%)`;
    }
}

/**
 * Efface la carte et dessine uniquement les lignes fournies en paramètre
 * @param {Array} features - Liste des lignes filtrées à afficher
 */
function mettreAJourCarte(features) {
    // 1. On nettoie les anciennes lignes affichées
    rtcLinesGroup.clearLayers();

    if (features.length === 0) return;

    // 2. On crée la nouvelle couche GeoJSON avec le style et les popups
    const geoJsonLayer = L.geoJSON({
        type: "FeatureCollection",
        features: features
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
                <div style="font-family: Arial, sans-serif; min-width: 150px;">
                    <strong style="font-size: 14px; color: #2c3e50;">Ligne ${nom}</strong><br/>
                    <span style="color: #7f8c8d; font-size: 12px; display: inline-block; margin-top: 4px;">Type : ${type}</span>
                </div>
            `);
        }
    });

    // 3. On injecte le résultat dans notre groupe de couches global
    geoJsonLayer.addTo(rtcLinesGroup);
}


// =========================================================================
// 5. GESTION DES FILTRES ET INTERACTIONS (ÉVÉNEMENTS)
// =========================================================================

/**
 * Filtre les données stockées en mémoire selon l'option sélectionnée dans le menu déroulant
 * @param {string} choix - La valeur sélectionnée ('tous', 'metrobus', 'express', 'regulier')
 */
function filtrerLesLignes(choix) {
    if (!rtcData) return; // Sécurité si le fichier GeoJSON n'a pas fini de charger

    // Si on demande tout, on passe directement l'ensemble des données
    if (choix === 'tous') {
        mettreAJourCarte(rtcData.features);
        return;
    }

    // Sinon, on applique le filtre précis
    const featuresFiltrees = rtcData.features.filter(feature => {
        const parcours = String(feature.properties.Parcours);
        const type = (feature.properties.Type || '').toLowerCase();

        if (choix === 'metrobus') {
            return parcours.startsWith('80');
        } else if (choix === 'express') {
            return parcours.startsWith('50') || type.includes('express');
        } else if (choix === 'regulier') {
            return !parcours.startsWith('80') && !parcours.startsWith('50') && !type.includes('express');
        }
        return true;
    });

    // On affiche le résultat filtré
    mettreAJourCarte(featuresFiltrees);
}

/**
 * Gère l'activation globale de la couche de transport via la case à cocher (Checkbox)
 * Cette fonction est appelée directement par le "onchange" dans le HTML
 */
function toggleTransport() {
    const checkBox = document.getElementById("chk-transport");
    const selectFiltre = document.getElementById("select-type-transport");

    if (!checkBox || !selectFiltre) return;

    if (checkBox.checked) {
        // Dégriser le menu déroulant pour le rendre actif
        selectFiltre.disabled = false;
        
        // Lire l'option actuellement sélectionnée dans le menu déroulant pour l'afficher
        filtrerLesLignes(selectFiltre.value);
        
        // Zoomer automatiquement sur la zone du réseau de bus
        if (rtcLinesGroup.getBounds().isValid()) {
            map.fitBounds(rtcLinesGroup.getBounds(), { padding: [20, 20] });
        }
    } else {
        // Griser le menu déroulant
        selectFiltre.disabled = true;
        
        // Retirer toutes les lignes de bus de l'affichage
        rtcLinesGroup.clearLayers();
    }
}


// =========================================================================
// 6. INITIALISATION DES ÉCOUTEURS (LISTENERS) AU CHARGEMENT DE LA PAGE
// =========================================================================
document.addEventListener("DOMContentLoaded", () => {
    const selectFiltre = document.getElementById('select-type-transport');
    
    // On écoute les changements sur le menu déroulant
    if (selectFiltre) {
        selectFiltre.addEventListener('change', function(e) {
            filtrerLesLignes(e.target.value);
        });
    }
});