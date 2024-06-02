const app = require("./app");

const http = require("http").createServer(app);
const port = Number(process.env.PORT || 5000);
http.listen(port, () => console.log("Listening on " + port));
