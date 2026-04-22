import { OpenAPIHono, OpenAPIHono } from "@hono/zod-openapi";
import basketballRoute from "./basketball";
import casinoRoute from "./casino";
import casinoProviderRoute from "./casino-provider";
import filesRoute from "./files";
import footballRoute from "./football";
import gamesRoute from "./games";
import lagosRushRoute from "./lagos-rush";
import monnifyRoute from "./monnify";
import newsRoute from "./news";
import notificationsRoute from "./notifications";
import pocketsRoute from "./pockets";
import slotegratorRoute from "./slotegrator";
import tennisRoute from "./tennis";
import thundrRoute from "./thundr";
import userRoute from "./user";
import walletRoute from "./wallet";

const routes = new OpenAPIHono();

routes.route("/football", footballRoute);
routes.route("/basketball", basketballRoute);
routes.route("/tennis", tennisRoute);
routes.route("/news", newsRoute);
routes.route("/notifications", notificationsRoute);
routes.route("/wallet", walletRoute);
routes.route("/user", userRoute);
routes.route("/casino", casinoRoute);
routes.route("/lagos-rush", lagosRushRoute);
routes.route("/pockets", pocketsRoute);
routes.route("/thndr", thundrRoute);
routes.route("/slotegrator", slotegratorRoute);
routes.route("/account", casinoProviderRoute);
routes.route("/bills", monnifyRoute);
routes.route("/files", filesRoute);
routes.route("/games", gamesRoute);

export default routes;
