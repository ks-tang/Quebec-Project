// =========================================================================
// 1. VARIABLES ET DONNÉES
// =========================================================================
var mapStats = null;
var donneesLogements = [];

var donneesLoyersStatic = [
    { "zone": "Haute-Ville", "loyer_2024": 1233, "loyer_2025": 1332, "taux_inoccupation_2025": 2.9, "description": "Vieux-Québec, Montcalm, Saint-Jean-Baptiste. Zone historique très prisée." },
    { "zone": "Basse-Ville", "loyer_2024": 983, "loyer_2025": 1139, "taux_inoccupation_2025": 2.7, "description": "Saint-Roch, Saint-Sauveur. Quartiers en pleine revitalisation culturelle." },
    { "zone": "Sainte-Foy / Sillery", "loyer_2024": 1183, "loyer_2025": 1262, "taux_inoccupation_2025": null, "description": "Secteur universitaire. Très forte demande étudiante." },
    { "zone": "Les Rivières", "loyer_2024": 1217, "loyer_2025": 1398, "taux_inoccupation_2025": 2.6, "description": "Vanier, Lebourgneuf. Zone centrale, résidentielle et commerciale." },
    { "zone": "Beauport", "loyer_2024": 1037, "loyer_2025": 1195, "taux_inoccupation_2025": 3.4, "description": "Secteur de banlieue familiale, plus abordable." },
    { "zone": "Charlesbourg", "loyer_2024": 1044, "loyer_2025": 1032, "taux_inoccupation_2025": 0.4, "description": "Secteur très familial. Le marché y est extrêmement serré." },
    { "zone": "Haute-Saint-Charles", "loyer_2024": 1001, "loyer_2025": 1115, "taux_inoccupation_2025": 1.5, "description": "Loretteville. Secteur excentré, vert et tranquille." },
    { "zone": "Val-Bélair / L'Ancienne-Lorette", "loyer_2024": 1058, "loyer_2025": 1137, "taux_inoccupation_2025": 1.0, "description": "Secteurs résidentiels stables avec un marché locatif restreint." },
    { "zone": "Saint-Augustin / Cap-Rouge", "loyer_2024": 1268, "loyer_2025": 1512, "taux_inoccupation_2025": 1.8, "description": "Secteur aisé. Offre locative haut de gamme." }
];


// =========================================================================
// 2. HELPERS VISUELS
// =========================================================================
function getColorByLoyer(loyer) {
    return loyer >= 1400 ? '#530950' :
           loyer >= 1300 ? '#810f7c' :
           loyer >= 1200 ? '#8856a7' :
           loyer >= 1100 ? '#8c96c6' :
                           '#b3cde3' ;
}


// =========================================================================
// 3. FONCTIONS D'AFFICHAGE ET GRAPHIQUE
// =========================================================================
function buildChart(data) {
    if (typeof Chart === 'undefined') {
        console.error("❌ ERREUR : Chart.js n'est pas chargé !");
        return;
    }

    var ctx = document.getElementById('chart-loyers-stats').getContext('2d');
    
    if (window.monGraphiqueStats) {
        window.monGraphiqueStats.destroy();
    }

    var labels = data.map(item => item.zone);
    var loyers2025 = data.map(item => item.loyer_2025);
    var couleurs = data.map(item => getColorByLoyer(item.loyer_2025));

    window.monGraphiqueStats = new Chart(ctx, {
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
            resizeDelay: 50,
            plugins: { legend: { display: false } },
            scales: {
                y: {
                    beginAtZero: false,
                    min: 800,
                    title: { display: true, text: 'En dollars ($)' }
                }
            },
            onClick: (e, activeElements) => {
                if (activeElements.length > 0) {
                    var index = activeElements[0].index;
                    var zoneSelectionnee = data[index];
                    var zoneComplete = donneesLogements.find(item => item.zone === zoneSelectionnee.zone);
                    
                    afficherDetailsZone(zoneComplete || zoneSelectionnee);
                }
            }
        }
    });
}

