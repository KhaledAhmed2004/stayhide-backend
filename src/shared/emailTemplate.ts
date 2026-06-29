type ICreateAccount = {
  name: string;
  email: string;
  otp: string;
};

type IResetPassword = {
  email: string;
  otp: string;
};

type IChangeEmail = {
  newEmail: string;
  otp: string;
};

type IEmailChangeNotification = {
  oldEmail: string;
  newEmail: string;
};

type IAccountRejected = {
  email: string;
  name?: string;
  reverifyToken: string;
  reverifyTtlHours: number;
  rejectionReason?: string;
};

const createAccount = (values: ICreateAccount) => {
  const data = {
    to: values.email,
    subject: 'Verify your account',
    html: `<body style="font-family: Arial, sans-serif; background-color: #f9f9f9; margin: 50px; padding: 20px; color: #555;">
    <div style="width: 100%; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #fff; border-radius: 10px; box-shadow: 0 0 10px rgba(0,0,0,0.1);">
        <img src="https://i.postimg.cc/6pgNvKhD/logo.png" alt="Logo" style="display: block; margin: 0 auto 20px; width:150px" />
          <h2 style="color: #277E16; font-size: 24px; margin-bottom: 20px;">Hey! ${values.name}, Your Toothlens Account Credentials</h2>
        <div style="text-align: center;">
            <p style="color: #555; font-size: 16px; line-height: 1.5; margin-bottom: 20px;">Your single use code is:</p>
            <div style="background-color: #277E16; width: 80px; padding: 10px; text-align: center; border-radius: 8px; color: #fff; font-size: 25px; letter-spacing: 2px; margin: 20px auto;">${values.otp}</div>
            <p style="color: #555; font-size: 16px; line-height: 1.5; margin-bottom: 20px;">This code is valid for 3 minutes.</p>
        </div>
    </div>
</body>`,
  };
  return data;
};

const resetPassword = (values: IResetPassword) => {
  const data = {
    to: values.email,
    subject: 'Reset your password',
    html: `<body style="font-family: Arial, sans-serif; background-color: #f9f9f9; margin: 50px; padding: 20px; color: #555;">
    <div style="width: 100%; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #fff; border-radius: 10px; box-shadow: 0 0 10px rgba(0,0,0,0.1);">
        <img src="https://i.postimg.cc/6pgNvKhD/logo.png" alt="Logo" style="display: block; margin: 0 auto 20px; width:150px" />
        <div style="text-align: center;">
            <p style="color: #555; font-size: 16px; line-height: 1.5; margin-bottom: 20px;">Your single use code is:</p>
            <div style="background-color: #277E16; width: 80px; padding: 10px; text-align: center; border-radius: 8px; color: #fff; font-size: 25px; letter-spacing: 2px; margin: 20px auto;">${values.otp}</div>
            <p style="color: #555; font-size: 16px; line-height: 1.5; margin-bottom: 20px;">This code is valid for 3 minutes.</p>
                <p style="color: #b9b4b4; font-size: 16px; line-height: 1.5; margin-bottom: 20px;text-align:left">If you didn't request this code, you can safely ignore this email. Someone else might have typed your email address by mistake.</p>
        </div>
    </div>
</body>`,
  };
  return data;
};

// OTP delivered to the NEW email address during a self-service email change.
const changeEmail = (values: IChangeEmail) => {
  const data = {
    to: values.newEmail,
    subject: 'Verify your new email address',
    html: `<body style="font-family: Arial, sans-serif; background-color: #f9f9f9; margin: 50px; padding: 20px; color: #555;">
    <div style="width: 100%; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #fff; border-radius: 10px; box-shadow: 0 0 10px rgba(0,0,0,0.1);">
        <img src="https://i.postimg.cc/6pgNvKhD/logo.png" alt="Logo" style="display: block; margin: 0 auto 20px; width:150px" />
        <div style="text-align: center;">
            <p style="color: #555; font-size: 16px; line-height: 1.5; margin-bottom: 20px;">You requested to change the email on your account to <strong>${values.newEmail}</strong>. Use the single-use code below to confirm:</p>
            <div style="background-color: #277E16; width: 80px; padding: 10px; text-align: center; border-radius: 8px; color: #fff; font-size: 25px; letter-spacing: 2px; margin: 20px auto;">${values.otp}</div>
            <p style="color: #555; font-size: 16px; line-height: 1.5; margin-bottom: 20px;">This code is valid for 3 minutes.</p>
            <p style="color: #b9b4b4; font-size: 14px; line-height: 1.5; margin-bottom: 20px; text-align:left">If you didn't request this change, you can safely ignore this email — your old email will keep working.</p>
        </div>
    </div>
</body>`,
  };
  return data;
};

