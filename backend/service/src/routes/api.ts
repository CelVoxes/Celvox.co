import express from 'express'
import multer from 'multer'
import axios from 'axios'
import { isAxiosError } from 'axios'
import path from 'path'

import { requireAuthentication } from '#root/services/authentication'
import { FirebaseModule } from '#root/services/firebase'
import { AppConfig } from '#root/services/app'


export function apiRoute(props: {config: AppConfig, firebase: FirebaseModule}) {
  const route = express.Router();
  route.use(requireAuthentication(props.firebase))

  const upload = multer({ dest: props.config.uploadsFolder || '/tmp/seamless/uploads/' })
  
  const compuateBackendUrl = props.config.computeBackendUrl || 'http://127.0.0.1:5555'

  route.post('/load-sample-data', upload.fields([{ name: 'file', maxCount: 1 }, { name: 'files' }]), async (req, resp) => {
    try {
      const uid = req.auth?.email!
      const files: Express.Multer.File[] = []

      if (req.files) {
        if (Array.isArray(req.files)) {
          files.push(...req.files)
        } else {
          const grouped = req.files as { [field: string]: Express.Multer.File[] }
          if (grouped.file) {
            files.push(...grouped.file)
          }
          if (grouped.files) {
            files.push(...grouped.files)
          }
        }
      }

      if (req.file) {
        files.push(req.file)
      }

      if (files.length === 0) {
        resp.status(400).json({ error: 'No files uploaded' })
        return
      }

      const filePaths = files.map((file) => path.resolve(file.path))
      const fileNames = files.map((file) => file.originalname)
      console.log(fileNames, filePaths)

      // Plumber expects repeated `file` / `filename` keys, not `file[]` style params.
      const query = new URLSearchParams()
      for (const filePath of filePaths) {
        query.append('file', filePath)
      }
      for (const fileName of fileNames) {
        query.append('filename', fileName)
      }
      query.append('cachedir', `cache/${uid}`)

      const reponse = await axios.get(`${compuateBackendUrl}/load-sample-data?${query.toString()}`)
      console.log(reponse.data)
      resp.json(reponse.data)
    } catch (error) {
      console.error('load-sample-data proxy failed', error)
      if (isAxiosError(error) && error.response) {
        resp.status(error.response.status).json(error.response.data)
        return
      }
      resp.status(500).json({ error: 'Something went wrong on the server.' })
    }
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
