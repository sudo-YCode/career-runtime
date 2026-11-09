package dev.yatin.fleet;

/** Distance and arrival-time maths for live vehicle tracking. */
public final class EtaCalculator {

    private static final double EARTH_RADIUS_KM = 6371.0;

    private EtaCalculator() {
    }

    /** Great-circle distance between two GPS fixes, in kilometres. */
    public static double haversineKm(double lat1, double lon1, double lat2, double lon2) {
        double dLat = Math.toRadians(lat2 - lat1);
        double dLon = Math.toRadians(lon2 - lon1);
        double a = Math.pow(Math.sin(dLat / 2), 2)
                + Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2))
                * Math.pow(Math.sin(dLon / 2), 2);
        return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(a));
    }

    /** Whole minutes to arrival at the current average speed. */
    public static int etaMinutes(double distanceKm, double avgSpeedKmh) {
        if (avgSpeedKmh <= 0) {
            return Integer.MAX_VALUE;
        }
        return (int) Math.ceil(distanceKm / avgSpeedKmh * 60);
    }
}
