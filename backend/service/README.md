### How to run locally?

Requires NodeJS to run (tested on `Node.js v23.2.0`).

First, add a `debug.config.json` file in this directory. A minimal setup would like:

```
{
  "firebase": {
    "serviceAccountFile": "/home/alim/Downloads/test-1238b-firebase-adminsdk-dyjdn-1200991e05.json"
  }
}
```

A `serviceAccountFile` can be downloaded from Firebase admin console under "Project Settings" -> "Service accounts".

Install deps
```
npm install
```

Start server

```
npm run start
```