function afficherDetailsZone(zoneData) {
    document.getElementById('details-zone-titre').innerHTML = `📍 ${zoneData.zone}`;
    
    let htmlQuartiers = "";
    
    if (zoneData.quartiers && zoneData.quartiers.length > 0) {
        zoneData.quartiers.forEach(q => {
            htmlQuartiers += `
                <div style="margin-bottom: 12px; padding: 8px; background: #fff; border-radius: 6px; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
                    <strong style="color: #2c3e50;">🏘️ ${q.nom}</strong> (${q.logements_totaux_2021.toLocaleString()} log.)<br>
                    <small>• Maisons : <b>${q.part_maisons_individuelles}%</b> | Apparts : <b>${q.part_appartements_moins_5_etages}%</b></small><br>
                    <small>• Taille : Petit (<5 p.) : <b>${q.taille_logement.moins_de_5_pieces_pct}%</b> | Grand (>7 p.) : <b>${q.taille_logement.plus_de_7_pieces_pct}%</b></small>
                </div>
            `;
        });
    } else {
        htmlQuartiers = "<em>Aucun sous-quartier enregistré pour cette zone.</em>";
    }

    document.getElementById('details-zone-texte').innerHTML = `
        <div style="font-size: 0.95rem; line-height: 1.4;">
            <p><strong>Données officielles Ville de Québec (Recensement 2021) :</strong></p>
            ${htmlQuartiers}
        </div>
    `;
}

function setupMapInteractions(data) {
    var coordsZones = {
        "Haute-Ville": [46.8075, -71.2224],
        "Basse-Ville": [46.8152, -71.2246],
        "Sainte-Foy / Sillery": [46.7852, -71.2854],
        "Les Rivières": [46.8285, -71.2842],
        "Beauport": [46.8614, -71.1925],
        "Charlesbourg": [46.8619, -71.2674],
        "Haute-Saint-Charles": [46.8610, -71.3630],
        "Val-Bélair / L'Ancienne-Lorette": [46.7972, -71.3503],
        "Saint-Augustin / Cap-Rouge": [46.7516, -71.3934]
    };

    if (!data) data = donneesLoyersStatic;

    data.forEach(item => {
        if (coordsZones[item.zone]) {
            var marker = L.circleMarker(coordsZones[item.zone], {
                radius: 12,
                fillColor: getColorByLoyer(item.loyer_2025),
                color: '#fff',
                weight: 2,
                fillOpacity: 0.85
            }).addTo(mapStats);
            
            marker.bindPopup(`<b>${item.zone}</b><br>Loyer moyen : ${item.loyer_2025} $`);
            marker.options.nomZone = item.zone;

            marker.on('click', function(e) {
                var nomDeLaZoneCliquee = e.target.options.nomZone;
                var zoneLogementTrouvee = donneesLogements.find(l => l.zone === nomDeLaZoneCliquee);
                afficherDetailsZone(zoneLogementTrouvee || item);
            });
        }
    });
}


// =========================================================================
// 4. INITIALISATION
// =========================================================================
function initMapStats() {
    var mapContainer = document.getElementById('map-stats');
    if (!mapContainer) return;

    mapStats = L.map('map-stats').setView([46.8139, -71.2082], 11);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap &copy; CARTO'
    }).addTo(mapStats);

    buildChart(donneesLoyersStatic);
    setupMapInteractions(donneesLoyersStatic);

    // Force le redimensionnement immédiat de la carte
    setTimeout(() => {
        if (mapStats) mapStats.invalidateSize();
    }, 100);

    fetch('data/logements.json')
        .then(response => {
            if (!response.ok) throw new Error("Impossible de charger logements.json");
            return response.json();
        })
        .then(data => {
            donneesLogements = data;
        })
        .catch(error => console.error("Erreur de liaison du fichier logements :", error));
}