// Heads-up notice sent to the OLD email address when an email-change is
// requested. Lets the legitimate owner spot a hijack attempt before the OTP
// is verified on the new address.
const emailChangeNotification = (values: IEmailChangeNotification) => {
  const data = {
    to: values.oldEmail,
    subject: 'Your email is being changed',
    html: `<body style="font-family: Arial, sans-serif; background-color: #f9f9f9; margin: 50px; padding: 20px; color: #555;">
    <div style="width: 100%; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #fff; border-radius: 10px; box-shadow: 0 0 10px rgba(0,0,0,0.1);">
        <img src="https://i.postimg.cc/6pgNvKhD/logo.png" alt="Logo" style="display: block; margin: 0 auto 20px; width:150px" />
        <div style="text-align: left;">
            <p style="color: #555; font-size: 16px; line-height: 1.5; margin-bottom: 20px;">A request was made to change the email on your account from <strong>${values.oldEmail}</strong> to <strong>${values.newEmail}</strong>.</p>
            <p style="color: #555; font-size: 16px; line-height: 1.5; margin-bottom: 20px;">If you initiated this change, no further action is needed — just verify the code we sent to your new address.</p>
            <p style="color: #c0392b; font-size: 16px; line-height: 1.5; margin-bottom: 20px;"><strong>If this wasn't you</strong>, change your password immediately and contact support. Until the new email is verified, this address still controls the account.</p>
        </div>
    </div>
</body>`,
  };
  return data;
};

// Sent when an admin flips a user's status to REJECTED. Carries the
// one-time `reverifyToken` that the public POST /users/reverify endpoint
// consumes. The token (not an OTP) is opaque and longer-lived than a
// 3-minute OTP because re-shooting verification video takes real time.
const accountRejected = (values: IAccountRejected) => {
  const greeting = values.name ? `Hi ${values.name},` : 'Hi,';
  const reasonBlock = values.rejectionReason
    ? `<p style="color: #555; font-size: 16px; line-height: 1.5; margin-bottom: 20px;"><strong>Reason from our reviewer:</strong> ${values.rejectionReason}</p>`
    : '';
  const data = {
    to: values.email,
    subject: 'Your account verification was rejected — re-submit to continue',
    html: `<body style="font-family: Arial, sans-serif; background-color: #f9f9f9; margin: 50px; padding: 20px; color: #555;">
    <div style="width: 100%; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #fff; border-radius: 10px; box-shadow: 0 0 10px rgba(0,0,0,0.1);">
        <img src="https://i.postimg.cc/6pgNvKhD/logo.png" alt="Logo" style="display: block; margin: 0 auto 20px; width:150px" />
        <div style="text-align: left;">
            <p style="color: #555; font-size: 16px; line-height: 1.5; margin-bottom: 20px;">${greeting}</p>
            <p style="color: #555; font-size: 16px; line-height: 1.5; margin-bottom: 20px;">Our reviewer was unable to verify your account from the documents you submitted. Don't worry — you can re-submit and try again.</p>
            ${reasonBlock}
            <p style="color: #555; font-size: 16px; line-height: 1.5; margin-bottom: 20px;">Use this single-use re-verification token on the re-submit form in the app (POST /users/reverify):</p>
            <div style="background-color: #277E16; padding: 12px 16px; border-radius: 8px; color: #fff; font-size: 14px; letter-spacing: 1px; margin: 20px auto; word-break: break-all; font-family: monospace;">${values.reverifyToken}</div>
            <p style="color: #555; font-size: 16px; line-height: 1.5; margin-bottom: 20px;">This token is valid for ${values.reverifyTtlHours} hours. If it expires, contact support to be re-issued.</p>
            <p style="color: #b9b4b4; font-size: 14px; line-height: 1.5; margin-bottom: 20px;">If you believe this rejection was a mistake or you need help, reach out to support — they can review your case manually.</p>
        </div>
    </div>
</body>`,
  };
  return data;
};

export const emailTemplate = {
  createAccount,
  resetPassword,
  changeEmail,
  emailChangeNotification,
  accountRejected,
};
