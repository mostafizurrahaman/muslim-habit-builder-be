import { TProvider } from '../user/user.constant';


export interface jwtPayload {
  id: string;
  role: string;
  isRemembered?: boolean;
}

export interface socialLoginPayload {
  provider: TProvider;
  token: string;
  fcmToken?: string;
}

