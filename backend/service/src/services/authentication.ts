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