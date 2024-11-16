
import fs from 'fs'

import { App, initializeApp } from 'firebase-admin/app'
import firebaseAdmin from 'firebase-admin'
import { Auth, DecodedIdToken, getAuth } from 'firebase-admin/auth'

export class FirebaseModule {

  readonly firebase: App
  readonly auth: Auth

  constructor(serviceAccountFile: string) {
    this.firebase = initializeApp({
      credential: firebaseAdmin.credential.cert(
        JSON.parse(fs.readFileSync(serviceAccountFile, {encoding: "utf-8"})))
    });
    this.auth = getAuth(this.firebase)
  }

  async verifyIdToken(idToken: string): Promise<DecodedIdToken> {
    return this.auth.verifyIdToken(idToken)
  }

}
