import { JwtPayload } from 'jsonwebtoken';

export interface JwtUser extends JwtPayload {
  id?: string | null;
  email?: string | null;
  role: string;
}

declare global {
  namespace Express {
    interface Request {
      user: JwtUser;
    }
  }
}
