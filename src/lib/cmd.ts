import * as execa from 'execa';
import { Options } from 'execa';
import { Observable } from 'rxjs/Observable';
import { Subscriber } from 'rxjs/Subscriber';
import { filter, first, takeUntil, delay } from 'rxjs/operators';
import { fromPromise } from 'rxjs/observable/fromPromise';
import * as streamToObservable from 'stream-to-observable';
import * as split from 'split';
import { merge } from 'rxjs/observable/merge';

export function exec(cmd : string, args : string[], options? : Options) : Observable<string> {
    return Observable.create((subscriber : Subscriber<string>) => {
        const child = execa(cmd, args, options);
        
        const promise = Promise.resolve(child);
        
        merge(
            streamToObservable(child.stdout.pipe(split())),
            streamToObservable(child.stderr.pipe(split())),
            fromPromise(promise).pipe(filter(() => false))
        ).pipe(
            takeUntil(fromPromise(promise).pipe(delay(1))),
            filter(Boolean)
        ).subscribe(subscriber);
        
        return () => {
            if(!child.killed) {
                child.kill();
            }
        }
    })
}


export function git(...args : string[]) : Observable<string> {
    return exec('git', args);
}

export module git {
    export function currentBranch() : Observable<string> {
        return git('rev-parse', '--abbrev-ref', 'HEAD').pipe(first());
    }
    
    export function checkout(branch : string) : Observable<string> {
        return git('checkout', branch)
    }
    
    export function createBranch(name : string, { fromTag } : { fromTag?: string } = {}) : Observable<string> {
        if(fromTag) {
            return git('checkout', `tags/${fromTag}`, '-b', name);
        } else {
            return git('checkout', '-b', name);
        }
    }
    
    export function removeBranch(name : string) {
        return git('branch', '-d', name);
    }
    
    export function pull() {
        return git('pull');
    }
    
    export function push(remote : string, branch : string) {
        return git('push', '-u', remote, branch);
    }
    
    export function commit(message? : string|null, flags : string[] = []) {
        if(message) {
            return git('commit', '-m', message, ...flags);
        }
        return git('commit', ...flags);
    }
    
    export function merge(branch : string, flags : string[] = []) {
        return git('merge', ...flags, branch);
    }
    
    export function tag(tag : string, branch : string) {
        return git('tag', tag, branch);
    }
    
    export function fetch(flags : string[] = []) {
        return git('fetch', ...flags);
    }
}
