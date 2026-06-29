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
exports.AdminService = void 0;
const AggregationBuilder_1 = __importDefault(require("../../builder/AggregationBuilder"));
const user_1 = require("../../../enums/user");
const user_model_1 = require("../user/user.model");
const support_ticket_model_1 = require("../support-ticket/support-ticket.model");
const formatMetric = (stat) => ({
    value: stat.total,
    changePct: stat.growth,
    direction: stat.growthType === 'increase'
        ? 'up'
        : stat.growthType === 'decrease'
            ? 'down'
            : 'neutral',
});
const getAdminDashboardStats = () => __awaiter(void 0, void 0, void 0, function* () {
    const userBuilder = new AggregationBuilder_1.default(user_model_1.User);
    const [totalUsers, activeUsers, pendingVerification,] = yield Promise.all([
        userBuilder.calculateGrowth({ period: 'month' }),
        userBuilder.calculateGrowth({ filter: { status: user_1.USER_STATUS.ACTIVE }, period: 'month' }),
        userBuilder.calculateGrowth({ filter: { status: user_1.USER_STATUS.PENDING }, period: 'month' }),
    ]);
    return {
        meta: {
            comparisonPeriod: 'month',
        },
        totalUsers: formatMetric(totalUsers),
        activeUsers: formatMetric(activeUsers),
        pendingVerification: formatMetric(pendingVerification),
    };
});
const getRecentActivities = () => __awaiter(void 0, void 0, void 0, function* () {
    const [recentUsers, recentTickets] = yield Promise.all([
        user_model_1.User.find({ deletedAt: { $exists: false } })
            .sort({ createdAt: -1 })
            .limit(10)
            .select('name role status profileImage createdAt')
            .lean(),
        support_ticket_model_1.SupportTicket.find()
            .sort({ createdAt: -1 })
            .limit(10)
            .select('subject status ticketNumber createdAt')
            .lean()
    ]);
    const activities = [
        ...recentUsers.map((user) => ({
            id: user._id,
            type: 'REGISTRATION',
            title: `${user.name} registered as a ${user.role}`,
            status: user.status,
            timestamp: user.createdAt,
            image: user.profileImage,
        })),
        ...recentTickets.map((t) => ({
            id: t._id,
            type: 'SUPPORT_TICKET',
            title: `Support Ticket Opened: #${t.ticketNumber} - ${t.subject}`,
            status: t.status,
            timestamp: t.createdAt,
        }))
    ];
    return activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(0, 10);
});
exports.AdminService = {
    getAdminDashboardStats,
    getRecentActivities,
};
