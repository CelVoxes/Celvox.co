import express from 'express'
import multer from 'multer'
import axios from 'axios'
import path from 'path'

import { requireAuthentication } from '#root/services/authentication'
import { FirebaseModule } from '#root/services/firebase'
import { AppConfig } from '#root/services/app'


export function apiRoute(props: {config: AppConfig, firebase: FirebaseModule}) {
  const route = express.Router();
  route.use(requireAuthentication(props.firebase))

  const upload = multer({ dest: props.config.uploadsFolder || '/tmp/seamless/uploads/' })
  
  const compuateBackendUrl = props.config.computeBackendUrl || 'http://localhost:5555'

  route.post('/load-sample-data', upload.single('file'), async (req, resp) => {
    console.log(req.file, path.resolve( req.file?.path!))
    const uid = req.auth?.email!

    const reponse = await axios.get(`${compuateBackendUrl}/load-sample-data`, {
      params: {
        file: path.resolve(req.file?.path!),
        cachedir: `cache/${uid}` 
      }
    })
    console.log(reponse.data)
    resp.json(reponse.data)
  })

  route.delete('/:api', async (req, resp) => {
    console.log('routing to local R plumbler ', req.params.api)
    const uid = req.auth?.email!

    const r = await axios.delete(`${compuateBackendUrl}/${req.params.api}`, {
      params: {
        ...req.query,
        cachedir: `cache/${uid}`
      },
    });
    resp.json(r.data)
  })

  route.get('/:api', async (req, resp) => {
    console.log('routing to local R plumbler ', req.params.api)
    const uid = req.auth?.email!


    const r = await axios.get(`${compuateBackendUrl}/${req.params.api}`, {
      params: {
        ...req.query,
        cachedir: `cache/${uid}`
      }
    });
    resp.json(r.data)
  })


  return route;
}
