import type { components as CoreComponents } from "./generated/core";
import type { components as IntegrationComponents } from "./generated/integration";

export type CreateNewGameRequest =
	CoreComponents["schemas"]["CreateNewGameRequest"];
export type CreateNewGameResponse =
	CoreComponents["schemas"]["CreateNewGameResponse"];
export type CreateFreeRoundsRequest =
	CoreComponents["schemas"]["CreateFreeRoundsRequest"];
export type CreateFreeRoundsResponse =
	CoreComponents["schemas"]["CreateFreeRoundsResponse"];
export type DeleteFreeRoundsRequest =
	CoreComponents["schemas"]["DeleteFreeRoundsRequest"];
export type FreeRoundsInfoResponse =
	CoreComponents["schemas"]["FreeRoundsInfoResponse"];
export type GameInfo = CoreComponents["schemas"]["GameInfo"];
export type GamesResponse = CoreComponents["schemas"]["GamesResponse"];
export type CoreUser = CoreComponents["schemas"]["User"];
export type CoreErrorResponse = CoreComponents["schemas"]["ErrorResponse"];
export type PlatformType = CoreComponents["schemas"]["PlatformType"];

export type BetRequest = IntegrationComponents["schemas"]["BetRequest"];
export type BetResponse = IntegrationComponents["schemas"]["BetResponse"];
export type WinRequest = IntegrationComponents["schemas"]["WinRequest"];
export type WinResponse = IntegrationComponents["schemas"]["WinResponse"];
export type RefundRequest = IntegrationComponents["schemas"]["RefundRequest"];
export type RefundResponse = IntegrationComponents["schemas"]["RefundResponse"];
export type BalanceResponse =
	IntegrationComponents["schemas"]["BalanceResponse"];
export type AdapterErrorResponse =
	IntegrationComponents["schemas"]["ErrorResponseWithCodeAndAction"];
