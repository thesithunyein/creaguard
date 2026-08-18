import type { Incident, Policy } from "./types";

declare global {
  var __CREAGUARD_INCIDENTS__: Incident[] | undefined;
  var __CREAGUARD_POLICY__: Policy | undefined;
  var __CREAGUARD_SEEN__: Record<string, string[]> | undefined;
}

export {};
