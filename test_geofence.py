import math

def haversine(lat1, lon1, lat2, lon2):
    R = 6371000  # Earth radius in meters
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi, dlam = math.radians(lat2 - lat1), math.radians(lon2 - lon1)
    a = math.sin(dphi/2)**2 + math.cos(phi1)*math.cos(phi2)*math.sin(dlam/2)**2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

def point_in_polygon(lat, lng, polygon_coords):
    n = len(polygon_coords)
    if n < 3:
        return False
    inside = False
    j = n - 1
    for i in range(n):
        yi, xi = polygon_coords[i]['lat'], polygon_coords[i]['lng']
        yj, xj = polygon_coords[j]['lat'], polygon_coords[j]['lng']
        if ((yi > lat) != (yj > lat)) and (lng < (xj - xi) * (lat - yi) / (yj - yi) + xi):
            inside = not inside
        j = i
    return inside

poly = [
    {"lat": 10.0, "lng": 10.0},
    {"lat": 10.0, "lng": 20.0},
    {"lat": 20.0, "lng": 20.0},
    {"lat": 20.0, "lng": 10.0}
]

print("Point inside:", point_in_polygon(15.0, 15.0, poly))
print("Point outside:", point_in_polygon(5.0, 15.0, poly))
print("Point exactly on vertex:", point_in_polygon(10.0, 10.0, poly))
print("Point exactly on edge:", point_in_polygon(10.0, 15.0, poly))

