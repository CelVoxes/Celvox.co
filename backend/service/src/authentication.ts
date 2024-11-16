import { StatusCodes } from "http-status-codes"
import express from 'express'

import { FirebaseModule } from "@/firebase"
import { RequestContext } from "@/request-context"

type AppRequestHandler = (req: express.Request & Partial<RequestContext>, res: express.Response, next: any) => Promise<any>


export function requireAuthentication(firebase: FirebaseModule): AppRequestHandler {
  return async (req, resp, next) => {
    const idToken = req.header('Authorization')?.split('Bearer ',2)[1]
    if (!idToken) {
      resp.status(StatusCodes.UNAUTHORIZED).send()
      return
    }
    try {
      const decodedIdToken = await firebase.verifyIdToken(idToken)
      console.log("valid uid:", decodedIdToken);
      req.auth = decodedIdToken;
    } catch (error) {
      resp.status(StatusCodes.FORBIDDEN).send()
      return
    }
    next()
  }
}