import { StatusCodes } from 'http-status-codes';
import { JwtPayload } from 'jsonwebtoken';
import { USER_STATUS, USER_ROLES } from '../../../enums/user';
import { PipelineStage, Types } from 'mongoose';
import ApiError from '../../../errors/ApiError';
import { emailHelper } from '../../../helpers/emailHelper';
import { emailTemplate } from '../../../shared/emailTemplate';
import { sendVerificationOTP } from '../../../helpers/authHelpers';
import unlinkFile from '../../../shared/unlinkFile';
import generateOTP from '../../../util/generateOTP';
import { User } from './user.model';
import { DeviceToken } from '../device-token/device-token.model';
import QueryBuilder from '../../builder/QueryBuilder';
import AggregationBuilder from '../../builder/AggregationBuilder';
import { IUser } from './user.interface';
import {
  OTP_TTL_MS,
  REVERIFY_TOKEN_TTL_MS,
  REVERIFY_TOKEN_TTL_HOURS,
} from '../../../config/auth.constants';
import cryptoToken from '../../../util/cryptoToken';

import mongoose from 'mongoose';

const createUserToDB = async (
  payload: Partial<IUser>,
  isAdmin = false
): Promise<IUser> => {
  const session = await mongoose.startSession();
  try {
    session.startTransaction();

    // 1. Email Uniqueness Check (409 Conflict)
    const existingUser = await User.findOne({ email: payload.email }).session(session);
    if (existingUser) {
      if (existingUser.isVerified) {
        throw new ApiError(StatusCodes.CONFLICT, 'Email already registered');
      } else {
        // Handle pending account: If created < 24h, block. If > 24h, delete and recreate.
        const dayInMs = 24 * 60 * 60 * 1000;
        const isRecent = Date.now() - new Date(existingUser.createdAt).getTime() < dayInMs;
        if (isRecent) {
          throw new ApiError(StatusCodes.CONFLICT, 'Email already registered and pending verification');
        } else {
          await User.findByIdAndDelete(existingUser._id).session(session);
        }
      }
    }

    // 2. Prepare User Data
    const userData = {
      ...payload,
      isVerified: isAdmin ? true : false,
      status: isAdmin ? USER_STATUS.ACTIVE : USER_STATUS.PENDING,
    };

    // 3. Create User
    const [createUser] = await User.create([userData], { session });
    if (!createUser) {
      throw new ApiError(StatusCodes.BAD_REQUEST, 'Failed to create user');
    }

    // 4. Send Verification OTP (Only for public registration)
    if (!isAdmin) {
      // Note: sendVerificationOTP must also support session if it writes to DB
      await sendVerificationOTP(createUser.email, session);
    }

    await session.commitTransaction();
    return createUser;
  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }
};

const getUserProfileFromDB = async (
  user: JwtPayload,
): Promise<Partial<IUser>> => {
  const { id } = user;
  const isExistUser = await User.findById(id)
    .select('-password -authentication -tokenVersion -deviceTokens -deletedAt')
    .lean();
    
  if (!isExistUser) {
    throw new ApiError(StatusCodes.NOT_FOUND, "User doesn't exist!");
  }



  return isExistUser as Partial<IUser>;
};

const updateProfileToDB = async (
  user: JwtPayload,
  payload: Partial<IUser>,
): Promise<Partial<IUser | null>> => {
  const { id } = user;
  const isExistUser = await User.isExistUserById(id);
  if (!isExistUser) {
    throw new ApiError(StatusCodes.BAD_REQUEST, "User doesn't exist!");
  }

  // //unlink file here
  // if (payload.image) {
  //   unlinkFile(isExistUser.image);
  // }

  //unlink file here
  if (payload.profileImage) {
    unlinkFile(isExistUser.profileImage);
  }



  const updateDoc = await User.findOneAndUpdate({ _id: id }, payload, {
    new: true,
  });

  return updateDoc;
};

