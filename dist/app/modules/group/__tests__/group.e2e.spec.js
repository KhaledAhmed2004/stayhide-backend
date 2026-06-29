"use strict";
/**
 * E2E tests for Group module
 *
 * Uses supertest to hit the actual API endpoints.
 * Uses mongodb-memory-server (ReplSet) for real MongoDB transactions.
 * Mocks NotificationBuilder, Redis, and global Socket.io.
 */
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
const vitest_1 = require("vitest");
const mongoose_1 = __importDefault(require("mongoose"));
const mongodb_memory_server_1 = require("mongodb-memory-server");
const supertest_1 = __importDefault(require("supertest"));
const app_1 = __importDefault(require("../../../../app"));
const user_model_1 = require("../../user/user.model");
const group_model_1 = require("../group.model");
const jwtHelper_1 = require("../../../../helpers/jwtHelper");
const config_1 = __importDefault(require("../../../../config"));
const user_1 = require("../../../../enums/user");
const testLogger_1 = require("../../../../helpers/__tests__/testLogger");
// ── Mocks ────────────────────────────────────────────────────────────────────
vitest_1.vi.mock('../../../builder/NotificationBuilder/NotificationBuilder', () => {
    const mockSend = vitest_1.vi.fn().mockResolvedValue({ success: true });
    const mockBuilder = {
        to: vitest_1.vi.fn().mockReturnThis(),
        setTitle: vitest_1.vi.fn().mockReturnThis(),
        setText: vitest_1.vi.fn().mockReturnThis(),
        setType: vitest_1.vi.fn().mockReturnThis(),
        setResource: vitest_1.vi.fn().mockReturnThis(),
        viaAll: vitest_1.vi.fn().mockReturnThis(),
        send: mockSend,
    };
    return {
        default: vitest_1.vi.fn().mockImplementation(() => mockBuilder),
    };
});
vitest_1.vi.mock('../../notification/notificationsHelper', () => ({
    sendNotifications: vitest_1.vi.fn().mockResolvedValue(true),
}));
// Mock Redis to prevent connection issues
vitest_1.vi.mock('../../../../shared/redisClient', () => ({
    redisClient: {
        get: vitest_1.vi.fn().mockResolvedValue(null),
        set: vitest_1.vi.fn().mockResolvedValue('OK'),
        del: vitest_1.vi.fn().mockResolvedValue(1),
        mget: vitest_1.vi.fn().mockResolvedValue([]),
        on: vitest_1.vi.fn(),
    },
}));
// ── Test helpers ─────────────────────────────────────────────────────────────
let replSet;
/** Create a verified user and return its document and a valid JWT. */
function createAuthUser() {
    return __awaiter(this, arguments, void 0, function* (role = user_1.USER_ROLES.BROTHER, nameSuffix = 'user') {
        const user = yield user_model_1.User.create({
            name: `Test ${role} ${nameSuffix}`,
            role,
            email: `test-${role}-${nameSuffix}-${Date.now()}-${Math.random()}@example.com`,
            password: 'password123',
            isVerified: true,
            status: user_1.USER_STATUS.ACTIVE,
            revertDate: new Date(),
            dateOfBirth: new Date('1990-01-01'),
            profileImage: '/default-avatar.svg',
            verificationImage: 'https://example.com/img.jpg',
            verificationVideo: 'https://example.com/vid.mp4',
            tokenVersion: 0,
        });
        const token = jwtHelper_1.jwtHelper.createToken({ id: user._id, role: user.role, tokenVersion: user.tokenVersion }, config_1.default.jwt.jwt_secret, '1h');
        return { user, token };
    });
}
// ── Lifecycle ────────────────────────────────────────────────────────────────
(0, vitest_1.beforeAll)(() => __awaiter(void 0, void 0, void 0, function* () {
    if (mongoose_1.default.connection.readyState !== 0) {
        yield mongoose_1.default.disconnect();
    }
    replSet = yield mongodb_memory_server_1.MongoMemoryReplSet.create({
        replSet: { count: 1 }
    });
    const uri = replSet.getUri();
    yield mongoose_1.default.connect(uri, {
        serverSelectionTimeoutMS: 5000,
    });
}));
(0, vitest_1.afterAll)(() => __awaiter(void 0, void 0, void 0, function* () {
    yield mongoose_1.default.connection.close();
    yield mongoose_1.default.disconnect();
    yield new Promise(resolve => setTimeout(resolve, 500)); // Small delay to allow connections to drain
    if (replSet) {
        yield replSet.stop();
    }
}));
(0, vitest_1.beforeEach)(() => __awaiter(void 0, void 0, void 0, function* () {
    if (mongoose_1.default.connection.readyState === 1) {
        const collections = mongoose_1.default.connection.collections;
        for (const key in collections) {
            yield collections[key].deleteMany({});
        }
    }
    vitest_1.vi.clearAllMocks();
    // Mock global io
    global.io = {
        to: vitest_1.vi.fn().mockReturnThis(),
        emit: vitest_1.vi.fn(),
    };
}));
// ── Tests ────────────────────────────────────────────────────────────────────
(0, vitest_1.describe)('Group E2E Tests', () => {
    (0, vitest_1.describe)('Full Group Lifecycle & Social Interactions', () => {
        (0, vitest_1.it)('comprehensive flow: admin creates group, users join, post, like, comment, and admin manages members/posts', { timeout: 30000 }, () => __awaiter(void 0, void 0, void 0, function* () {
            // Step 1: Create users
            const { user: admin, token: adminToken } = yield createAuthUser(user_1.USER_ROLES.SUPER_ADMIN, 'admin');
            const { user: userA, token: tokenA } = yield createAuthUser(user_1.USER_ROLES.BROTHER, 'userA');
            const { user: userB, token: tokenB } = yield createAuthUser(user_1.USER_ROLES.BROTHER, 'userB');
            const { user: userC, token: tokenC } = yield createAuthUser(user_1.USER_ROLES.SISTER, 'userC');
            // --- GROUP CREATION (ADMIN) ---
            const groupData = {
                name: 'Quran Study Circle',
                description: 'A group for brothers to study the Quran together.',
                userType: user_1.USER_ROLES.BROTHER,
                category: 'Spiritual',
                coverImage: 'https://example.com/cover.jpg',
            };
            const createGroupResponse = yield (0, supertest_1.default)(app_1.default)
                .post('/api/v1/groups')
                .set('Authorization', `Bearer ${adminToken}`)
                .send(groupData);
            (0, testLogger_1.logApi)('POST', '/api/v1/groups', { body: groupData }, createGroupResponse.body, 'CREATE-GROUP', 'Admin creates a new Quran study group');
            (0, vitest_1.expect)(createGroupResponse.status).toBe(201);
            const groupId = createGroupResponse.body.data.id;
            (0, vitest_1.expect)(groupId).toBeDefined();
            // --- ADMIN CREATES SISTER GROUP (FOR FILTERING TEST) ---
            const sisterGroupData = {
                name: 'Sisterhood Circle',
                description: 'A group for sisters.',
                userType: user_1.USER_ROLES.SISTER,
                category: 'Community',
                coverImage: 'https://example.com/sister-cover.jpg',
            };
            yield (0, supertest_1.default)(app_1.default)
                .post('/api/v1/groups')
                .set('Authorization', `Bearer ${adminToken}`)
                .send(sisterGroupData);
            // --- ADMIN FETCHES ALL GROUPS ---
            const adminAllGroupsResponse = yield (0, supertest_1.default)(app_1.default)
                .get('/api/v1/groups')
                .set('Authorization', `Bearer ${adminToken}`);
            (0, testLogger_1.logApi)('GET', '/api/v1/groups', {}, adminAllGroupsResponse.body, 'LIST-GROUPS-ADMIN-ALL', 'Admin fetches all groups (should see both)');
            (0, vitest_1.expect)(adminAllGroupsResponse.body.data).toHaveLength(2);
            // --- ADMIN FILTERS BY USER TYPE (BROTHER) ---
            const adminBrotherFilterResponse = yield (0, supertest_1.default)(app_1.default)
                .get('/api/v1/groups?userType=BROTHER')
                .set('Authorization', `Bearer ${adminToken}`);
            (0, testLogger_1.logApi)('GET', '/api/v1/groups', { query: { userType: 'BROTHER' } }, adminBrotherFilterResponse.body, 'LIST-GROUPS-ADMIN-FILTER-BROTHER', 'Admin filters groups by userType=BROTHER');
            (0, vitest_1.expect)(adminBrotherFilterResponse.body.data).toHaveLength(1);
            (0, vitest_1.expect)(adminBrotherFilterResponse.body.data[0].userType).toBe(user_1.USER_ROLES.BROTHER);
            // --- ADMIN FILTERS BY USER TYPE (SISTER) ---
            const adminSisterFilterResponse = yield (0, supertest_1.default)(app_1.default)
                .get('/api/v1/groups?userType=SISTER')
                .set('Authorization', `Bearer ${adminToken}`);
            (0, testLogger_1.logApi)('GET', '/api/v1/groups', { query: { userType: 'SISTER' } }, adminSisterFilterResponse.body, 'LIST-GROUPS-ADMIN-FILTER-SISTER', 'Admin filters groups by userType=SISTER');
            (0, vitest_1.expect)(adminSisterFilterResponse.body.data).toHaveLength(1);
            (0, vitest_1.expect)(adminSisterFilterResponse.body.data[0].userType).toBe(user_1.USER_ROLES.SISTER);
            // --- LIST GROUPS (GENDER ISOLATION CHECK) ---
            // User A (BROTHER) should see the group
            const brotherListResponse = yield (0, supertest_1.default)(app_1.default)
                .get('/api/v1/groups')
                .set('Authorization', `Bearer ${tokenA}`);
            (0, testLogger_1.logApi)('GET', '/api/v1/groups', {}, brotherListResponse.body, 'LIST-GROUPS-BROTHER', 'User A (BROTHER) fetches group list');
            (0, vitest_1.expect)(brotherListResponse.body.data.some((g) => g.id === groupId)).toBe(true);
            // Verify isMember is false before joining
            const groupInListBeforeJoin = brotherListResponse.body.data.find((g) => g.id === groupId);
            (0, vitest_1.expect)(groupInListBeforeJoin.isMember).toBe(false);
            // User C (SISTER) should NOT see the group (since it is userType: BROTHER)
            const sisterListResponse = yield (0, supertest_1.default)(app_1.default)
                .get('/api/v1/groups')
                .set('Authorization', `Bearer ${tokenC}`);
            (0, testLogger_1.logApi)('GET', '/api/v1/groups', {}, sisterListResponse.body, 'LIST-GROUPS-SISTER', 'User C (SISTER) fetches group list (should be empty/no brother groups)');
            (0, vitest_1.expect)(sisterListResponse.body.data.some((g) => g.id === groupId)).toBe(false);
            // --- GET SINGLE GROUP DETAILS (USER A) ---
            const singleGroupResponse = yield (0, supertest_1.default)(app_1.default)
                .get(`/api/v1/groups/${groupId}`)
                .set('Authorization', `Bearer ${tokenA}`);
            (0, testLogger_1.logApi)('GET', `/api/v1/groups/:groupId`, { params: { groupId } }, singleGroupResponse.body, 'GET-SINGLE-GROUP', 'User A fetches group details (isMember: false)');
            (0, vitest_1.expect)(singleGroupResponse.status).toBe(200);
            (0, vitest_1.expect)(singleGroupResponse.body.data.id).toBe(groupId);
            (0, vitest_1.expect)(singleGroupResponse.body.data.isMember).toBe(false);
            // --- JOIN GROUP ---
            const joinResponse = yield (0, supertest_1.default)(app_1.default)
                .post(`/api/v1/groups/${groupId}/join`)
                .set('Authorization', `Bearer ${tokenA}`);
            (0, testLogger_1.logApi)('POST', `/api/v1/groups/:groupId/join`, { params: { groupId } }, joinResponse.body, 'JOIN-GROUP', 'User A joins the group');
            (0, vitest_1.expect)(joinResponse.status).toBe(200);
            (0, vitest_1.expect)(joinResponse.body.success).toBe(true);
            // Verify isMember is true after joining
            const brotherListResponseAfterJoin = yield (0, supertest_1.default)(app_1.default)
                .get('/api/v1/groups')
                .set('Authorization', `Bearer ${tokenA}`);
            const groupInListAfterJoin = brotherListResponseAfterJoin.body.data.find((g) => g.id === groupId);
            (0, vitest_1.expect)(groupInListAfterJoin.isMember).toBe(true);
            // User B also joins
            yield (0, supertest_1.default)(app_1.default)
                .post(`/api/v1/groups/${groupId}/join`)
                .set('Authorization', `Bearer ${tokenB}`);
            // --- POST CREATION (WITH ATTACHMENTS) ---
            const postData = {
                content: 'Assalamu alaikum brothers, I just finished reading Surah Al-Kahf.',
                attachments: ['https://example.com/kahf-notes.pdf', 'https://example.com/kahf-audio.mp3'],
            };
            const postResponse = yield (0, supertest_1.default)(app_1.default)
                .post(`/api/v1/groups/${groupId}/posts`)
                .set('Authorization', `Bearer ${tokenA}`)
                .send(postData);
            (0, testLogger_1.logApi)('POST', `/api/v1/groups/:groupId/posts`, { params: { groupId }, body: postData }, postResponse.body, 'CREATE-POST', 'User A creates a post with attachments');
            (0, vitest_1.expect)(postResponse.status).toBe(201);
            const postId = postResponse.body.data.id;
            (0, vitest_1.expect)(postId).toBeDefined();
            (0, vitest_1.expect)(postResponse.body.data.attachments).toHaveLength(2);
            // --- UPDATE POST ---
            const updatePostData = { content: 'Updated: I just finished reading Surah Al-Kahf and started Surah Maryam.' };
            const updatePostResponse = yield (0, supertest_1.default)(app_1.default)
                .patch(`/api/v1/groups/posts/${postId}`)
                .set('Authorization', `Bearer ${tokenA}`)
                .send(updatePostData);
            (0, testLogger_1.logApi)('PATCH', `/api/v1/groups/posts/:postId`, { params: { postId }, body: updatePostData }, updatePostResponse.body, 'UPDATE-POST', 'User A updates their post');
            (0, vitest_1.expect)(updatePostResponse.status).toBe(200);
            (0, vitest_1.expect)(updatePostResponse.body.data.content).toBe(updatePostData.content);
            // --- CREATE POST WITH MULTIPART FILE UPLOAD ---
            const fileBuffer = Buffer.from('dummy file content');
            const uploadPostResponse = yield (0, supertest_1.default)(app_1.default)
                .post(`/api/v1/groups/${groupId}/posts`)
                .set('Authorization', `Bearer ${tokenA}`)
                .field('content', 'This post has a file attachment upload.')
                .attach('attachments', fileBuffer, 'test-doc.pdf');
            (0, testLogger_1.logApi)('POST', `/api/v1/groups/:groupId/posts (multipart)`, {}, uploadPostResponse.body, 'CREATE-POST-MULTIPART', 'User A uploads a post with multipart attachment');
            (0, vitest_1.expect)(uploadPostResponse.status).toBe(201);
            (0, vitest_1.expect)(uploadPostResponse.body.data.attachments).toHaveLength(1);
            (0, vitest_1.expect)(uploadPostResponse.body.data.attachments[0]).toContain('.pdf');
            const uploadedPostId = uploadPostResponse.body.data.id;
            // --- UPDATE POST WITH MULTIPART FILE UPLOAD AND EXISTING ATTACHMENTS ---
            const updateUploadResponse = yield (0, supertest_1.default)(app_1.default)
                .patch(`/api/v1/groups/posts/${uploadedPostId}`)
                .set('Authorization', `Bearer ${tokenA}`)
                .field('content', 'Updated content with merged attachments.')
                .field('existingAttachments', JSON.stringify([uploadPostResponse.body.data.attachments[0]]))
                .attach('attachments', Buffer.from('another dummy file'), 'another-test-doc.pdf');
            (0, testLogger_1.logApi)('PATCH', `/api/v1/groups/posts/:postId (multipart)`, {}, updateUploadResponse.body, 'UPDATE-POST-MULTIPART', 'User A updates post and merges attachments');
            (0, vitest_1.expect)(updateUploadResponse.status).toBe(200);
            (0, vitest_1.expect)(updateUploadResponse.body.data.attachments).toHaveLength(2);
            (0, vitest_1.expect)(updateUploadResponse.body.data.attachments[0]).toBe(uploadPostResponse.body.data.attachments[0]);
            (0, vitest_1.expect)(updateUploadResponse.body.data.attachments[1]).toContain('.pdf');
            // --- LIKE POST ---
            const likeResponse = yield (0, supertest_1.default)(app_1.default)
                .post(`/api/v1/groups/posts/${postId}/like`)
                .set('Authorization', `Bearer ${tokenB}`);
            (0, testLogger_1.logApi)('POST', `/api/v1/groups/posts/:postId/like`, { params: { postId } }, likeResponse.body, 'LIKE-POST', 'User B likes User A\'s post');
            (0, vitest_1.expect)(likeResponse.status).toBe(200);
            (0, vitest_1.expect)(likeResponse.body.message).toContain('liked');
            // --- ADD COMMENT ---
            const commentData = {
                comment: 'Wa alaikum assalam! MashAllah.',
            };
            const commentResponse = yield (0, supertest_1.default)(app_1.default)
                .post(`/api/v1/groups/posts/${postId}/comments`)
                .set('Authorization', `Bearer ${tokenB}`)
                .send(commentData);
            (0, testLogger_1.logApi)('POST', `/api/v1/groups/posts/:postId/comments`, { params: { postId }, body: commentData }, commentResponse.body, 'ADD-COMMENT', 'User B comments on User A\'s post');
            (0, vitest_1.expect)(commentResponse.status).toBe(201);
            const commentId = commentResponse.body.data.id;
            (0, vitest_1.expect)(commentId).toBeDefined();
            // --- REPLY TO COMMENT (NESTED) ---
            const replyData = {
                comment: 'MashAllah brother! Which Tafsir are you following?',
                parentCommentId: commentId,
            };
            const replyResponse = yield (0, supertest_1.default)(app_1.default)
                .post(`/api/v1/groups/posts/${postId}/comments`)
                .set('Authorization', `Bearer ${tokenA}`)
                .send(replyData);
            (0, testLogger_1.logApi)('POST', `/api/v1/groups/posts/:postId/comments`, { params: { postId }, body: replyData }, replyResponse.body, 'REPLY-COMMENT', 'User A replies to User B\'s comment');
            (0, vitest_1.expect)(replyResponse.status).toBe(201);
            (0, vitest_1.expect)(replyResponse.body.data.parentCommentId).toBe(commentId);
            // --- UPDATE COMMENT ---
            const updateCommentData = { comment: 'Wa alaikum assalam! MashAllah, beautiful Surah.' };
            const updateCommentResponse = yield (0, supertest_1.default)(app_1.default)
                .patch(`/api/v1/groups/comments/${commentId}`)
                .set('Authorization', `Bearer ${tokenB}`)
                .send(updateCommentData);
            (0, testLogger_1.logApi)('PATCH', `/api/v1/groups/comments/:commentId`, { params: { commentId }, body: updateCommentData }, updateCommentResponse.body, 'UPDATE-COMMENT', 'User B updates their comment');
            (0, vitest_1.expect)(updateCommentResponse.status).toBe(200);
            (0, vitest_1.expect)(updateCommentResponse.body.data.comment).toBe(updateCommentData.comment);
            // --- GET GROUP FEED ---
            const feedResponse = yield (0, supertest_1.default)(app_1.default)
                .get(`/api/v1/groups/${groupId}/posts`)
                .set('Authorization', `Bearer ${tokenA}`);
            (0, testLogger_1.logApi)('GET', `/api/v1/groups/:groupId/posts`, { params: { groupId } }, feedResponse.body, 'GET-FEED', 'User A fetches group feed');
            (0, vitest_1.expect)(feedResponse.status).toBe(200);
            const feedPost = feedResponse.body.data.find((p) => p.id === postId);
            (0, vitest_1.expect)(feedPost).toBeDefined();
            (0, vitest_1.expect)(feedPost.likesCount).toBe(1);
            (0, vitest_1.expect)(feedPost.commentsCount).toBe(2); // 1 main comment + 1 reply
            // --- PIN POST (ADMIN) ---
            const pinResponse = yield (0, supertest_1.default)(app_1.default)
                .patch(`/api/v1/groups/posts/${postId}/pin`)
                .set('Authorization', `Bearer ${adminToken}`);
            (0, testLogger_1.logApi)('PATCH', `/api/v1/groups/posts/:postId/pin`, { params: { postId } }, pinResponse.body, 'PIN-POST', 'Admin pins the post');
            (0, vitest_1.expect)(pinResponse.status).toBe(200);
            (0, vitest_1.expect)(pinResponse.body.data.isPinned).toBe(true);
            // --- LEAVE GROUP ---
            const leaveResponse = yield (0, supertest_1.default)(app_1.default)
                .post(`/api/v1/groups/${groupId}/leave`)
                .set('Authorization', `Bearer ${tokenB}`);
            (0, testLogger_1.logApi)('POST', `/api/v1/groups/:groupId/leave`, { params: { groupId } }, leaveResponse.body, 'LEAVE-GROUP', 'User B leaves the group');
            (0, vitest_1.expect)(leaveResponse.status).toBe(200);
            (0, vitest_1.expect)(leaveResponse.body.success).toBe(true);
            // --- KICK MEMBER (ADMIN) ---
            const kickResponse = yield (0, supertest_1.default)(app_1.default)
                .delete(`/api/v1/groups/${groupId}/members/${userA._id}`)
                .set('Authorization', `Bearer ${adminToken}`);
            (0, testLogger_1.logApi)('DELETE', `/api/v1/groups/:groupId/members/:userId`, { params: { groupId, userId: userA._id.toString() } }, kickResponse.body, 'KICK-MEMBER', 'Admin kicks User A from the group');
            (0, vitest_1.expect)(kickResponse.status).toBe(200);
            (0, vitest_1.expect)(kickResponse.body.success).toBe(true);
            // --- DELETE GROUP (ADMIN) ---
            const deleteGroupResponse = yield (0, supertest_1.default)(app_1.default)
                .delete(`/api/v1/groups/${groupId}`)
                .set('Authorization', `Bearer ${adminToken}`);
            (0, testLogger_1.logApi)('DELETE', `/api/v1/groups/:groupId`, { params: { groupId } }, deleteGroupResponse.body, 'DELETE-GROUP', 'Admin deletes the group');
            (0, vitest_1.expect)(deleteGroupResponse.status).toBe(200);
            (0, vitest_1.expect)(deleteGroupResponse.body.success).toBe(true);
            // Verify group is gone
            const finalCheck = yield group_model_1.Group.findById(groupId);
            (0, vitest_1.expect)(finalCheck).toBeNull();
        }));
    });
    (0, vitest_1.describe)('Unauthenticated Access (401)', () => {
        (0, vitest_1.it)('should return 401 Unauthorized on all group endpoints when no token is provided', () => __awaiter(void 0, void 0, void 0, function* () {
            const fakeId = new mongoose_1.default.Types.ObjectId().toString();
            const endpoints = [
                { method: 'get', url: '/api/v1/groups' },
                { method: 'post', url: '/api/v1/groups', body: { name: 'Test' } },
                { method: 'get', url: `/api/v1/groups/${fakeId}` },
                { method: 'patch', url: `/api/v1/groups/${fakeId}` },
                { method: 'delete', url: `/api/v1/groups/${fakeId}` },
                { method: 'post', url: `/api/v1/groups/${fakeId}/join` },
                { method: 'post', url: `/api/v1/groups/${fakeId}/leave` },
                { method: 'delete', url: `/api/v1/groups/${fakeId}/members/${fakeId}` },
                { method: 'get', url: `/api/v1/groups/${fakeId}/posts` },
                { method: 'post', url: `/api/v1/groups/${fakeId}/posts` },
                { method: 'post', url: `/api/v1/groups/posts/${fakeId}/like` },
                { method: 'post', url: `/api/v1/groups/posts/${fakeId}/comments` },
                { method: 'get', url: `/api/v1/groups/posts/${fakeId}/comments` },
                { method: 'patch', url: `/api/v1/groups/posts/${fakeId}` },
                { method: 'delete', url: `/api/v1/groups/posts/${fakeId}` },
                { method: 'patch', url: `/api/v1/groups/comments/${fakeId}` },
                { method: 'delete', url: `/api/v1/groups/comments/${fakeId}` },
                { method: 'patch', url: `/api/v1/groups/posts/${fakeId}/pin` },
            ];
            for (const ep of endpoints) {
                const req = (0, supertest_1.default)(app_1.default)[ep.method](ep.url);
                if (ep.body)
                    req.send(ep.body);
                const res = yield req;
                (0, vitest_1.expect)(res.status).toBe(401);
                (0, vitest_1.expect)(res.body.success).toBe(false);
            }
        }));
    });
});
