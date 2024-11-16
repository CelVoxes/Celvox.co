import { DecodedIdToken } from "firebase-admin/auth";

export interface RequestContext {
  auth?: DecodedIdToken
}
