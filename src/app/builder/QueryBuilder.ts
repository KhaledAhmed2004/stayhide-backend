import mongoose, { FilterQuery, Query } from 'mongoose';
import { recordDbQuery } from '../logging/requestContext';
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';
import escapeRegex from 'escape-string-regexp';

class QueryBuilder<T> {
  public modelQuery: Query<T[], T>;
  public query: Record<string, unknown>;

  constructor(modelQuery: Query<T[], T>, query: Record<string, unknown>) {
    this.modelQuery = modelQuery;
    this.query = query;
  }

  // 🔍 Searching across multiple fields
  search(searchableFields: string[]) {
    if (this?.query?.searchTerm) {
      // Sanitize search term to prevent NoSQL injection via regex
      const sanitizedTerm = escapeRegex(String(this.query.searchTerm));

      this.modelQuery = this.modelQuery.find({
        $or: searchableFields.map(
          field =>
            ({
              [field]: {
                $regex: sanitizedTerm,
                $options: 'i',
              },
            } as FilterQuery<T>)
        ),
      });
    }
    return this;
  }

  /**
   * 🔎 Full-text search using a MongoDB text index.
   *
   * Prefer this over `.search()` when the target collection has a text
   * index defined — it turns O(n) regex scans into O(log n) index hits
   * and gives relevance scoring for free.
   *
   * When a search term is present the results are automatically
   * re-sorted by `textScore` descending, which overrides any client
   * `?sort=` (relevance wins over recency for a typed search). If no
   * term is present this is a no-op and downstream `.sort()` applies.
   */
  textSearch() {
    if (this?.query?.searchTerm) {
      const term = String(this.query.searchTerm).trim();
      if (term.length > 0) {
        this.modelQuery = this.modelQuery
          .find(
            { $text: { $search: term } } as FilterQuery<T>,
            { score: { $meta: 'textScore' } },
          )
          .sort({ score: { $meta: 'textScore' } } as any);
      }
    }
    return this;
  }

  // 🔎 Filtering
  filter() {
    const queryObj = { ...this.query };
    const excludeFields = [
      'searchTerm',
      'sort',
      'page',
      'limit',
      'fields',
      'timeFilter',
      'start',
      'end',
      'category', // we will handle this separately
      'latitude', // we will handle this separately
      'longitude', // we will handle this separately
      'distance', // we will handle this separately
    ];
    excludeFields.forEach(el => delete queryObj[el]);

    this.modelQuery = this.modelQuery.find(queryObj as FilterQuery<T>);

    // ✅ Category filtering (support single or multiple)
    if (this?.query?.category) {
      const categories = (this.query.category as string)
        .split(',')
        .map(cat => cat.trim());

      // Apply category filter
      this.modelQuery = this.modelQuery.find({
        ...this.modelQuery.getFilter(), // keep previous filters
        taskCategory: { $in: categories },
      } as FilterQuery<T>);
    }

    return this;
  }

  // 📍 Location-based filtering using index-friendly bounding box
  locationFilter() {
    if (this?.query?.latitude && this?.query?.longitude && this?.query?.distance) {
      const lat = parseFloat(this.query.latitude as string);
      const lng = parseFloat(this.query.longitude as string);
      const distanceKm = parseFloat(this.query.distance as string);

      // Validate coordinates
      if (isNaN(lat) || isNaN(lng) || isNaN(distanceKm)) {
        throw new Error('Invalid latitude, longitude, or distance values');
      }

      if (lat < -90 || lat > 90) {
        throw new Error('Latitude must be between -90 and 90 degrees');
      }

      if (lng < -180 || lng > 180) {
        throw new Error('Longitude must be between -180 and 180 degrees');
      }

      if (distanceKm <= 0) {
        throw new Error('Distance must be greater than 0');
      }

      // Bounding box approximation (fast and index-friendly)
      const latDelta = distanceKm / 111.32; // ~ km per degree latitude
      const latRad = (lat * Math.PI) / 180;
      const cosLat = Math.cos(latRad);
      const lngDelta = distanceKm / (111.32 * (cosLat || 1e-6)); // avoid division by zero at poles

      const minLat = lat - latDelta;
      const maxLat = lat + latDelta;
      const minLng = lng - lngDelta;
      const maxLng = lng + lngDelta;

      this.modelQuery = this.modelQuery.find({
        latitude: { $gte: minLat, $lte: maxLat },
        longitude: { $gte: minLng, $lte: maxLng },
      } as FilterQuery<T>);
    }

    return this;
  }

