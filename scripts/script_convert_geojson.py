import geopandas as gpd
import os

# 1. Charger vos fichiers
gdf_parcours = gpd.read_file("../data/ESRI_SHPFILES/parcours.shp")

# 2. On lui associe de force la projection MTM 7 du Québec
gdf_parcours.set_crs("+proj=tmerc +lat_0=0 +lon_0=-70.5 +k=0.9999 +x_0=304800 +y_0=0 +ellps=GRS80 +units=m +no_defs", allow_override=True, inplace=True)

# 3. Conversion vers le standard GPS (WGS84)
gdf_gps = gdf_parcours.to_crs(epsg=4326)

# 4. Simplification géométrique (très important pour alléger le fichier)
gdf_gps['geometry'] = gdf_gps['geometry'].simplify(0.0001, preserve_topology=True)

# 5. Sauvegarde
gdf_gps.to_file("../data/rtc-lignes.geojson", driver="GeoJSON")
print("✨ Le fichier rtc-lignes.geojson a été généré avec succès !")