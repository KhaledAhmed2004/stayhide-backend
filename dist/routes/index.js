"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const auth_route_1 = require("../app/modules/auth/auth.route");
const user_route_1 = require("../app/modules/user/user.route");
const notification_routes_1 = require("../app/modules/notification/notification.routes");
const subscription_route_1 = require("../app/modules/subscription/subscription.route");
const admin_route_1 = require("../app/modules/admin/admin.route");
const legal_route_1 = require("../app/modules/legal/legal.route");
const pending_email_route_1 = require("../app/modules/pending-email/pending-email.route");
const support_ticket_route_1 = require("../app/modules/support-ticket/support-ticket.route");
const chat_route_1 = require("../app/modules/chat/chat.route");
const message_route_1 = require("../app/modules/message/message.route");
const medicine_route_1 = require("../app/modules/medicine/medicine.route");
const symptom_log_route_1 = require("../app/modules/symptom-log/symptom-log.route");
const diet_log_route_1 = require("../app/modules/diet-log/diet-log.route");
const ai_coach_route_1 = require("../app/modules/ai-coach/ai-coach.route");
const router = express_1.default.Router();
const apiRoutes = [
    {
        path: '/users',
        route: user_route_1.UserRoutes,
    },
    {
        path: '/symptom-logs',
        route: symptom_log_route_1.SymptomLogRoutes,
    },
    {
        path: '/auth',
        route: auth_route_1.AuthRoutes,
    },
    {
        path: '/notifications',
        route: notification_routes_1.NotificationRoutes,
    },
    {
        path: '/subscriptions',
        route: subscription_route_1.SubscriptionRoutes,
    },
    {
        path: '/admin',
        route: admin_route_1.AdminRoutes,
    },
    {
        path: '/legal',
        route: legal_route_1.LegalRoutes,
    },
    {
        path: '/admin/pending-emails',
        route: pending_email_route_1.PendingEmailRoutes,
    },
    {
        path: '/support-tickets',
        route: support_ticket_route_1.SupportTicketRoutes,
    },
    {
        path: '/chats',
        route: chat_route_1.ChatRoutes,
    },
    {
        path: '/messages',
        route: message_route_1.MessageRoutes,
    },
    {
        path: '/medicines',
        route: medicine_route_1.MedicationRoutes,
    },
    {
        path: '/diet-logs',
        route: diet_log_route_1.DietLogRoutes,
    },
    {
        path: '/ai-coach',
        route: ai_coach_route_1.AiCoachRoutes,
    },
];
apiRoutes.forEach(route => router.use(route.path, route.route));
exports.default = router;