const updatePreferencesToDB = async (user: JwtPayload, payload: Partial<IUser>) => {
  const { id } = user;
  const isExistUser = await User.isExistUserById(id);
  if (!isExistUser) {
    throw new ApiError(StatusCodes.BAD_REQUEST, "User doesn't exist!");
  }

  const updateDoc = await User.findOneAndUpdate({ _id: id }, payload, {
    new: true,
  });

  return updateDoc;
};

const getAllUsersFromDB = async (query: Record<string, unknown>) => {
  const userQuery = new QueryBuilder(User.find(), query)
    .search(['name', 'email'])
    .filter()
    .sort()
    .paginate()
    .fields();

  const users = await userQuery.modelQuery;
  const paginationInfo = await userQuery.getPaginationInfo();

  return {
    meta: paginationInfo,
    data: users,
  };
};

const getUserMetricsFromDB = async () => {
  const aggregationBuilder = new AggregationBuilder(User);
  const excludeAdminFilter = { role: { $ne: USER_ROLES.ADMIN } };
  
  // Overall user growth (excluding SUPER_ADMIN)
  const totalStats = await aggregationBuilder.calculateGrowth({ 
    filter: excludeAdminFilter,
    period: 'month' 
  });
  
  // Status based growth (excluding SUPER_ADMIN)
  aggregationBuilder.reset();
  const activeStats = await aggregationBuilder.calculateGrowth({ 
    filter: { ...excludeAdminFilter, status: USER_STATUS.ACTIVE }, 
    period: 'month' 
  });
  
  aggregationBuilder.reset();
  const pendingStats = await aggregationBuilder.calculateGrowth({ 
    filter: { ...excludeAdminFilter, status: USER_STATUS.PENDING }, 
    period: 'month' 
  });
  
  aggregationBuilder.reset();
  const suspendedStats = await aggregationBuilder.calculateGrowth({ 
    filter: { ...excludeAdminFilter, status: USER_STATUS.SUSPENDED }, 
    period: 'month' 
  });

  const formatMetric = (stat: any) => ({
    value: stat.total,
    changePct: stat.growth,
    direction: stat.growthType === 'increase' ? 'up' : stat.growthType === 'decrease' ? 'down' : 'neutral',
  });

  return {
    meta: {
      comparisonPeriod: 'month',
    },
    totalUsers: formatMetric(totalStats),
    activeUsers: formatMetric(activeStats),
    pendingUsers: formatMetric(pendingStats),
    suspendedUsers: formatMetric(suspendedStats),
  };
};

const getAllUserRolesFromDB = async (query: Record<string, unknown>) => {
  const { searchTerm, email, role, status, isVerified, page = 1, limit = 10, sortBy = 'createdAt', sortOrder = 'desc' } = query;
  
  const skip = (Number(page) - 1) * Number(limit);

  const match: Record<string, any> = {
    role: { $ne: USER_ROLES.ADMIN },
  };
  if (status) match.status = status;
  if (isVerified !== undefined) match.isVerified = isVerified === 'true' ? true : isVerified === 'false' ? false : isVerified;
  if (role) match.role = role;
  if (email) match.email = { $regex: email, $options: 'i' };
  if (searchTerm) {
    match.$or = [
      { name: { $regex: searchTerm, $options: 'i' } },
      { email: { $regex: searchTerm, $options: 'i' } },
    ];
  }

  const basePipeline: PipelineStage[] = [
    { $match: match },
    {
      $project:
        status === USER_STATUS.PENDING
          ? {
              _id: 1,
              name: 1,
              email: 1,
              role: 1,
              verificationImage: 1,
              verificationVideo: 1,
              createdAt: 1,
            }
          : {
              _id: 1,
              name: 1,
              email: 1,
              phone: 1,
              status: 1,
              isVerified: 1,
              role: 1,
              profileImage: 1,
              createdAt: 1,
              updatedAt: 1,
            },
    },
  ];

  const sortStage: PipelineStage = {
    $sort: { [sortBy as string]: sortOrder === -1 ? -1 : 1 },
  };

  const paginatedPipeline: PipelineStage[] = [
    ...basePipeline,
    sortStage,
    { $skip: skip },
    { $limit: Number(limit) },
  ];

  const countPipeline: PipelineStage[] = [
    ...basePipeline,
    { $count: 'total' },
  ];

  const [data, countResult] = await Promise.all([
    User.aggregate(paginatedPipeline),
    User.aggregate(countPipeline),
  ]);

  const total = countResult.length > 0 ? countResult[0].total : 0;
  const totalPages = Math.ceil(total / Number(limit));

  return {
    meta: {
      page: Number(page),
      limit: Number(limit),
      total,
      totalPages,
    },
    data,
  };
};


