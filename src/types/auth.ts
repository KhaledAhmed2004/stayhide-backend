export type IVerifyEmail = {
  email: string;
  otp: string;
};

export type ILoginData = {
  email: string;
  password: string;
  deviceToken?: string;
  platform?: 'ios' | 'android' | 'web';
  appVersion?: string;
};

export type IAuthResetPassword = {
  newPassword: string;
};

export type IChangePassword = {
  currentPassword: string;
  newPassword: string;
};

export type ISocialLogin = {
  provider: 'google' | 'apple';
  idToken: string;
  nonce?: string;
  deviceToken?: string;
  platform?: 'ios' | 'android' | 'web';
  appVersion?: string;
};
