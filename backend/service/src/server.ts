import { compose, loadConfig } from "./services/app";


const config = loadConfig()
const app = compose(config);
const port = config.port || 3001;
app.listen(port, () => console.log(`listening on port ${port}`));