const getUserByIdFromDB = async (id: string, requester: JwtPayload): Promise<Partial<IUser> | null> => {
  const user = await User.findById(id).select(
    '-password -authentication -tokenVersion -deviceTokens -deletedAt',
  ).lean();

  if (!user) {
    throw new ApiError(StatusCodes.NOT_FOUND, "User doesn't exist!");
  }

  // Admin specific view: can see all fields except excluded ones above


  return user as Partial<IUser>;
};

// Statuses that should make every live JWT for the user stop working
// immediately. We bump `tokenVersion` on flips INTO these so a stolen or
// in-flight token can't keep being used after the admin acts.
const SESSION_INVALIDATING_STATUSES: USER_STATUS[] = [
  USER_STATUS.SUSPENDED,
  USER_STATUS.RESTRICTED,
  USER_STATUS.DELETED,
  USER_STATUS.REJECTED,
  USER_STATUS.INACTIVE,
];



const deleteUserPermanentlyFromDB = async (id: string) => {
  const user = await User.findById(id);
  if (!user) {
    throw new ApiError(StatusCodes.BAD_REQUEST, "User doesn't exist!");
  }

  const deletedUser = await User.findByIdAndDelete(id)
    .select('-password -authentication');
  return deletedUser;
};

const updateUserByAdminInDB = async (id: string, payload: Partial<IUser>) => {
  // Pull tokenVersion so we can bump it locally on lockout transitions.
  // password stays selected for the schema's bcrypt pre-save hook.
  const user = await User.findById(id).select('+password +tokenVersion');
  if (!user) {
    throw new ApiError(StatusCodes.BAD_REQUEST, "User doesn't exist!");
  }

  const previousStatus = user.status;

  // Email uniqueness â€” admin can change a user's email, but the change
  // must not collide with another active account. Without this check the
  // model's unique index trips an E11000 at .save() that surfaces as a
  // confusing 500 instead of the documented 409.
  if (payload.email !== undefined && payload.email !== user.email) {
    const taken = await User.findOne({
      email: payload.email,
      _id: { $ne: user._id },
      status: { $ne: USER_STATUS.DELETED },
    }).lean();
    if (taken) {
      throw new ApiError(StatusCodes.CONFLICT, 'This email is already in use');
    }
  }

  // Whitelist fields admin can update (excluding password/auth info)
  if (payload.name !== undefined) (user as any).name = payload.name;
  if (payload.email !== undefined) (user as any).email = payload.email;
  if (payload.dateOfBirth !== undefined) (user as any).dateOfBirth = payload.dateOfBirth;


  // if (payload.gender !== undefined) (user as any).gender = payload.gender;
  if (payload.profileImage !== undefined) (user as any).profileImage = payload.profileImage;
  if (payload.status !== undefined) (user as any).status = payload.status;
  if (payload.role !== undefined) (user as any).role = payload.role;
  if (payload.rejectionReason !== undefined) (user as any).rejectionReason = payload.rejectionReason;

  // Status-change side effects
  // status. Without this hook, an admin who flips status via this route
  // bypasses both the reverify-token email and the tokenVersion bump.
  const newStatus = (user as any).status as USER_STATUS;
  const statusChanged =
    payload.status !== undefined && newStatus !== previousStatus;

  const flippingToLockout =
    statusChanged && SESSION_INVALIDATING_STATUSES.includes(newStatus);

  if (flippingToLockout) {
    (user as any).tokenVersion = ((user as any).tokenVersion ?? 0) + 1;
  }

  await user.save();

  const plain = user.toObject();
  delete (plain as any).password;
  delete (plain as any).authentication;
  delete (plain as any).tokenVersion;
  return plain as IUser;
};