  // 🌍 Geospatial: find by proximity using $near on GeoJSON Point `location`
  geoNear() {
    const hasCoords = this?.query?.latitude && this?.query?.longitude;
    const hasMax = this?.query?.distance || this?.query?.maxDistance;
    if (hasCoords && hasMax) {
      const lat = parseFloat(this.query.latitude as string);
      const lng = parseFloat(this.query.longitude as string);
      const field = (this?.query?.geoField as string) || 'location';
      const maxKm = this.query.distance ? parseFloat(this.query.distance as string) : undefined;
      const maxMetersExplicit = this.query.maxDistance ? parseFloat(this.query.maxDistance as string) : undefined;
      const minKm = this.query.minDistance ? parseFloat(this.query.minDistance as string) : undefined;

      if (isNaN(lat) || isNaN(lng)) {
        throw new Error('Invalid latitude or longitude values');
      }
      if (lat < -90 || lat > 90) {
        throw new Error('Latitude must be between -90 and 90 degrees');
      }
      if (lng < -180 || lng > 180) {
        throw new Error('Longitude must be between -180 and 180 degrees');
      }

      const maxMeters = typeof maxKm === 'number' && !isNaN(maxKm)
        ? Math.max(0, maxKm * 1000)
        : (typeof maxMetersExplicit === 'number' && !isNaN(maxMetersExplicit) ? Math.max(0, maxMetersExplicit) : undefined);

      const minMeters = typeof minKm === 'number' && !isNaN(minKm)
        ? Math.max(0, minKm * 1000)
        : undefined;

      const nearClause: Record<string, unknown> = {
        $geometry: { type: 'Point', coordinates: [lng, lat] },
      };
      if (typeof maxMeters === 'number') {
        (nearClause as any).$maxDistance = maxMeters;
      }
      if (typeof minMeters === 'number') {
        (nearClause as any).$minDistance = minMeters;
      }

      this.modelQuery = this.modelQuery.find({
        ...this.modelQuery.getFilter(),
        [field]: { $near: nearClause },
      } as FilterQuery<T>);
    }
    return this;
  }

  // 🌐 Geospatial: within a circle using $geoWithin + $centerSphere
  geoWithinCircle() {
    if (this?.query?.latitude && this?.query?.longitude && (this?.query?.radius || this?.query?.distance)) {
      const lat = parseFloat(this.query.latitude as string);
      const lng = parseFloat(this.query.longitude as string);
      const field = (this?.query?.geoField as string) || 'location';
      const radiusKm = this.query.radius ? parseFloat(this.query.radius as string) : parseFloat(this.query.distance as string);

      if (isNaN(lat) || isNaN(lng) || isNaN(radiusKm)) {
        throw new Error('Invalid latitude, longitude, or radius values');
      }
      if (lat < -90 || lat > 90) {
        throw new Error('Latitude must be between -90 and 90 degrees');
      }
      if (lng < -180 || lng > 180) {
        throw new Error('Longitude must be between -180 and 180 degrees');
      }
      if (radiusKm <= 0) {
        throw new Error('Radius must be greater than 0');
      }

      const earthRadiusKm = 6378.1;
      const radiusInRadians = radiusKm / earthRadiusKm;

      this.modelQuery = this.modelQuery.find({
        ...this.modelQuery.getFilter(),
        [field]: { $geoWithin: { $centerSphere: [[lng, lat], radiusInRadians] } },
      } as FilterQuery<T>);
    }
    return this;
  }

