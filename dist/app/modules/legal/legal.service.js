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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LegalService = void 0;
const http_status_codes_1 = require("http-status-codes");
const slugify_1 = __importDefault(require("slugify"));
const ApiError_1 = __importDefault(require("../../../errors/ApiError"));
const legal_model_1 = require("./legal.model");
const generateSlug = (title) => __awaiter(void 0, void 0, void 0, function* () {
    const slug = (0, slugify_1.default)(title, { lower: true, strict: true });
    const existing = yield legal_model_1.LegalPage.findOne({ slug });
    if (existing) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.CONFLICT, 'A legal page with this title already exists');
    }
    return slug;
});
const createLegalPage = (payload) => __awaiter(void 0, void 0, void 0, function* () {
    if (!payload.title) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'Title is required');
    }
    const slug = yield generateSlug(payload.title);
    yield legal_model_1.LegalPage.create(Object.assign(Object.assign({}, payload), { slug }));
    const result = yield legal_model_1.LegalPage.findOne({ slug }).select('slug title content createdAt');
    return result;
});
const getAll = () => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield legal_model_1.LegalPage.find()
        .select('-_id slug title')
        .sort({ title: 1 });
    return result;
});
const getBySlug = (slug) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield legal_model_1.LegalPage.findOne({ slug }).select('-_id slug title content updatedAt');
    if (!result) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, 'Legal page not found');
    }
    return result;
});
const updateBySlug = (slug, payload) => __awaiter(void 0, void 0, void 0, function* () {
    const updateData = {};
    if (payload.title) {
        const newSlug = yield generateSlug(payload.title);
        updateData.title = payload.title;
        updateData.slug = newSlug;
    }
    if (payload.content) {
        updateData.content = payload.content;
    }
    const result = yield legal_model_1.LegalPage.findOneAndUpdate({ slug }, updateData, {
        new: true,
    }).select('slug title content updatedAt');
    if (!result) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, 'Legal page not found');
    }
    return result;
});
const deleteBySlug = (slug) => __awaiter(void 0, void 0, void 0, function* () {
    const existing = yield legal_model_1.LegalPage.findOne({ slug });
    if (!existing) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, 'Legal page not found');
    }
    yield legal_model_1.LegalPage.findOneAndDelete({ slug });
});
exports.LegalService = {
    createLegalPage,
    getAll,
    getBySlug,
    updateBySlug,
    deleteBySlug,
};