const SOFT_DELETE_RECOVERY_DAYS = 30;

const requestAccountDeletionFromDB = async (
  user: JwtPayload,
  password: string,
) => {
  const { id } = user;

  // Pull password + tokenVersion explicitly â€” both are select: false on the schema.
  const dbUser = await User.findById(id).select('+password +tokenVersion');
  if (!dbUser) {
    throw new ApiError(StatusCodes.NOT_FOUND, "User doesn't exist!");
  }

  if (dbUser.status === USER_STATUS.DELETED) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      'Account is already scheduled for deletion',
    );
  }

  // Defense-in-depth: stolen token alone must not be enough to wipe an account.
  if (!dbUser.password) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      'Password-less accounts (Google/Apple) cannot be deleted via this endpoint yet',
    );
  }

  const passwordOk = await User.isMatchPassword(password, dbUser.password);
  if (!passwordOk) {
    throw new ApiError(StatusCodes.UNAUTHORIZED, 'Incorrect password');
  }

  const now = new Date();
  const recoveryDeadline = new Date(
    now.getTime() + SOFT_DELETE_RECOVERY_DAYS * 24 * 60 * 60 * 1000,
  );

  // Bumping tokenVersion immediately invalidates every JWT this user holds.
  await User.findByIdAndUpdate(id, {
    $set: {
      status: USER_STATUS.DELETED,
      deletedAt: now,
      recoveryDeadline,
      // Drop push targets â€” the user is logically gone until they restore.
      deviceTokens: [],
    },
    $inc: { tokenVersion: 1 },
  });

  return {
    deletedAt: now.toISOString(),
    recoveryDeadline: recoveryDeadline.toISOString(),
    recoveryWindowDays: SOFT_DELETE_RECOVERY_DAYS,
  };
};

const requestEmailChangeFromDB = async (
  user: JwtPayload,
  payload: { newEmail: string; password: string },
) => {
  const { id } = user;
  const { newEmail, password } = payload;

  // Pull password explicitly â€” select: false on the schema.
  const dbUser = await User.findById(id).select('+password');
  if (!dbUser) {
    throw new ApiError(StatusCodes.NOT_FOUND, "User doesn't exist!");
  }

  if (!dbUser.password) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      'Password-less accounts (Google/Apple) cannot change email via this endpoint yet',
    );
  }

  const passwordOk = await User.isMatchPassword(password, dbUser.password);
  if (!passwordOk) {
    throw new ApiError(StatusCodes.UNAUTHORIZED, 'Incorrect password');
  }

  // Reject no-op changes early so the user gets a clear message instead of
  // silently consuming an OTP slot.
  if (dbUser.email === newEmail) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      'New email is the same as the current email',
    );
  }

  // Uniqueness â€” exclude soft-deleted users so a recoverable account doesn't
  // permanently block its own email.
  const taken = await User.findOne({
    email: newEmail,
    _id: { $ne: dbUser._id },
    status: { $ne: USER_STATUS.DELETED },
  }).lean();
  if (taken) {
    throw new ApiError(StatusCodes.CONFLICT, 'This email is already in use');
  }

  const otp = generateOTP();
  const expireAt = new Date(Date.now() + OTP_TTL_MS);

  await User.findByIdAndUpdate(id, {
    $set: {
      emailChange: { newEmail, otp, expireAt },
    },
  });

  // OTP to the NEW email â€” proves the user controls that inbox.
  await emailHelper.enqueue(
    emailTemplate.changeEmail({ newEmail, otp }),
    { kind: 'email_change_otp' },
  );
  // Heads-up to the OLD email â€” catches takeover attempts where the
  // attacker has the password but not the original inbox.
  await emailHelper.enqueue(
    emailTemplate.emailChangeNotification({
      oldEmail: dbUser.email,
      newEmail,
    }),
    { kind: 'email_change_notification' },
  );

  return {
    newEmail,
    expireAt: expireAt.toISOString(),
    otpTtlSeconds: OTP_TTL_MS / 1000,
  };
};