  // 🧭 Geospatial: within a bounding box using $geoWithin + $box
  geoWithinBox() {
    const hasSW = this?.query?.swLat && this?.query?.swLng;
    const hasNE = this?.query?.neLat && this?.query?.neLng;
    if (hasSW && hasNE) {
      const swLat = parseFloat(this.query.swLat as string);
      const swLng = parseFloat(this.query.swLng as string);
      const neLat = parseFloat(this.query.neLat as string);
      const neLng = parseFloat(this.query.neLng as string);
      const field = (this?.query?.geoField as string) || 'location';

      if ([swLat, swLng, neLat, neLng].some(v => isNaN(v))) {
        throw new Error('Invalid bounding box coordinates');
      }
      if (swLat < -90 || swLat > 90 || neLat < -90 || neLat > 90) {
        throw new Error('Latitude must be between -90 and 90 degrees');
      }
      if (swLng < -180 || swLng > 180 || neLng < -180 || neLng > 180) {
        throw new Error('Longitude must be between -180 and 180 degrees');
      }

      this.modelQuery = this.modelQuery.find({
        ...this.modelQuery.getFilter(),
        [field]: { $geoWithin: { $box: [[swLng, swLat], [neLng, neLat]] } },
      } as FilterQuery<T>);
    }
    return this;
  }

  // 🔷 Geospatial: within a polygon using $geoWithin + $polygon
  geoWithinPolygon() {
    const field = (this?.query?.geoField as string) || 'location';
    const polygonRaw = (this?.query?.polygon as string) || (this?.query?.poly as string);
    if (!polygonRaw) return this;

    let coordinates: Array<[number, number]> = [];
    try {
      // Try JSON first
      const parsed = JSON.parse(polygonRaw);
      if (Array.isArray(parsed)) {
        coordinates = parsed.map((pair: any) => [parseFloat(pair[0]), parseFloat(pair[1])]);
      }
    } catch {
      // Fallback: "lng,lat;lng,lat;..."
      coordinates = polygonRaw.split(';')
        .map(p => p.trim())
        .filter(Boolean)
        .map(pairStr => {
          const [lngStr, latStr] = pairStr.split(',').map(s => s.trim());
          return [parseFloat(lngStr), parseFloat(latStr)] as [number, number];
        });
    }

    // Basic validation
    if (!Array.isArray(coordinates) || coordinates.length < 3) {
      throw new Error('Polygon must have at least 3 points');
    }

    // Validate ranges and ensure closure
    coordinates.forEach(([lng, lat]) => {
      if (isNaN(lat) || isNaN(lng)) throw new Error('Invalid polygon coordinates');
      if (lat < -90 || lat > 90) throw new Error('Latitude must be between -90 and 90 degrees');
      if (lng < -180 || lng > 180) throw new Error('Longitude must be between -180 and 180 degrees');
    });

    const first = coordinates[0];
    const last = coordinates[coordinates.length - 1];
    if (first[0] !== last[0] || first[1] !== last[1]) {
      // Auto-close the ring
      coordinates.push([first[0], first[1]]);
    }

    this.modelQuery = this.modelQuery.find({
      ...this.modelQuery.getFilter(),
      [field]: { $geoWithin: { $polygon: coordinates } },
    } as FilterQuery<T>);

    return this;
  }

  // 🔀 Convenience: choose geo mode from query params
  geoQuery() {
    const mode = (this?.query?.geoMode as string) || 'near';
    if (mode === 'near') return this.geoNear();
    if (mode === 'circle') return this.geoWithinCircle();
    if (mode === 'box') return this.geoWithinBox();
    if (mode === 'polygon') return this.geoWithinPolygon();
    return this;
  }

