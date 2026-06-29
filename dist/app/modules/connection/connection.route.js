"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConnectionRoutes = void 0;
const express_1 = __importDefault(require("express"));
const user_1 = require("../../../enums/user");
const auth_1 = __importDefault(require("../../middlewares/auth"));
const validateRequest_1 = __importDefault(require("../../middlewares/validateRequest"));
const connection_controller_1 = require("./connection.controller");
const connection_validation_1 = require("./connection.validation");
const router = express_1.default.Router();
// List pending requests (sent or received)
router.get('/requests', (0, auth_1.default)(user_1.USER_ROLES.BROTHER, user_1.USER_ROLES.SISTER), connection_controller_1.ConnectionController.getPendingConnectionRequests);
// List my accepted connections
router.get('/', (0, auth_1.default)(user_1.USER_ROLES.BROTHER, user_1.USER_ROLES.SISTER), connection_controller_1.ConnectionController.getMyConnections);
// Send connection request
router.post('/', (0, auth_1.default)(user_1.USER_ROLES.BROTHER, user_1.USER_ROLES.SISTER), (0, validateRequest_1.default)(connection_validation_1.ConnectionValidation.sendConnectionRequestSchema), connection_controller_1.ConnectionController.sendConnectionRequest);
// Accept a pending connection request
router.post('/:connectionId/accept', (0, auth_1.default)(user_1.USER_ROLES.BROTHER, user_1.USER_ROLES.SISTER), (0, validateRequest_1.default)(connection_validation_1.ConnectionValidation.connectionIdParamSchema), connection_controller_1.ConnectionController.acceptConnection);
// Reject a pending connection request
router.post('/:connectionId/reject', (0, auth_1.default)(user_1.USER_ROLES.BROTHER, user_1.USER_ROLES.SISTER), (0, validateRequest_1.default)(connection_validation_1.ConnectionValidation.connectionIdParamSchema), connection_controller_1.ConnectionController.rejectConnection);
// Cancel a pending request (sender undoes their own request)
router.post('/:connectionId/cancel', (0, auth_1.default)(user_1.USER_ROLES.BROTHER, user_1.USER_ROLES.SISTER), (0, validateRequest_1.default)(connection_validation_1.ConnectionValidation.connectionIdParamSchema), connection_controller_1.ConnectionController.cancelConnectionRequest);
// Remove an accepted connection
router.post('/:connectionId/remove', (0, auth_1.default)(user_1.USER_ROLES.BROTHER, user_1.USER_ROLES.SISTER), (0, validateRequest_1.default)(connection_validation_1.ConnectionValidation.connectionIdParamSchema), connection_controller_1.ConnectionController.removeConnection);
exports.ConnectionRoutes = router;
