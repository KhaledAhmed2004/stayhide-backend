"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MosqueService = void 0;
const http_status_codes_1 = require("http-status-codes");
const ApiError_1 = __importDefault(require("../../../errors/ApiError"));
const mosque_model_1 = __importDefault(require("./mosque.model"));
const createMosqueIntoDB = (payload) => __awaiter(void 0, void 0, void 0, function* () {
    // Transform legacy location format if provided
    const loc = payload.location;
    if (loc && loc.latitude !== undefined && loc.longitude !== undefined) {
        payload.location = {
            type: 'Point',
            coordinates: [loc.longitude, loc.latitude],
        };
    }
    const result = yield mosque_model_1.default.create(payload);
    return result;
});
const getAllMosquesFromDB = (query) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const { latitude, longitude, searchTerm, filter, // 'nearby-me'
    page = 1, limit = 10 } = query, filters = __rest(query, ["latitude", "longitude", "searchTerm", "filter", "page", "limit"]);
    const match = Object.assign({}, filters);
    if (searchTerm) {
        match.$or = [
            { mosqueName: { $regex: searchTerm, $options: 'i' } },
            { area: { $regex: searchTerm, $options: 'i' } },
            { address: { $regex: searchTerm, $options: 'i' } },
            { description: { $regex: searchTerm, $options: 'i' } },
        ];
    }
    const skip = (Number(page) - 1) * Number(limit);
    const pipeline = [];
    // 1. Proximity Search & Sorting Logic
    if (latitude && longitude) {
        const userLat = parseFloat(latitude);
        const userLng = parseFloat(longitude);
        if (!isNaN(userLat) && !isNaN(userLng)) {
            pipeline.push({
                $geoNear: {
                    near: { type: 'Point', coordinates: [userLng, userLat] },
                    distanceField: 'distanceInKm',
                    spherical: true,
                    distanceMultiplier: 0.001,
                    query: match,
                },
            });
            // If NOT explicitly nearby-me, sort by createdAt but keep distanceInKm
            if (filter !== 'nearby-me') {
                pipeline.push({ $sort: { createdAt: -1 } });
            }
        }
        else {
            pipeline.push({ $match: match });
            pipeline.push({ $sort: { createdAt: -1 } });
        }
    }
    else {
        pipeline.push({ $match: match });
        pipeline.push({ $sort: { createdAt: -1 } });
    }
    // 2. Projection (Flatten for UI)
    pipeline.push({
        $project: {
            _id: 1,
            id: '$_id',
            mosqueName: 1,
            address: 1,
            area: 1,
            phoneNumber: { $ifNull: ['$phoneNumber', ''] },
            website: { $ifNull: ['$website', ''] },
            description: { $ifNull: ['$description', ''] },
            image: { $ifNull: ['$image', ''] },
            prayerTimes: 1,
            distanceInKm: 1,
            updatedAt: 1,
            latitude: { $ifNull: [{ $arrayElemAt: ['$location.coordinates', 1] }, 0] },
            longitude: { $ifNull: [{ $arrayElemAt: ['$location.coordinates', 0] }, 0] },
            mapLink: {
                $concat: [
                    'https://www.google.com/maps/search/?api=1&query=',
                    { $toString: { $ifNull: [{ $arrayElemAt: ['$location.coordinates', 1] }, 0] } },
                    ',',
                    { $toString: { $ifNull: [{ $arrayElemAt: ['$location.coordinates', 0] }, 0] } },
                ],
            },
        },
    });
    // 3. Pagination
    pipeline.push({
        $facet: {
            data: [{ $skip: skip }, { $limit: Number(limit) }],
            totalCount: [{ $count: 'total' }],
        },
    });
    const result = yield mosque_model_1.default.aggregate(pipeline);
    const data = result[0].data;
    const total = ((_a = result[0].totalCount[0]) === null || _a === void 0 ? void 0 : _a.total) || 0;
    const totalPages = Math.ceil(total / Number(limit));
    return {
        data,
        pagination: {
            page: Number(page),
            limit: Number(limit),
            total,
            totalPages,
        },
    };
});
const getSingleMosqueFromDB = (id) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield mosque_model_1.default.findById(id).lean();
    if (!result) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, 'Mosque not found');
    }
    // Ensure fields exist for consistency
    result.id = result._id;
    result.phoneNumber = result.phoneNumber || '';
    result.website = result.website || '';
    result.description = result.description || '';
    result.image = result.image || '';
    // Flatten location for consistency with list API
    if (result.location && result.location.coordinates) {
        const latitude = result.location.coordinates[1];
        const longitude = result.location.coordinates[0];
        result.latitude = latitude;
        result.longitude = longitude;
        result.mapLink = `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
        delete result.location;
    }
    else {
        result.latitude = 0;
        result.longitude = 0;
        result.mapLink = `https://www.google.com/maps/search/?api=1&query=0,0`;
    }
    return result;
});
const updateMosqueIntoDB = (id, payload) => __awaiter(void 0, void 0, void 0, function* () {
    const { location, prayerTimes } = payload, remainingData = __rest(payload, ["location", "prayerTimes"]);
    const modifiedUpdatedData = Object.assign({}, remainingData);
    if (location) {
        const _a = location, { latitude, longitude } = _a, remainingLocation = __rest(_a, ["latitude", "longitude"]);
        if (latitude !== undefined && longitude !== undefined) {
            modifiedUpdatedData['location'] = Object.assign(Object.assign({}, remainingLocation), { type: 'Point', coordinates: [longitude, latitude] });
        }
        else {
            for (const [key, value] of Object.entries(location)) {
                modifiedUpdatedData[`location.${key}`] = value;
            }
        }
    }
    if (prayerTimes && Object.keys(prayerTimes).length > 0) {
        for (const [key, value] of Object.entries(prayerTimes)) {
            modifiedUpdatedData[`prayerTimes.${key}`] = value;
        }
    }
    const result = yield mosque_model_1.default.findByIdAndUpdate(id, modifiedUpdatedData, {
        new: true,
        runValidators: true,
    }).lean();
    if (!result) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, 'Mosque not found');
    }
    return result;
});
const deleteMosqueFromDB = (id) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield mosque_model_1.default.findByIdAndDelete(id).lean();
    if (!result) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, 'Mosque not found');
    }
    return result;
});
exports.MosqueService = {
    createMosqueIntoDB,
    getAllMosquesFromDB,
    getSingleMosqueFromDB,
    updateMosqueIntoDB,
    deleteMosqueFromDB,
};
