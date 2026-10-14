import { customType } from 'drizzle-orm/pg-core';
export const geometryPoint = customType({
    dataType() {
        return 'geometry(Point, 4326)';
    },
});
