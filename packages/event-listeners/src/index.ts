import type { Listener, Snapshot, Measure } from "./types";
import { BoundArguments, BoundTargetFunction, BoundThis } from "./const";

export default class EventListenersDetect {
  static instance: EventListenersDetect;

  readonly listenerMap: Snapshot = {};

  #add: typeof window.addEventListener;
  #remove: typeof window.removeEventListener;
  #bind: typeof Function.prototype.bind;

  #marks: Record<string, Snapshot> = {};
  #measures: Record<string, Measure> = {};

  constructor() {
    // singleton
    if (EventListenersDetect.instance) {
      return EventListenersDetect.instance;
    }
    EventListenersDetect.instance = this;

    this.#add = window.addEventListener;
    window.addEventListener = this._addEventListener.bind(this);

    this.#remove = window.removeEventListener;
    window.removeEventListener = this._removeEventListener.bind(this);

    this.#bind = Function.prototype.bind;
    this._handleBind();
  }

  destory () {
    if (this.#add) {
      window.addEventListener = this.#add;
      this.#add = null;
    }
    if (this.#remove) {
      window.removeEventListener = this.#remove;
      this.#remove = null;
    }
    if (this.#bind) {
      Function.prototype.bind = this.#bind;
    }
    this.#marks = {};
    this.#measures = {};
    
    Object.keys(this.listenerMap).forEach(key => {
      this.listenerMap[key] = [];
    });
  }

  /**
   * 标记
   * @param {string} name
   */
  mark(name: string): Snapshot {
    if (!name) {
      throw new Error('name not provided');
    }
    const snapshot = this.getSnapShot();
    this.#marks[name] = snapshot;
    return snapshot;
  }

  /**
   * 测量
   * @param {string} name
   * @param {string} startMark
   * @param {string} endMark
   */
  measure (name: string, startMark: string, endMark: string): Measure {
    if (!this.#marks[startMark]) {
      throw new Error(`${name} start mark not exists`); 
    } else if (!this.#marks[endMark]) {
      throw new Error(`${name} end mark not exists`);
    }
    const report = this._createMeasure(this.#marks[startMark], this.#marks[endMark]);
    this.#measures[name] = report;
    return report;
  }

  clearMarks(name?: string): void {
    if (!name) {
      this.#marks = {};
      return;
    }
    if (name && this.#marks[name]) {
      delete this.#marks[name];
      return;
    }
  }

  clearMeasure(name?: string): void {
    if (!name) {
      this.#measures = {};
      return;
    }
    if (name && this.#measures) {
      delete this.#measures[name];
      return;
    }
  }

  /**
   * @param {string} name
   * @param {string?} id
   */
  start (name: string, id: string | null = '') {
    const key = `${name}-${id}-start`;
    this.mark(key);
  }

  /**
   * @param {string} name
   * @param {string?} id
   */
  end (name: string, id: string | null = '') {
    const key = `${name}-${id}`;
    const startMark = `${key}-start`;
    const endMark = `${key}-end`;
    this.mark(endMark);

    const report = this.measure(key, startMark, endMark);
    return report;
  }

  /** 
   * @returns {Snapshot}
   */
  getSnapShot (): Snapshot {
    return this._shakeSnapShot(this._copy(this.listenerMap));
  }

  /**
   * @param {Snapshot} snapshot
   * @returns {Snapshot}
   */
  private _copy (snapshot: Snapshot): Snapshot {
    const _snapshot = {};
    Object.keys(snapshot).forEach(key => {
      _snapshot[key] = snapshot[key].slice();
    });
    return _snapshot;
  }
  
  private _shakeSnapShot (snapshot: Snapshot): Snapshot {
    const _snapshot = {};
    Object.keys(snapshot).forEach(event => {
      if (snapshot[event].length) {
        _snapshot[event] = snapshot[event].slice();
      }
    });
    return _snapshot;
  }

  /**
   * @param {Snapshot} start
   * @param {Snapshot} end
   * @returns {Measure}
   */
  private _createMeasure (start: Snapshot, end: Snapshot): Measure {

    // find removed listeners
    let remove = this._copy(start);
    Object.keys(remove).forEach(event => {
      remove[event] = remove[event].filter(fn => !(end[event] || []).includes(fn));
    });
    remove = this._shakeSnapShot(remove);

    // find newly added listeners // possibly leak
    let add = this._copy(end);
    Object.keys(add).forEach(event => {
      add[event] = add[event].filter(fn => !(start[event] || []).includes(fn));
    });
    add = this._shakeSnapShot(add);

    // find repeatly added listeners // likely leak
    const listenersRepeatCount = {};
    Object.keys(add).forEach(event => {
      listenersRepeatCount[event] = add[event].reduce((res, fn) => {
        const fnString = fn[BoundTargetFunction] ? fn[BoundTargetFunction].toString() : fn.toString();
        res[fnString] = (res[fnString] + 1) || 1
        return res;
      }, {});
      // shake
      Object.keys(listenersRepeatCount[event]).forEach(fnString => {
        if (listenersRepeatCount[event][fnString] < 2) {
          delete listenersRepeatCount[event][fnString];
          return;
        }
      })
    });

    return {
      add,
      remove,
      listenersRepeatCount,
    };
  }

  private _addEventListener (type: string, listener: Listener, options?: boolean | AddEventListenerOptions) {
    this.#add.call(null, type, listener, options);
    
    const buffer = this.listenerMap[type] || [];
    buffer.push(listener);
    this.listenerMap[type] = buffer;
  }

  private _removeEventListener (type: string, listener: Listener, options?: boolean | AddEventListenerOptions) {
    this.#remove.call(null, type, listener, options);

    const buffer = this.listenerMap[type] || [];
    let index = buffer.indexOf(listener);
    while (index >= 0) {
      buffer.splice(index, 1);
      index = buffer.indexOf(listener);
    }
  }

  private _handleBind() {
    const bind = this.#bind;
    Function.prototype.bind = function (thisArg, ...arg) {
      const fn = bind.call(this, thisArg, ...arg);
      fn[BoundTargetFunction] = this[BoundTargetFunction] || this;
      fn[BoundThis] = thisArg;
      fn[BoundArguments] = arg;
      return fn;
    };
  }
}