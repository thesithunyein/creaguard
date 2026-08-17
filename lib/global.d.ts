import type { Incident, Policy } from "./types";

declare global {
  var __CREAGUARD_INCIDENTS__: Incident[] | undefined;
  var __CREAGUARD_POLICY__: Policy | undefined;
}

export {};
