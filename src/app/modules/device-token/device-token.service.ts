import { DeviceToken } from './device-token.model';
import { DevicePlatform, DeviceMetadata, IDeviceToken } from './device-token.interface';
import { hashDeviceToken, tokenPrefixOf, hashIp } from './device-token.utils';

export const DeviceTokenService = {
  addDeviceToken: async (
    userId: string,
    token: string,
    platform?: DevicePlatform,
    appVersion?: string,
    metadata?: DeviceMetadata,
  ): Promise<IDeviceToken> => {
    const tokenHash = hashDeviceToken(token);
    const tokenPrefix = tokenPrefixOf(token);
    
    // Resolve session metadata before the DB ops.
    const { lookupCity } = await import('../../../helpers/geoIpHelper');
    const ipHash = metadata?.ip ? hashIp(metadata.ip) : undefined;
    const city = metadata?.ip ? await lookupCity(metadata.ip) : null;
    const userAgent = metadata?.userAgent || undefined;
    
    const now = new Date();

    const update: any = {
      user: userId,
      token, // Must persist the raw token to allow Firebase FCM delivery
      tokenPrefix,
      lastSeenAt: now,
    };

    if (platform) update.platform = platform;
    if (appVersion) update.appVersion = appVersion;
    if (ipHash) update.lastSeenIpHash = ipHash;
    if (city) update.lastSeenCity = city;
    if (userAgent) update.userAgent = userAgent;

    // Use findOneAndUpdate with upsert: true and filter by tokenHash.
    // This enforces "Latest login wins": if a different user logs in on 
    // the same physical device, it overwrites the 'user' field, preventing
    // E11000 duplicate key errors and gracefully transferring ownership.
    const updatedToken = await DeviceToken.findOneAndUpdate(
      { tokenHash },
      { 
        $set: update,
        $setOnInsert: { firstSeenAt: now } // Only set on creation
      },
      { upsert: true, new: true }
    );

    return updatedToken;
  },

  removeDeviceToken: async (
    userId: string,
    token: string,
    sessionIatMs?: number,
  ) => {
    const tokenHash = hashDeviceToken(token);
    
    const query: any = {
      user: userId,
      tokenHash
    };

    // Prevent race conditions: Ensure we only delete the token if it belongs 
    // to the session that is logging out, not a newer login session.
    if (sessionIatMs) {
       query.lastSeenAt = { $lte: new Date(sessionIatMs) };
    }

    return await DeviceToken.deleteOne(query);
  },

  revokeAllTokens: async (userId: string) => {
    return await DeviceToken.deleteMany({ user: userId });
  }
};