const confirmEmailChangeFromDB = async (
  user: JwtPayload,
  otp: string,
) => {
  const { id } = user;

  // Pull emailChange + tokenVersion explicitly â€” both are select: false.
  const dbUser = await User.findById(id).select('+emailChange +tokenVersion');
  if (!dbUser) {
    throw new ApiError(StatusCodes.NOT_FOUND, "User doesn't exist!");
  }

  const pending = dbUser.emailChange;
  if (!pending || !pending.newEmail || !pending.otp || !pending.expireAt) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      'No pending email-change request',
    );
  }

  if (pending.expireAt.getTime() <= Date.now()) {
    // Clear the stale request so a fresh one can replace it.
    await User.findByIdAndUpdate(id, {
      $set: { emailChange: { newEmail: null, otp: null, expireAt: null } },
    });
    throw new ApiError(StatusCodes.BAD_REQUEST, 'OTP has expired');
  }

  if (pending.otp !== otp) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'Invalid OTP');
  }

  // Re-check uniqueness at commit time â€” someone else may have grabbed the
  // address while this OTP was outstanding.
  const taken = await User.findOne({
    email: pending.newEmail,
    _id: { $ne: dbUser._id },
    status: { $ne: USER_STATUS.DELETED },
  }).lean();
  if (taken) {
    await User.findByIdAndUpdate(id, {
      $set: { emailChange: { newEmail: null, otp: null, expireAt: null } },
    });
    throw new ApiError(StatusCodes.CONFLICT, 'This email is already in use');
  }

  // Commit: flip email, clear pending, bump tokenVersion to invalidate every
  // JWT issued under the old identifier. User must log in again with the new
  // email.
  //
  // Race: even though we re-checked uniqueness above, a parallel commit
  // from another user (also racing for the same address) can squeeze in
  // between the check and the write. The unique index on `email` then
  // throws E11000 â€” we catch it and surface the same `409 "This email is
  // already in use"` the pre-check would have produced. This is the final
  // safety net for the uniqueness invariant.
  try {
    await User.findByIdAndUpdate(id, {
      $set: {
        email: pending.newEmail,
        emailChange: { newEmail: null, otp: null, expireAt: null },
      },
      $inc: { tokenVersion: 1 },
    });
  } catch (err: any) {
    if (err?.code === 11000) {
      // Mongo unique-key violation â€” another user already owns the
      // address. Clear the pending request so the user can start over.
      await User.findByIdAndUpdate(id, {
        $set: { emailChange: { newEmail: null, otp: null, expireAt: null } },
      });
      throw new ApiError(StatusCodes.CONFLICT, 'This email is already in use');
    }
    throw err;
  }

  return {
    email: pending.newEmail,
  };
};

