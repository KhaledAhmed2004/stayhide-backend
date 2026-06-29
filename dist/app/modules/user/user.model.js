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
exports.User = void 0;
const bcrypt_1 = __importDefault(require("bcrypt"));
const mongoose_1 = require("mongoose");
const config_1 = __importDefault(require("../../../config"));
const user_1 = require("../../../enums/user");
const userSchema = new mongoose_1.Schema({
    name: {
        type: String,
        required: true,
        trim: true,
    },
    role: {
        type: String,
        enum: Object.values(user_1.USER_ROLES),
        default: user_1.USER_ROLES.USER,
        required: true,
    },
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true,
    },
    password: {
        type: String,
        required: function () {
            return !this.googleId && !this.appleId;
        },
        minlength: 8,
        select: false,
    },
    passwordHistory: {
        type: [
            {
                hash: { type: String, required: true },
                changedAt: { type: Date, default: () => new Date() },
            },
        ],
        default: [],
        select: false,
    },
    dateOfBirth: {
        type: Date,
        required: true,
    },
    profileImage: {
        type: String,
        required: true,
        // Self-hosted SVG — served by `app.use(express.static('public'))`
        // in src/app.ts. Relative path; clients resolve against {{baseUrl}}.
        // Replaces the previous external CDN dependency on i.ibb.co (SPOF).
        default: '/default-avatar.svg',
    },
    status: {
        type: String,
        enum: Object.values(user_1.USER_STATUS),
        default: user_1.USER_STATUS.PENDING,
    },
    isVerified: {
        type: Boolean,
        default: false,
    },
    tokenVersion: {
        type: Number,
        default: 0,
        select: false,
    },
    googleId: {
        type: String,
        sparse: true,
        unique: true,
    },
    appleId: {
        type: String,
        sparse: true,
        unique: true,
    },
    subscriptionTier: {
        type: String,
        enum: Object.values(user_1.SUBSCRIPTION_TIER),
        default: user_1.SUBSCRIPTION_TIER.FREE,
    },
    subscriptionStatus: {
        type: String,
        enum: Object.values(user_1.SUBSCRIPTION_STATUS),
        default: user_1.SUBSCRIPTION_STATUS.NONE,
    },
    subscriptionExpiryDate: {
        type: Date,
    },
    appleOriginalTransactionId: {
        type: String,
        sparse: true,
        unique: true,
    },
    googlePurchaseToken: {
        type: String,
        sparse: true,
        unique: true,
    },
    authentication: {
        type: {
            isResetPassword: {
                type: Boolean,
                default: false,
            },
            oneTimeCode: {
                type: String,
                default: null,
            },
            expireAt: {
                type: Date,
                default: null,
            },
        },
        select: false,
    },
    // Pending email-change request. Held server-side between
    // POST /users/me/email-change/request and /confirm. Cleared on commit
    // or expiry. Kept in a separate subdoc from `authentication` so the
    // password-reset OTP and email-change OTP can coexist for one user.
    emailChange: {
        type: {
            newEmail: {
                type: String,
                default: null,
                lowercase: true,
                trim: true,
            },
            otp: {
                type: String,
                default: null,
            },
            expireAt: {
                type: Date,
                default: null,
            },
        },
        select: false,
    },
    deletedAt: {
        type: Date,
    },
    recoveryDeadline: {
        type: Date,
    },
    isDailySymptomReminderEnabled: {
        type: Boolean,
        default: false,
    },
    timezone: {
        type: String,
    },
}, { timestamps: true });
// Cron purge query: find users whose recovery window has expired.
// Compound index speeds up `find({ status: DELETED, recoveryDeadline: { $lt: now } })`.
userSchema.index({ status: 1, recoveryDeadline: 1 });
userSchema.statics.isExistUserById = (id) => __awaiter(void 0, void 0, void 0, function* () {
    return yield exports.User.findById(id);
});
userSchema.statics.isExistUserByEmail = (email) => __awaiter(void 0, void 0, void 0, function* () {
    return yield exports.User.findOne({ email });
});
userSchema.statics.isMatchPassword = (password, hashPassword) => __awaiter(void 0, void 0, void 0, function* () {
    return yield bcrypt_1.default.compare(password, hashPassword);
});
// Returns true if `plain` matches any hash in the history list. Used by
// change-password and reset-password to block reuse. O(n) bcrypt
// compares — n is capped at PASSWORD_HISTORY_DEPTH (5) so this stays
// fast even at scale.
userSchema.statics.isPasswordReused = (plain, history) => __awaiter(void 0, void 0, void 0, function* () {
    if (!history || history.length === 0)
        return false;
    for (const entry of history) {
        if (entry && entry.hash && (yield bcrypt_1.default.compare(plain, entry.hash))) {
            return true;
        }
    }
    return false;
});
userSchema.pre('save', function (next) {
    return __awaiter(this, void 0, void 0, function* () {
        if (this.password && this.isModified('password')) {
            this.password = yield bcrypt_1.default.hash(this.password, Number(config_1.default.bcrypt_salt_rounds));
        }
        next();
    });
});
exports.User = (0, mongoose_1.model)('User', userSchema);
