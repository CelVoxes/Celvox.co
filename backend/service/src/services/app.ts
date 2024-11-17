import { readFileSync } from "fs"
import { argv } from "process"
import express from 'express'
import cors from 'cors'
import morgan from 'morgan'

import { FirebaseModule } from "./firebase";
import { apiRoute } from "#root/routes/api";




export interface AppConfig {
  port?: number
  uploadsFolder?: string
  computeBackendUrl?: string
  firebase: {
    serviceAccountFile: string
  }
}

export function loadConfig(): AppConfig {
  return JSON.parse(readFileSync(argv[2] || "config.json", {encoding: "utf-8"}))
}


function setupMiddlewares(app: express.Express) {
  app.use(morgan('combined'))
  app.use(cors({
    origin: ["https://celvox.co", "http://localhost:3000"]
  }))
  
}


export function compose(config: AppConfig): express.Application {

  const firebase = new FirebaseModule(config.firebase.serviceAccountFile)

  const app = express()

  // common stuff
  setupMiddlewares(app)
  
  // bind business endpoints
  app.use("/v1", apiRoute({config, firebase}))

  // bind "ping" endpoint
  app.get('/', async (req, res) => {req.auth
    res.send('ok')
  })
  
  return app;
}
