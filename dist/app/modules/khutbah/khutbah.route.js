"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.KhutbaRoutes = void 0;
const express_1 = __importDefault(require("express"));
const user_1 = require("../../../enums/user");
const auth_1 = __importDefault(require("../../middlewares/auth"));
const fileHandler_1 = require("../../middlewares/fileHandler");
const validateRequest_1 = __importDefault(require("../../middlewares/validateRequest"));
const khutbah_controller_1 = require("./khutbah.controller");
const khutbah_validation_1 = require("./khutbah.validation");
const router = express_1.default.Router();
router.get('/', khutbah_controller_1.KhutbaController.getAllKhutbahs);
router.get('/:khutbaId', khutbah_controller_1.KhutbaController.getSingleKhutba);
router.post('/', (0, auth_1.default)(user_1.USER_ROLES.SUPER_ADMIN), (0, fileHandler_1.fileHandler)([
    { name: 'audio', maxCount: 1 },
    { name: 'thumbnail', maxCount: 1 },
], { maxFileSizeMB: 100 }), (0, validateRequest_1.default)(khutbah_validation_1.KhutbaValidation.createKhutbaZodSchema), khutbah_controller_1.KhutbaController.createKhutba);
router.patch('/:khutbaId', (0, auth_1.default)(user_1.USER_ROLES.SUPER_ADMIN), (0, fileHandler_1.fileHandler)([
    { name: 'audio', maxCount: 1 },
    { name: 'thumbnail', maxCount: 1 },
], { maxFileSizeMB: 100 }), (0, validateRequest_1.default)(khutbah_validation_1.KhutbaValidation.updateKhutbaZodSchema), khutbah_controller_1.KhutbaController.updateKhutba);
router.delete('/:khutbaId', (0, auth_1.default)(user_1.USER_ROLES.SUPER_ADMIN), khutbah_controller_1.KhutbaController.deleteKhutba);
exports.KhutbaRoutes = router;
