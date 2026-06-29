"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LegalRoutes = void 0;
const express_1 = __importDefault(require("express"));
const user_1 = require("../../../enums/user");
const auth_1 = __importDefault(require("../../middlewares/auth"));
const validateRequest_1 = __importDefault(require("../../middlewares/validateRequest"));
const legal_controller_1 = require("./legal.controller");
const legal_validation_1 = require("./legal.validation");
const router = express_1.default.Router();
// Get all legal pages
router.get('/', legal_controller_1.LegalController.getAll);
// Get a legal page by slug
router.get('/:slug', legal_controller_1.LegalController.getBySlug);
// Create a new legal page
router.post('/', (0, auth_1.default)(user_1.USER_ROLES.ADMIN), (0, validateRequest_1.default)(legal_validation_1.LegalValidation.createLegalPage), legal_controller_1.LegalController.createLegalPage);
// Update a legal page by slug
router.patch('/:slug', (0, auth_1.default)(user_1.USER_ROLES.ADMIN), (0, validateRequest_1.default)(legal_validation_1.LegalValidation.updateLegalPage), legal_controller_1.LegalController.updateBySlug);
// Delete a legal page by slug
router.delete('/:slug', (0, auth_1.default)(user_1.USER_ROLES.ADMIN), (0, validateRequest_1.default)(legal_validation_1.LegalValidation.deleteLegalPage), legal_controller_1.LegalController.deleteBySlug);
exports.LegalRoutes = router;