// GDPR data export. Aggregates everything the system stores ABOUT this
// user into a single JSON envelope, then returns it synchronously. The
// caller (controller) wraps it in the standard success envelope.
//
// What's included: the user's own profile (sensitive auth fields stripped),
// their notifications, their subscription history (kept across purge for
// audit), their group activity, and their ask-imam questions.
//
// What's excluded: password hash, the `authentication` and `emailChange`
// OTP subdocs, `tokenVersion`, raw push-notification `deviceTokens` values
// (we expose only the metadata: platform, appVersion, lastSeenAt).
// Sessions = entries in User.deviceTokens. Each entry has a stable
// Mongoose subdoc `_id` (since v2 of the schema) which we expose as
// `tokenId` to the client. The raw FCM/APNs token value is NEVER
// returned â€” it's a credential that would let a third party hijack
// push delivery.

const listMySessionsFromDB = async (user: JwtPayload) => {
  const { id } = user;
  
  // Verify user still exists
  const dbUser = await User.findById(id).select('_id').lean();
  if (!dbUser) {
    throw new ApiError(StatusCodes.NOT_FOUND, "User doesn't exist!");
  }

  const deviceTokens = await DeviceToken.find({ user: id }).lean();

  const sessions = deviceTokens.map((dt: any) => ({
    tokenId: dt._id ? dt._id.toString() : null,
    tokenPrefix: dt.tokenPrefix ?? null,
    platform: dt.platform ?? null,
    appVersion: dt.appVersion ?? null,
    lastSeenAt: dt.lastSeenAt ?? null,
  }));

  return { sessions };
};

const revokeMySessionFromDB = async (user: JwtPayload, tokenId: string) => {
  const { id } = user;

  const result = await DeviceToken.findOneAndDelete({
    _id: new Types.ObjectId(tokenId),
    user: id,
  });

  if (!result) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Session not found');
  }

  return { tokenId };
};

const revokeAllMySessionsFromDB = async (user: JwtPayload) => {
  const { id } = user;

  await DeviceToken.deleteMany({ user: id });

  const result = await User.findByIdAndUpdate(
    id,
    { $inc: { tokenVersion: 1 } },
    { new: true },
  );

  if (!result) {
    throw new ApiError(StatusCodes.NOT_FOUND, "User doesn't exist!");
  }

  return { revokedAt: new Date().toISOString() };
};

const exportMyDataFromDB = async (user: JwtPayload) => {
  const { id } = user;

  // Lazy-load cascade collections â€” same import paths the purge cron uses.
  // Kept inside the function so the user module doesn't pay the import
  // cost on every other endpoint.
  const { Notification } = await import('../notification/notification.model');
  const { Subscription } = await import('../subscription/subscription.model');
  const { SubscriptionEvent } = await import(
    '../subscription/subscription-event.model'
  );

  // Profile â€” strip all the fields a GDPR export must NOT leak even back
  // to the user themselves (password hash, OTP state, token version).
  const profile = await User.findById(id)
    .select(
      '-password -authentication -emailChange -tokenVersion -deletedAt',
    )
    .lean();

  if (!profile) {
    throw new ApiError(StatusCodes.NOT_FOUND, "User doesn't exist!");
  }

  // Sanitize deviceTokens â€” return display metadata only. Strip both
  // the legacy raw `token` field AND the HMAC `tokenHash` (the hash by
  // itself doesn't enable impersonation, but combined with the JWT
  // secret could verify ownership of a leaked raw token). `tokenPrefix`
  // is safe to expose â€” 6 suffix chars only.
  const rawDeviceTokens = await DeviceToken.find({ user: id }).lean();
  const deviceTokens = rawDeviceTokens.map((dt: any) => ({
    tokenPrefix: dt.tokenPrefix ?? null,
    platform: dt.platform ?? null,
    appVersion: dt.appVersion ?? null,
    lastSeenAt: dt.lastSeenAt ?? null,
  }));
  (profile as any).deviceTokens = deviceTokens;

  // Fan-out: each collection that references this user.
  const [
    notifications,
    subscriptions,
    subscriptionEvents,
  ] = await Promise.all([
    Notification.find({ userId: id }).lean(),
    Subscription.find({ userId: id }).lean(),
    SubscriptionEvent.find({ userId: id }).lean(),
  ]);

  const payload = {
    exportedAt: new Date().toISOString(),
    schemaVersion: 1,
    profile,
    notifications,
    subscriptionData: {
      subscriptions,
      subscriptionEvents,
    },
  };

  // Size guard. Synchronous JSON export only stays safe under ~5 MB â€”
  // beyond that, mobile clients hit body-size limits and the response
  // can time out. When we exceed it, refuse with a clear message so the
  // client knows to wait for the future async-delivery variant rather
  // than mistaking it for a generic 5xx.
  const SIZE_LIMIT_BYTES = 5 * 1024 * 1024;
  const sizeBytes = Buffer.byteLength(JSON.stringify(payload), 'utf8');
  if (sizeBytes > SIZE_LIMIT_BYTES) {
    throw new ApiError(
      StatusCodes.REQUEST_TOO_LONG,
      `Export payload exceeds the synchronous size limit (${(sizeBytes / 1024 / 1024).toFixed(1)} MB > 5 MB). An async email-link variant is planned; until then, contact support to receive a copy of your data.`,
    );
  }

  return payload;
};

