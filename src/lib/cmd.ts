import * as cp from 'child_process';
import * as execa from 'execa';
import { Options } from 'execa';
import { concat, empty, from, merge, Observable, Subscriber } from 'rxjs';
import { catchError, delay, filter, first, takeUntil } from 'rxjs/operators';
import { SemVer } from 'semver';
import * as split from 'split';
import * as streamToObservable from 'stream-to-observable';
import { IScripts } from '../types';

export function invokeScript(name: keyof IScripts, { scripts, env = {} }: { scripts?: IScripts, env?: { [key: string]: string } }, ctx?: { version?: SemVer }): Observable<string> {
    if (!scripts || !scripts[name]) {
        return empty();
    }

    return runScripts(scripts[name]!, {
        FB_VERSION: ctx && ctx.version ? ctx.version.format() : '',
        FB_VERSION_MAJOR: ctx && ctx.version ? ctx.version.major.toString() : '',
        FB_VERSION_MINOR: ctx && ctx.version ? ctx.version.minor.toString() : '',
        FB_VERSION_PATCH: ctx && ctx.version ? ctx.version.patch.toString() : '',
        FB_VERSION_PRE: ctx && ctx.version ? ctx.version.prerelease.join('') : '',
        ...env
    })
}

export function runScripts(scripts: string | string[], env: { [key: string]: string }): Observable<string> {
    return Observable.create((subscriber: Subscriber<string>) => {
        if (!Array.isArray(scripts)) {
            scripts = [scripts];
        }
        concat(...scripts.map(script => runScript(script, env))).subscribe(subscriber);
    });
}

export function runScript(script: string, env: { [key: string]: string }): Observable<string> {
    return new Observable<string>(subscriber => {
        const child = cp.exec(script, { env: { ...process.env, ...env } }, (err) => {
            if (err) {
                subscriber.error(err);
            }
            subscriber.complete();
        });

        streamToObservable(child.stdout!.pipe(split())).subscribe(subscriber);
        streamToObservable(child.stderr!.pipe(split())).subscribe(subscriber);
    })
}

export function exec(cmd: string, args: string[], options?: Options): Observable<string> {
    return new Observable<string>((subscriber) => {
        const child = execa(cmd, args, options);

        const promise = Promise.resolve(child);

        merge(
            streamToObservable(child.stdout!.pipe(split())),
            streamToObservable(child.stderr!.pipe(split())),
            from(promise).pipe(filter(() => false))
        ).pipe(
            takeUntil(from(promise).pipe(delay(1))),
        ).subscribe(subscriber);

        return () => {
            if (!child.killed) {
                child.kill();
            }
        }
    })
}


export function git(...args: string[]): Observable<string> {
    return exec('git', args);
}

export module git {
    export function currentBranch(): Observable<string> {
        return git('rev-parse', '--abbrev-ref', 'HEAD').pipe(first());
    }

    export function checkout(branch: string): Observable<string> {
        return git('checkout', branch)
    }

    export function checkoutOrCreate(branch: string): Observable<string> {
        return checkout(branch).pipe(catchError(() => createBranch(branch)));
    }

    export function createBranch(name: string, { fromTag, fromCommit }: { fromTag?: string, fromCommit?: string } = {}): Observable<string> {
        if (fromTag) {
            return git('checkout', `tags/${fromTag}`, '-b', name);
        } else if (fromCommit) {
            return git('checkout', fromCommit, '-b', name);
        } else {
            return git('checkout', '-b', name);
        }
    }

    export function removeBranch(name: string, { force }: { force?: boolean } = {}) {
        return git('branch', force ? '-D' : '-d', name);
    }

    export function pull() {
        return git('pull');
    }

    export function push(remote: string, branch: string, ...options: string[]) {
        return git('push', '-u', remote, branch, ...options);
    }

    export function pushTag(remote: string, tag: string) {
        return git('push', remote, tag);
    }

    export function commit(message?: string | null, flags: string[] = []) {
        if (message) {
            return git('commit', '-m', message, ...flags);
        }
        return git('commit', ...flags);
    }

    export function merge(branch: string, flags: string[] = []) {
        return git('merge', ...flags, branch);
    }

    export function tag(tag: string, branch: string) {
        return git('tag', tag, branch);
    }

    export function fetch(flags: string[] = []) {
        return git('fetch', ...flags);
    }
}
