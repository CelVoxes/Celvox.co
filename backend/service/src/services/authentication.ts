import { StatusCodes } from "http-status-codes"
import { RequestHandler } from 'express'
import { DecodedIdToken } from "firebase-admin/auth";
import { FirebaseModule } from "#root/services/firebase"


export interface RequestAuthentication {
  auth: DecodedIdToken
}

declare global {
  namespace Express {
      interface Request extends Partial<RequestAuthentication> {
      }
  }
}

/**
 * Local-development bypass: every request is treated as `email`, no Firebase
 * project required. Refuses to activate under NODE_ENV=production so it cannot
 * be switched on by accident on a deployed host.
 */
export function devAuthentication(email: string): RequestHandler {
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "SEAMLESS_DEV_AUTH is set but NODE_ENV=production. The authentication "
      + "bypass is refused in production builds.")
  }

  console.warn(
    `[auth] DEVELOPMENT BYPASS ACTIVE -- all requests authenticated as ${email}. `
    + "Never run this configuration on a public host.")

  return (req, _resp, next) => {
    req.auth = { email, uid: `dev:${email}` } as DecodedIdToken
    next()
  }
}

export function requireAuthentication(firebase: FirebaseModule): RequestHandler {
  return async (req, resp, next) => {
    const idToken = req.header('Authorization')?.split('Bearer ',2)[1]
    if (!idToken) {
      resp.status(StatusCodes.UNAUTHORIZED).send()
      return
    }
    try {
      const decodedIdToken = await firebase.verifyIdToken(idToken)
      req.auth = decodedIdToken;

      if (!decodedIdToken.email) {
        throw new Error("an email address is not registered with your account")
      }
    } catch (error) {
      resp.status(StatusCodes.FORBIDDEN).send()
      return
    }
    next()
  }
}