// Anonymized projection of a soft-deleted user. Other modules use this
// shape when they need to surface "the author of this post" without
// leaking the original identity. See system-concepts.md "Public User
// Display" for the policy.
const DELETED_USER_PROJECTION = {
  name: '[Deleted User]',
  // Hardcoded safe fallback object with no external dependencies
  profileImage: '/default-avatar.svg',
};

const projectPublic = (doc: any, requestedId: string | unknown): any => {
  // If the user is completely missing (hard deleted), we return a safe projection
  // with the requested ID attached to prevent chat/post queries from breaking.
  if (!doc) {
    return {
      _id: requestedId,
      name: DELETED_USER_PROJECTION.name,
      profileImage: DELETED_USER_PROJECTION.profileImage,
      role: USER_ROLES.USER, // Safe default
      isDeleted: true,
    };
  }

  const isDeleted =
    doc.status === USER_STATUS.DELETED || Boolean(doc.deletedAt);
  if (isDeleted) {
    return {
      _id: doc._id,
      name: DELETED_USER_PROJECTION.name,
      profileImage: DELETED_USER_PROJECTION.profileImage,
      role: doc.role,
      isDeleted: true,
    };
  }
  return {
    _id: doc._id,
    name: doc.name,
    profileImage: doc.profileImage,
    role: doc.role,
    isDeleted: false,
  };
};

const getPublicProfileById = async (id: string | unknown) => {
  const doc = await User.findById(id as any)
    .select('_id name profileImage role status deletedAt')
    .lean();
  return projectPublic(doc, id);
};

const getPublicProfilesByIds = async (ids: Array<string | unknown>) => {
  const docs = await User.find({ _id: { $in: ids as any[] } })
    .select('_id name profileImage role status deletedAt')
    .lean();
    
  // Ensure we map back to the requested IDs to preserve missing/deleted users
  return ids.map(id => {
    const foundDoc = docs.find(d => String(d._id) === String(id));
    return projectPublic(foundDoc, id);
  }).filter(Boolean);
};

export const UserService = {
  createUserToDB,
  getUserProfileFromDB,
  updateProfileToDB,
  updatePreferencesToDB,
  getAllUsersFromDB,
  getAllUserRolesFromDB,

  updateUserByAdminInDB,
  deleteUserPermanentlyFromDB,
  getUserByIdFromDB,
  getUserMetricsFromDB,
  requestAccountDeletionFromDB,
  requestEmailChangeFromDB,
  confirmEmailChangeFromDB,
  exportMyDataFromDB,
  listMySessionsFromDB,
  revokeMySessionFromDB,
  revokeAllMySessionsFromDB,
  getPublicProfileById,
  getPublicProfilesByIds,
};
