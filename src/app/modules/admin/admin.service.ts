import AggregationBuilder from '../../builder/AggregationBuilder';
import { USER_STATUS } from '../../../enums/user';
import { User } from '../user/user.model';
import { SupportTicket } from '../support-ticket/support-ticket.model';

const formatMetric = (stat: any) => ({
  value: stat.total,
  changePct: stat.growth,
  direction:
    stat.growthType === 'increase'
      ? 'up'
      : stat.growthType === 'decrease'
        ? 'down'
        : 'neutral',
});

const getAdminDashboardStats = async () => {
  const userBuilder = new AggregationBuilder(User);

  const [
    totalUsers,
    activeUsers,
    pendingVerification,
  ] = await Promise.all([
    userBuilder.calculateGrowth({ period: 'month' }),
    userBuilder.calculateGrowth({ filter: { status: USER_STATUS.ACTIVE }, period: 'month' }),
    userBuilder.calculateGrowth({ filter: { status: USER_STATUS.PENDING }, period: 'month' }),
  ]);

  return {
    meta: {
      comparisonPeriod: 'month',
    },
    totalUsers: formatMetric(totalUsers),
    activeUsers: formatMetric(activeUsers),
    pendingVerification: formatMetric(pendingVerification),
  };
};

const getRecentActivities = async () => {
  const [recentUsers, recentTickets] = await Promise.all([
    User.find({ deletedAt: { $exists: false } })
      .sort({ createdAt: -1 })
      .limit(10)
      .select('name role status profileImage createdAt')
      .lean(),
    SupportTicket.find()
      .sort({ createdAt: -1 })
      .limit(10)
      .select('subject status ticketNumber createdAt')
      .lean()
  ]);

  const activities: any[] = [
    ...recentUsers.map((user: any) => ({
      id: user._id,
      type: 'REGISTRATION',
      title: `${user.name} registered as a ${user.role}`,
      status: user.status,
      timestamp: user.createdAt,
      image: user.profileImage,
    })),
    ...recentTickets.map((t: any) => ({
      id: t._id,
      type: 'SUPPORT_TICKET',
      title: `Support Ticket Opened: #${t.ticketNumber} - ${t.subject}`,
      status: t.status,
      timestamp: t.createdAt,
    }))
  ];

  return activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(0, 10);
};

export const AdminService = {
  getAdminDashboardStats,
  getRecentActivities,
};
