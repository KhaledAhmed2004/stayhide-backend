/**
 * JWT helper with built-in key rotation support.
 *
 * Backward-compatible signature: callers still pass a secret, just as
 * before. Rotation activates when the environment is set:
 *
 *   JWT_KEY_MAP          JSON object: { "<kid>": "<secret>", ... }
 *   JWT_KEY_CURRENT      kid used for signing new access tokens
 *   JWT_REFRESH_KEY_MAP  same shape, for refresh tokens
 *   JWT_REFRESH_KEY_CURRENT  kid used for signing new refresh tokens
 *
 * Behavior with env unset (default): identical to the previous
 * implementation. Behavior with env set:
 *
 *   - Sign: uses the "current" key from the map and stamps `kid` in the
 *     JWT header so verifiers know which key to use.
 *   - Verify: peeks at the JWT header for `kid`; if present and the
 *     key exists in the map, verifies against it. If `kid` is missing
 *     OR not in the map, falls back to the passed secret (so tokens
 *     issued before rotation, with no kid, still verify).
 *
 * Rotation procedure:
 *   1. Add a new entry to JWT_KEY_MAP (e.g. v2) alongside the existing
 *      one (v1). v1 SHOULD equal the legacy `config.jwt.jwt_secret`.
 *      Set JWT_KEY_CURRENT=v2. Deploy.
 *   2. New tokens are now signed with v2, kid=v2. Tokens issued before
 *      the deploy (no kid) still verify against the legacy secret.
 *      Tokens issued with kid=v1 also still verify.
 *   3. Wait for the longest natural token lifetime (refresh TTL) to
 *      pass, then remove v1 from the map. The legacy secret can also
 *      be rotated away once it's no longer used as fallback.
 */
import jwt, { JwtPayload, Secret, SignOptions } from 'jsonwebtoken';
import config from '../config';
import { errorLogger } from '../shared/logger';

type TokenKind = 'access' | 'refresh' | 'unknown';

const parseKeyMap = (
  raw: string | undefined,
): Record<string, string> | null => {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      return parsed as Record<string, string>;
    }
  } catch (e) {
    errorLogger.error(
      `jwtHelper: failed to parse key map env: ${(e as Error).message}`,
    );
  }
  return null;
};

const accessKeyMap = parseKeyMap(process.env.JWT_KEY_MAP);
const accessKeyCurrent = process.env.JWT_KEY_CURRENT;
const refreshKeyMap = parseKeyMap(process.env.JWT_REFRESH_KEY_MAP);
const refreshKeyCurrent = process.env.JWT_REFRESH_KEY_CURRENT;

const detectKind = (secret: Secret): TokenKind => {
  if (typeof secret !== 'string') return 'unknown';
  if (secret === (config.jwt?.jwt_secret as string)) return 'access';
  if (secret === (config.jwt?.jwt_refresh_secret as string)) return 'refresh';
  return 'unknown';
};

const resolveSigningKey = (
  kind: TokenKind,
  fallback: Secret,
): { secret: Secret; kid?: string } => {
  if (kind === 'access' && accessKeyMap && accessKeyCurrent) {
    const s = accessKeyMap[accessKeyCurrent];
    if (s) return { secret: s, kid: accessKeyCurrent };
  }
  if (kind === 'refresh' && refreshKeyMap && refreshKeyCurrent) {
    const s = refreshKeyMap[refreshKeyCurrent];
    if (s) return { secret: s, kid: refreshKeyCurrent };
  }
  return { secret: fallback };
};

const resolveVerifyingKey = (
  token: string,
  kind: TokenKind,
  fallback: Secret,
): Secret => {
  let kid: string | undefined;
  try {
    const decoded = jwt.decode(token, { complete: true });
    if (decoded && typeof decoded === 'object') {
      kid = (decoded as any).header?.kid;
    }
  } catch {
    /* malformed token — let verify fail naturally */
  }

  if (kid && kind === 'access' && accessKeyMap && accessKeyMap[kid]) {
    return accessKeyMap[kid];
  }
  if (kid && kind === 'refresh' && refreshKeyMap && refreshKeyMap[kid]) {
    return refreshKeyMap[kid];
  }
  return fallback;
};

const createToken = (payload: object, secret: Secret, expireTime: string) => {
  const kind = detectKind(secret);
  const { secret: signingSecret, kid } = resolveSigningKey(kind, secret);
  const opts: SignOptions = { expiresIn: expireTime } as SignOptions;
  if (kid) {
    // `keyid` is jsonwebtoken's API for stamping the `kid` header.
    (opts as any).keyid = kid;
  }
  return jwt.sign(payload, signingSecret, opts);
};

const verifyToken = (token: string, secret: Secret) => {
  const kind = detectKind(secret);
  const verifyingSecret = resolveVerifyingKey(token, kind, secret);
  return jwt.verify(token, verifyingSecret) as JwtPayload;
};

export const jwtHelper = { createToken, verifyToken };