  // ⏰ Date filtering (recently, weekly, monthly, custom)
  dateFilter() {
    if (this?.query?.timeFilter) {
      const now = new Date();
      let dateRange: Record<string, Date> = {};

      if (this.query.timeFilter === 'recently') {
        // Last 24 hours
        const yesterday = new Date(now);
        yesterday.setDate(now.getDate() - 1);
        dateRange = { $gte: yesterday, $lte: now };
      } else if (this.query.timeFilter === 'weekly') {
        // Current week (Mon–Sun)
        dateRange = {
          $gte: startOfWeek(now, { weekStartsOn: 1 }),
          $lte: endOfWeek(now, { weekStartsOn: 1 }),
        };
      } else if (this.query.timeFilter === 'monthly') {
        // Current month
        dateRange = {
          $gte: startOfMonth(now),
          $lte: endOfMonth(now),
        };
      } else if (this.query.timeFilter === 'custom') {
        // Custom range: requires ?start=YYYY-MM-DD&end=YYYY-MM-DD
        if (!this.query.start || !this.query.end) {
          throw new Error(
            "Custom date filter requires both 'start' and 'end' query parameters."
          );
        }

        const startDate = new Date(this.query.start as string);
        const endDate = new Date(this.query.end as string);

        if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
          throw new Error(
            "Invalid date format. Use 'YYYY-MM-DD' format for 'start' and 'end'."
          );
        }

        if (startDate > endDate) {
          throw new Error("'start' date cannot be after 'end' date.");
        }

        dateRange = { $gte: startDate, $lte: endDate };
      }

      if (Object.keys(dateRange).length > 0) {
        this.modelQuery = this.modelQuery.find({
          ...this.modelQuery.getFilter(),
          createdAt: dateRange,
        });
      }
    }

