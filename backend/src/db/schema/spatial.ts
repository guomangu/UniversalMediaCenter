import { customType } from 'drizzle-orm/pg-core';

export interface GeoPoint {
  lat: number;
  lng: number;
}

export const geometryPoint = customType<{ data: GeoPoint }>({
  dataType() {
    return 'geometry(Point, 4326)';
  },
});
