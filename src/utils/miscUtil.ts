
export function arrayToChunks<T>(data: T[], chunkSize: number): T[][] {
  if (chunkSize < 1) {
    throw new Error("chunk size must be greater than 0");
  }
  if (chunkSize !== Math.round(chunkSize)) {
    throw new Error("chunk size must be an integer");
  }
  const chunks: T[][] = [];
  const size = data.length;
  for (let count = 0; count < size; count += chunkSize) {
    chunks.push(data.slice(count, count + chunkSize));
  }
  return chunks;
}

// copied from: https://github.com/TeamworkGuy2/ts-promises/releases/tag/v0.9.0
/** Run each object from 'args' through 'action' and return a deferred promise that completes when all of the actions complete
 * @param args an array of objects to pass individually to 'action'
 * @param action this action is called with a unique deferred promise that must be resolved or rejected
 * somewhere in the action, and each object from 'args' as a parameter
 * @param stopOnFirstError true to stop running the actions when the first one throws an error,
 * else continue running and return a list of successful results
 * @return a promise that returns an array of all of the results returned from the calls to 'action'
 */
export function runAsyncBatchActionsInSeries<T, R, P extends Promise<R[]>>(args: T[], action: (obj: T, index: number) => P, stopOnFirstError: boolean = false): Promise<R[]> {
  const  initialPromise = Promise.resolve<R[]>([]);
  const results: R[] = [];
  const errors: any[] = [];
  // for each action/argument combination, chain it to the previous action result
  const promise = args.reduce((promise, arg, idx) => {
    function successCallNextAction(res: R[]) {
      results.push(...res);
      return action(arg, idx);
    }

    function failureCallNextAction(err: any) {
      errors.push(err);
      return action(arg, idx);
    }

    // handle errors if all actions need to run
    if (!stopOnFirstError) {
      return promise.then(successCallNextAction, failureCallNextAction);
    }
    else {
      return promise.then(successCallNextAction);
    }
  }, initialPromise);

  return promise.then(function (res) {
    results.push(...res);
    return results;
  });
}

export function isPromiseSettledResult(v: any): v is PromiseSettledResult<any> {
  return (v as PromiseSettledResult<any>).status === "fulfilled" && ("value" in v || "reason" in v);
}


export function unwrapPromiseSettledResult<T, E = any>(v: PromiseSettledResult<T>): T | E {
  return v.status === "fulfilled" ? v.value : v.reason;
}
