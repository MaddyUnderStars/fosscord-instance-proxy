import "dotenv/config";
import Server from "./Server.js";

var server = new Server();
server.listen(parseInt(process.env.PORT as string));
