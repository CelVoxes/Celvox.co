import express from 'express'
import cors from 'cors'
import morgan from 'morgan'
import multer from 'multer'

import fs from 'fs'
import path from 'path'

import { FirebaseModule } from './firebase'
import { argv } from 'process'
import { requireAuthentication } from './authentication'
import axios from 'axios'


interface AppConfig {
  port?: number
  firebase: {
    serviceAccountFile: string
  }
}

const config: AppConfig = JSON.parse(fs.readFileSync(argv[2] || "config.json", {encoding: "utf-8"}))
const firebase = new FirebaseModule(config.firebase.serviceAccountFile)


function setupMiddlewares(app: express.Express) {
  app.use(morgan('combined'))
  app.use(cors({
    origin: ["https://celvox.co", "http://localhost:3000"]
  }))
  
}


function apiRoute() {
  const route = express.Router();

  route.use(requireAuthentication(firebase))


  const upload = multer({ dest: 'uploads/' })
  route.post('/load-sample-data', upload.single('file'), async (req, resp) => {
    console.log(req.file, path.resolve( req.file?.path!))
    const reponse = await axios.get(`http://localhost:5555/load-sample-data`, {
      params: {
        file: path.resolve( req.file?.path!)
      }
    })
    console.log(reponse.data)
    resp.json(reponse.data)
  })
  /*

  route.get('/harmonize-data', async (req, resp) => {
    resp.send('ok')
  });
  route.get('/tsne', async (req, resp) => {
    resp.send('ok')
  });
  route.get('/knn', async (req, resp) => {
    resp.send('ok')
  });
  route.get('/deconvolution', async (req, resp) => {
    resp.send('ok')
  });
  route.get('/drug-response', async (req, resp) => {
    resp.send('ok')
  });
  route.get('/mutation-tsne', async (req, resp) => {
    resp.send('ok')
  });
  route.get('/cache-files', async (req, resp) => {
    resp.send('ok')
  });

  route.delete('/delete-cache-file', async (req, resp) => {
    resp.send('ok')
  });
  route.get('/gene-expression', async (req, resp) => {
    resp.send('ok')
  });
  route.get('/ai-report', async (req, resp) => {
    resp.send('ok')
  });
  route.get('/qc-metrics', async (req, resp) => {
    resp.send('ok')
  });
  route.get('/sample-data-names', async (req, resp) => {
    resp.send('ok')
  });
  route.get('/harmonized-data-names', async (req, resp) => {
    resp.send('ok')
  });
  route.get('/knn-deg', async (req, resp) => {
    resp.send('ok')
  });
    */

  route.get('/:api', async (req, resp) => {
    console.log('routing to local R plumbler ', req.params.api)
    const r = await axios.get(`http://localhost:5555/${req.params.api}`, {
      params: req.query
    });
    resp.json(r.data)
  })

  return route;
}


function compose(): express.Application {
  const app = express()

  // common stuff
  setupMiddlewares(app)
  
  // bind business endpoints
  app.use("/v1", apiRoute())

  // bind "ping" endpoint
  app.get('/', async (req, res) => {
    res.send('ok')
  })
  
  return app;
}

const app = compose();
const port = config.port || 3001;
app.listen(port, () => console.log(`listening on port ${port}`));

