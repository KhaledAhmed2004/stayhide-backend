import express from 'express';
import { AuthRoutes } from '../app/modules/auth/auth.route';
import { UserRoutes } from '../app/modules/user/user.route';
import { NotificationRoutes } from '../app/modules/notification/notification.routes';
import { SubscriptionRoutes } from '../app/modules/subscription/subscription.route';
import { AdminRoutes } from '../app/modules/admin/admin.route';
import { LegalRoutes } from '../app/modules/legal/legal.route';
import { PendingEmailRoutes } from '../app/modules/pending-email/pending-email.route';
import { SupportTicketRoutes } from '../app/modules/support-ticket/support-ticket.route';
import { ChatRoutes } from '../app/modules/chat/chat.route';
import { MessageRoutes } from '../app/modules/message/message.route';
import { MedicationRoutes } from '../app/modules/medicine/medicine.route';
import { SymptomLogRoutes } from '../app/modules/symptom-log/symptom-log.route';
import { DietLogRoutes } from '../app/modules/diet-log/diet-log.route';
import { AiCoachRoutes } from '../app/modules/ai-coach/ai-coach.route';
const router = express.Router();

const apiRoutes = [
  {
    path: '/users',
    route: UserRoutes,
  },
  {
    path: '/symptom-logs',
    route: SymptomLogRoutes,
  },
  {
    path: '/auth',
    route: AuthRoutes,
  },
  {
    path: '/notifications',
    route: NotificationRoutes,
  },
  {
    path: '/subscriptions',
    route: SubscriptionRoutes,
  },
  {
    path: '/admin',
    route: AdminRoutes,
  },
  {
    path: '/legal',
    route: LegalRoutes,
  },
  {
    path: '/admin/pending-emails',
    route: PendingEmailRoutes,
  },
  {
    path: '/support-tickets',
    route: SupportTicketRoutes,
  },
  {
    path: '/chats',
    route: ChatRoutes,
  },
  {
    path: '/messages',
    route: MessageRoutes,
  },
  {
    path: '/medicines',
    route: MedicationRoutes,
  },
  {
    path: '/diet-logs',
    route: DietLogRoutes,
  },
  {
    path: '/ai-coach',
    route: AiCoachRoutes,
  },
];

apiRoutes.forEach(route => router.use(route.path, route.route));

export default router;