    return this;
  }

  // ↕️ Sorting
  sort() {
    // If `.textSearch()` was chained earlier it already set a
    // `{ score: { $meta: 'textScore' } }` sort — relevance should win
    // over the default `-createdAt` when the caller actually typed a
    // search term. Skip the default sort override in that case.
    const hasSearchTerm =
      typeof this?.query?.searchTerm === 'string' &&
      String(this.query.searchTerm).trim().length > 0;
    const explicitSort = this?.query?.sort as string | undefined;

    if (hasSearchTerm && !explicitSort) {
      // Keep the textScore sort that `textSearch()` installed.
      return this;
    }

    const sort = explicitSort || '-createdAt';
    this.modelQuery = this.modelQuery.sort(sort);
    return this;
  }

  // 📄 Pagination
  paginate() {
    let limit = Math.min(Number(this?.query?.limit) || 10, 50); // Enforce max limit of 50
    let page = Number(this?.query?.page) || 1;
    let skip = (page - 1) * limit;

    this.modelQuery = this.modelQuery.skip(skip).limit(limit);
    return this;
  }

  // 🎯 Field selection
  fields() {
    let fields =
      (this?.query?.fields as string)?.split(',').join(' ') || '-__v';
    this.modelQuery = this.modelQuery.select(fields);
    return this;
  }

  // 🔗 Populating relations and select all fields if undefined
  populate(populateFields: string[], selectFields?: Record<string, unknown>) {
    this.modelQuery = this.modelQuery.populate(
      populateFields.map(field => ({
        path: field,
        select: selectFields?.[field] ?? undefined,
      }))
    );
    return this;
  }

  // 🎯 Populate with match conditions for filtering
  populateWithMatch(
    path: string,
    matchConditions: Record<string, unknown> = {},
    selectFields?: string
  ) {
    this.modelQuery = this.modelQuery.populate({
      path,
      match: matchConditions,
      select: selectFields ?? '-__v',
    });
    return this;
  }

  // 🔍 Search within populated fields
  searchInPopulatedFields(
    path: string,
    searchableFields: string[],
    searchTerm: string,
    additionalMatch: Record<string, unknown> = {}
  ) {
    if (searchTerm) {
      // Sanitize search term to prevent NoSQL injection via regex
      const sanitizedTerm = escapeRegex(searchTerm);

      const searchConditions = {
        $and: [
          {
            $or: searchableFields.map(field => ({
              [field]: {
                $regex: sanitizedTerm,
                $options: 'i',
              },
            })),
          },
          additionalMatch,
        ],
      };

      this.modelQuery = this.modelQuery.populate({
        path,
        match: searchConditions,
        select: '-__v',
      });
    }
    return this;
  }

  // 🧹 Filter out documents with null populated fields
  filterNullPopulatedFields() {
    return this;
  }

  // 📊 Get filtered results with custom pagination
  async getFilteredResults(populatedFieldsToCheck: string[] = []) {
    const _start = Date.now();
    const results = await this.modelQuery;
    // Rely on the global Mongoose metrics plugin to record model/operation for this find.
    // Removing the manual record prevents duplicate hits and avoids 'n/a' metadata entries.

    // Filter out documents where specified populated fields are null
    const filteredResults = results.filter((doc: any) => {
      if (populatedFieldsToCheck.length === 0) {
        return true; // No filtering if no fields specified
      }

      return populatedFieldsToCheck.every((fieldPath: string) => {
        const value = doc.get ? doc.get(fieldPath) : doc[fieldPath];
        return value !== null && value !== undefined;
      });
    });

    // Calculate pagination based on filtered results
    const total = filteredResults.length;
    const limit = Math.min(Number(this?.query?.limit) || 10, 50);
    const page = Number(this?.query?.page) || 1;
    const totalPages = Math.ceil(total / limit);

    const meta = {
      total,
      limit,
      page,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    };

    return {
      data: filteredResults,
      meta,
    };
  }

  // 📊 Pagination info
  async getPaginationInfo() {
    const _start = Date.now();
    const total = await this.modelQuery.model.countDocuments(
      this.modelQuery.getFilter()
    );
    const dur = Date.now() - _start;
    const modelName = (this.modelQuery.model as any)?.modelName || (this.modelQuery.model as any)?.collection?.name;
    recordDbQuery(dur, { model: modelName, operation: 'countDocuments', cacheHit: false });
    const limit = Math.min(Number(this?.query?.limit) || 10, 50);
    const page = Number(this?.query?.page) || 1;
    const totalPages = Math.ceil(total / limit);

    return {
      total,
      limit,
      page,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    };
  }

  // 📄 Cursor-based Pagination
  async cursorPaginate(cursorField: string = '_id') {
    const limit = Math.min(Number(this?.query?.limit) || 10, 50);
    const nextCursor = this?.query?.nextCursor as string | undefined;

    if (nextCursor) {
      let decodedCursorValue: any = nextCursor;
      try {
        decodedCursorValue = Buffer.from(nextCursor, 'base64').toString('ascii');
      } catch (e) {
        // Fallback if not valid base64
      }

      // Check if cursor value is a valid ObjectId (since default is _id)
      if (cursorField === '_id' && mongoose.Types.ObjectId.isValid(decodedCursorValue)) {
        decodedCursorValue = new mongoose.Types.ObjectId(decodedCursorValue);
      }

      // Determine sort direction (default is descending / newest first)
      let isDescending = true;
      const sortOption = (this.modelQuery as any).options?.sort;
      if (sortOption) {
        if (typeof sortOption === 'string') {
          isDescending = sortOption.startsWith('-');
        } else if (typeof sortOption === 'object') {
          const val = sortOption[cursorField];
          if (val === 1 || val === 'asc' || val === 'ascending') {
            isDescending = false;
          }
        }
      } else if (this?.query?.sort && typeof this.query.sort === 'string') {
        isDescending = this.query.sort.startsWith('-');
      }

      const operator = isDescending ? '$lt' : '$gt';

      this.modelQuery = this.modelQuery.find({
        [cursorField]: { [operator]: decodedCursorValue },
      } as FilterQuery<T>);
    }

    // Fetch limit + 1 to check if there is a next page
    this.modelQuery = this.modelQuery.limit(limit + 1);

    const _start = Date.now();
    const results = await this.modelQuery;
    const dur = Date.now() - _start;
    const modelName = (this.modelQuery.model as any)?.modelName || (this.modelQuery.model as any)?.collection?.name;
    recordDbQuery(dur, { model: modelName, operation: 'find', cacheHit: false });

    const hasMore = results.length > limit;
    const data = hasMore ? results.slice(0, limit) : results;

    let newCursor: string | null = null;
    if (hasMore && data.length > 0) {
      const lastItem = data[data.length - 1] as any;
      const lastValue = String(lastItem[cursorField]);
      newCursor = Buffer.from(lastValue).toString('base64');
    }

    return {
      data,
      meta: {
        limit,
        nextCursor: newCursor,
        hasNext: hasMore,
      },
    };
  }
}

export default QueryBuilder;
