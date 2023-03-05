
export type Listener = Function;

export type Snapshot = Record<string, Array<Listener>>;

export interface Measure {
  add: Snapshot;
  remove: Snapshot;
  listenersRepeatCount: any;
}
