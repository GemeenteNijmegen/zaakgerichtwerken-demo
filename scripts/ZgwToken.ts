import * as jwt from 'jsonwebtoken';

export function jwtToken(clientId: string, userId: string, secret: string) {
  const token = jwt.sign({
    iss: clientId,
    iat: Date.now(),
    client_id: clientId,
    user_id: userId,
    user_representation: userId,
  }, secret);
  return token;
}