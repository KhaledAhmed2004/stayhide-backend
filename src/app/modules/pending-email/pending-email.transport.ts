import nodemailer, { Transporter } from 'nodemailer';
import config from '../../../config';
import { logger } from '../../../shared/logger';

/**
 * Singleton Nodemailer transporter. Owned by this module so we never
 * have two pools alive (was previously instantiated in
 * `src/helpers/emailHelper.ts`, which now re-exports from here).
 *
 * Unlike the legacy helper, `sendNow` **throws** on failure — that
 * propagation is required by the queue: a swallowed error would let
 * the service flip a row to SENT when it shouldn't.
 */

let transporter: Transporter | null = null;

const getTransporter = (): Transporter => {
  if (transporter) return transporter;
  transporter = nodemailer.createTransport({
    host: config.email.host,
    port: Number(config.email.port),
    secure: false,
    auth: {
      user: config.email.user,
      pass: config.email.pass,
    },
  });
  return transporter;
};

export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
}

export interface SendNowResult {
  messageId: string | null;
  accepted: string[];
}

/**
 * Synchronous send. Throws on any failure — the caller (queue service)
 * decides retry / DLQ handling. Never logs at error level here: the
 * service logs once, in the right context.
 */
export const sendNow = async (
  input: SendEmailInput,
): Promise<SendNowResult> => {
  const info = await getTransporter().sendMail({
    from: `"Simply Good Food" ${config.email.from}`,
    to: input.to,
    subject: input.subject,
    html: input.html,
  });
  logger.info?.(`Mail sent to ${input.to} (id=${info.messageId})`);
  return {
    messageId: (info.messageId as string | undefined) ?? null,
    accepted: (info.accepted as string[] | undefined) ?? [],
  };
};
