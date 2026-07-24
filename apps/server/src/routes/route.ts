import { OpenAPIHono } from "@hono/zod-openapi";
import affnookRoute from "./affnook";
import basketballRoute from "./basketball";
import casinoRoute from "./casino";
import hashcodexRoute from "./hashcodex";
import casinoProviderRoute from "./casino-provider";
import cmsRoute from "./cms";
import filesRoute from "./files";
import footballRoute from "./football";
import gamesRoute from "./games";
import kycRoute from "./kyc";
import lagosRushRoute from "./lagos-rush";
import monnifyRoute from "./monnify";
import newsRoute from "./news";
import notificationsRoute from "./notifications";
import phoneAuthRoute from "./phone-auth";
import pocketsRoute from "./pockets";
import slotegratorRoute from "./slotegrator";
import sportsbookRoute from "./sportsbook";
import tennisRoute from "./tennis";
import thundrRoute from "./thundr";
import userRoute from "./user";
import walletRoute from "./wallet";
import betHistoryRoute from "./bet-history";
const routes = new OpenAPIHono();





routes.route("/affnook", affnookRoute);
routes.route("/football", footballRoute);
routes.route("/basketball", basketballRoute);
routes.route("/tennis", tennisRoute);
routes.route("/news", newsRoute);
routes.route("/notifications", notificationsRoute);
routes.route("/phone-auth", phoneAuthRoute);
routes.route("/wallet", walletRoute);
routes.route("/user", userRoute);
routes.route("/casino", casinoRoute);
routes.route("/lagos-rush", lagosRushRoute);
routes.route("/pockets", pocketsRoute);
routes.route("/thndr", thundrRoute);
routes.route("/slotegrator", slotegratorRoute);
routes.route("/sportsbook", sportsbookRoute);
routes.route("/account", casinoProviderRoute);
routes.route("/bills", monnifyRoute);
routes.route("/files", filesRoute);
routes.route("/games", gamesRoute);
routes.route("/hashcodex", hashcodexRoute);
routes.route("/cms", cmsRoute);
routes.route("/kyc", kycRoute);
routes.route("/bet-history", betHistoryRoute);

export default routes;
