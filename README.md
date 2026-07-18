# 🇨🇦 Québec Project - Guide interactif & Outil de préparation au voyage

Une application web interactive conçue pour explorer la ville de Québec, analyser le marché immobilier local par zone et sous-quartier, et planifier sereinement ses démarches de voyage (PVT, visa, logistique).

🚀 **[Accéder à l'application en ligne](https://ks-tang.github.io/Quebec-Project/)**

---

## 🗺️ Fonctionnalités majeures

L'application est divisée en plusieurs sections dynamiques et synchronisées, sans rechargement de page :

1. **Carte Interactive des Points d'Intérêt (POIs) :**
   * Visualisation par catégories (Restaurants, Shopping, Logements, Tourisme, Administration, etc.) avec une palette de couleurs optimisée.
   * Système de filtrage avancé avec un bouton "Tout sélectionner / Désélectionner".
   * Intégration des réseaux de transport du RTC (Métrobus, Express, lignes régulières).

2. **Tableau de bord Statistique (Logement & Loyers) :**
   * Cartographie des 9 grandes zones de Québec (Leaflet).
   * Graphique comparatif de l'évolution des loyers moyens entre 2024 et 2025 (Chart.js).
   * **Synchronisation Carte ⇄ Graphique :** Cliquer sur une zone de la carte ou sur une barre du graphique ouvre un panneau de détails affichant les données officielles du recensement de la Ville de Québec pour les 35 sous-quartiers.

3. **📋 Bloc-Notes & Checklist Voyage :**
   * Un compagnon de route personnalisé pour suivre l'état d'avancement des démarches (Assurance obligatoire, comparatif et sélection des banques, alternatives pour cartes SIM physiques, etc.).
   * **Sauvegarde persistante (`localStorage`) :** L'état de la checklist est sauvegardé en temps réel dans le navigateur. Les choix restent mémorisés même après fermeture ou rafraîchissement de la page.

---

## 🛠️ Technologies utilisées

* **Frontend :** HTML5, CSS3, JavaScript ES6.
* **Cartographie :** [Leaflet.js](https://leafletjs.com/) (Fonds de carte CartoDB / OpenStreetMap).
* **Graphiques :** [Chart.js](https://www.chartjs.org/).
* **Hébergement :** GitHub Pages.

---

## 📁 Sources & Structure des données

L'ensemble des données statistiques immobilières et démographiques provient des **Données Ouvertes Officielles de la Ville de Québec** (issus des recensements et des rapports du marché locatif de la SCHL relayés par la municipalité).

Le projet utilise une architecture de données modulaire basée sur des fichiers JSON :
* `data/pois.json` : Contient l'ensemble des points d'intérêt classés par catégories avec leurs coordonnées géographiques.
* `data/logements.json` : Regroupe les données officielles du Recensement pour les 35 quartiers de la Ville de Québec (répartition maisons/appartements, tailles des logements).

