import { getFunctions, httpsCallable } from "firebase/functions";
import { getApp } from "firebase/app";
import "./firebase";

const fns = getFunctions(getApp(), "asia-south1");

/** Call a Cloud Function. The server decides everything that involves money; the app only asks. */
export async function callFn<T = any>(name: string, data: unknown = {}): Promise<T> {
  const r = await httpsCallable<unknown, T>(fns, name)(data);
  return r.data;
}
